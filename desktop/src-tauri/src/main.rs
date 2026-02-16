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
    
    tracing::info!("=== RAGKIT Desktop starting ===");

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
        .invoke_handler(tauri::generate_handler![
            commands::health_check,
            commands::validate_folder,
            commands::scan_folder,
            commands::analyze_wizard_profile,
            commands::complete_wizard,
            commands::detect_environment,
            commands::get_setup_status,
            commands::get_ingestion_config,
            commands::update_ingestion_config,
            commands::reset_ingestion_config,
            commands::get_documents,
            commands::update_document_metadata,
            commands::analyze_documents,
            commands::get_analysis_progress,
            commands::get_chunking_config,
            commands::update_chunking_config,
            commands::reset_chunking_config,
            commands::validate_chunking_config,
            commands::preview_chunking,
            commands::preview_chunking_custom,
        ])
        .build(tauri::generate_context!())
        .expect("error while building RAGKIT Desktop")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                tracing::info!("Application exiting, stopping backend...");
                tauri::async_runtime::block_on(async {
                    backend::stop_backend(app_handle).await;
                });
                tracing::info!("Backend stopped.");
            }
        });
}
