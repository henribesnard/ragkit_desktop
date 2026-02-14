use tauri::{AppHandle, Manager};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;
use std::sync::Mutex;
#[cfg(debug_assertions)]
use std::process::Command as StdCommand;
use std::time::Duration;
use reqwest::Client;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

pub struct BackendState {
    pub port: Mutex<Option<u16>>,
    pub child: Mutex<Option<ChildProcess>>,
}

pub enum ChildProcess {
    Std(std::process::Child),
    Sidecar(CommandChild),
}

pub async fn start_backend(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let port = portpicker::pick_unused_port().ok_or("No free port found")?;
    
    tracing::info!("Allocated port for backend: {}", port);

    // Update state
    if let Some(state) = app.try_state::<BackendState>() {
        *state.port.lock().unwrap() = Some(port);
    }

    #[cfg(debug_assertions)]
    {
        tracing::info!("Starting backend in DEV mode (python -m ...)");
        let mut cmd = StdCommand::new("python");
        // We assume we are running from src-tauri, so we go up twice to find the root
        // Windows might need "python" or "python3" depending on env. 
        // Assuming "python" is available in PATH.
        cmd.current_dir("../../") 
           .args(["-m", "ragkit.desktop.main", "--port", &port.to_string()]);
        
        let child = cmd.spawn()?;
        if let Some(state) = app.try_state::<BackendState>() {
            *state.child.lock().unwrap() = Some(ChildProcess::Std(child));
        }
    }

    #[cfg(not(debug_assertions))]
    {
        tracing::info!("Starting backend in PROD mode (sidecar)");
        let sidecar = app.shell().sidecar("ragkit-backend")?;
        let (_rx, child) = sidecar.args(["--port", &port.to_string()]).spawn()?;
        if let Some(state) = app.try_state::<BackendState>() {
            *state.child.lock().unwrap() = Some(ChildProcess::Sidecar(child));
        }
    }

    // Wait for health check
    wait_for_backend(port).await?;
    tracing::info!("Backend is ready on port {}", port);

    Ok(())
}

async fn wait_for_backend(port: u16) -> Result<(), String> {
    let url = format!("http://127.0.0.1:{}/health", port);
    let client = Client::builder().timeout(Duration::from_secs(1)).build().unwrap();
    
    for i in 0..30 {
        tracing::debug!("Health check attempt {}...", i + 1);
        if let Ok(resp) = client.get(&url).send().await {
            if resp.status().is_success() {
                return Ok(());
            }
        }
        tokio::time::sleep(Duration::from_millis(1000)).await;
    }
    Err("Backend failed to start in time".to_string())
}

pub async fn stop_backend(app: &AppHandle) {
    tracing::info!("Stopping backend...");
    let mut port_opt = None;

    if let Some(state) = app.try_state::<BackendState>() {
        port_opt = *state.port.lock().unwrap();
    }

    if let Some(port) = port_opt {
        // Try graceful shutdown via API
        let client = Client::builder()
            .timeout(Duration::from_secs(3))
            .build()
            .unwrap();
        let _ = client
            .post(format!("http://127.0.0.1:{}/shutdown", port))
            .send()
            .await;

        // Give the backend a moment to exit cleanly
        tokio::time::sleep(Duration::from_secs(1)).await;
    }

    // Force kill the child process
    if let Some(state) = app.try_state::<BackendState>() {
         let mut child_guard = state.child.lock().unwrap();
         if let Some(child) = child_guard.take() {
             tracing::info!("Force killing backend process...");
             match child {
                 ChildProcess::Std(mut c) => { let _ = c.kill(); let _ = c.wait(); }
                 ChildProcess::Sidecar(c) => { let _ = c.kill(); }
             }
         }
    }

    // Last resort: kill any remaining ragkit-backend processes by name
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/IM", "ragkit-backend.exe"])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output();
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::process::Command::new("pkill")
            .args(["-f", "ragkit-backend"])
            .output();
    }
}

pub async fn request(
    method: reqwest::Method,
    endpoint: &str,
    body: Option<serde_json::Value>,
    app: &AppHandle
) -> Result<serde_json::Value, String> {
    let port = {
        let state = app.state::<BackendState>();
        let port_value = *state.port.lock().unwrap();
        port_value
    };

    if let Some(p) = port {
        let url = format!("http://127.0.0.1:{}{}", p, endpoint);
        let client = Client::new();
        let mut builder = client.request(method, &url);
        
        if let Some(b) = body {
            builder = builder.json(&b);
        }

        let resp = builder
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let status = resp.status();
        if status.is_success() {
            resp.json::<serde_json::Value>()
                .await
                .map_err(|e| e.to_string())
        } else {
            let error_text = resp.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            Err(format!("Request failed with status {}: {}", status, error_text))
        }
    } else {
        Err("Backend not ready".to_string())
    }
}
