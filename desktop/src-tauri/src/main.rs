#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod backend;
mod commands;

use tauri::Manager;
use std::sync::Mutex;
use backend::BackendState;

fn get_log_dir() -> std::path::PathBuf {
    #[cfg(target_os = "windows")]
    let home = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".to_string());
    #[cfg(not(target_os = "windows"))]
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    
    std::path::PathBuf::from(home).join(".ragkit").join("logs")
}

fn main() {
    let log_dir = get_log_dir();
    let _ = std::fs::create_dir_all(&log_dir);
    
    let file_appender = tracing_appender::rolling::daily(&log_dir, "ragkit-desktop.log");
    tracing_subscriber::fmt()
        .with_writer(file_appender)
        .with_ansi(false)
        .init();
    
    tracing::info!("=== RAGKIT Desktop v0.1.0 starting ===");
    
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(BackendState {
            port: Mutex::new(None),
            child: Mutex::new(None),
        })
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = backend::start_backend(&app_handle).await {
                    tracing::error!("Failed to start backend: {}", e);
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let app_handle = window.app_handle().clone();
                tauri::async_runtime::spawn(async move {
                    backend::stop_backend(&app_handle).await;
                });
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::health_check,
        ])
        .run(tauri::generate_context!())
        .expect("error while running RAGKIT Desktop");
}
