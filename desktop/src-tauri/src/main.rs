#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod backend;
mod commands;

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
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .expect("Failed to build reqwest client"),
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
            commands::get_current_profile,
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
            commands::get_embedding_config,
            commands::update_embedding_config,
            commands::reset_embedding_config,
            commands::store_secret,
            commands::secret_exists,
            commands::delete_secret,
            commands::test_embedding_connection,
            commands::test_embedding,
            commands::get_embedding_environment,
            commands::get_available_models,
            commands::get_embedding_cache_stats,
            commands::clear_embedding_cache,
            commands::get_vector_store_config,
            commands::update_vector_store_config,
            commands::reset_vector_store_config,
            commands::test_vector_store_connection,
            commands::get_vector_store_collection_stats,
            commands::delete_vector_store_collection,
            commands::start_ingestion,
            commands::pause_ingestion,
            commands::resume_ingestion,
            commands::cancel_ingestion,
            commands::get_ingestion_status,
            commands::detect_changes,
            commands::get_ingestion_history,
            commands::get_ingestion_log,
            commands::restore_ingestion_version,
            commands::get_general_settings,
            commands::update_general_settings,
            commands::get_semantic_search_config,
            commands::update_semantic_search_config,
            commands::reset_semantic_search_config,
            commands::run_semantic_search,
            commands::run_semantic_search_with_options,
            commands::get_search_filter_values,
            commands::get_chat_ready,
            commands::get_lexical_search_config,
            commands::update_lexical_search_config,
            commands::reset_lexical_search_config,
            commands::lexical_search,
            commands::get_bm25_index_stats,
            commands::rebuild_bm25_index,
            commands::get_hybrid_search_config,
            commands::update_hybrid_search_config,
            commands::reset_hybrid_search_config,
            commands::unified_search,
            commands::get_rerank_config,
            commands::update_rerank_config,
            commands::reset_rerank_config,
            commands::test_rerank_connection,
            commands::test_rerank,
            commands::get_rerank_models,
            commands::get_llm_config,
            commands::update_llm_config,
            commands::reset_llm_config,
            commands::test_llm_connection,
            commands::get_llm_models,
            commands::get_agents_config,
            commands::update_agents_config,
            commands::reset_agents_config,
            commands::chat,
            commands::chat_stream,
            commands::chat_stream_stop,
            commands::chat_orchestrated,
            commands::new_conversation,
            commands::get_conversation_history,
            commands::get_monitoring_config,
            commands::update_monitoring_config,
            commands::reset_monitoring_config,
            commands::get_dashboard_health,
            commands::get_dashboard_ingestion,
            commands::get_dashboard_metrics,
            commands::get_dashboard_activity,
            commands::get_dashboard_intents,
            commands::get_dashboard_feedback,
            commands::get_dashboard_latency,
            commands::get_dashboard_alerts,
            commands::get_query_logs,
            commands::get_query_log_detail,
            commands::export_query_logs,
            commands::purge_logs,
            commands::submit_feedback,
            commands::get_security_config,
            commands::update_security_config,
            commands::reset_security_config,
            commands::get_api_keys_status,
            commands::purge_all_data,
            commands::export_config,
            commands::validate_import,
            commands::import_config,
            commands::export_conversation,
            commands::generate_test_question,
            commands::set_expertise_level,
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
