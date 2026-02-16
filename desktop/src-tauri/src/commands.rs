use tauri::AppHandle;
use serde::{Deserialize, Serialize};
use crate::backend::request;
use reqwest::Method;

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthCheckResponse {
    pub ok: bool,
    pub version: Option<String>,
}

#[tauri::command]
pub async fn health_check(app: AppHandle) -> Result<HealthCheckResponse, String> {
    let res = request(Method::GET, "/health", None, &app).await?;
    
    Ok(HealthCheckResponse {
        ok: res.get("ok").and_then(|v| v.as_bool()).unwrap_or(false),
        version: res.get("version").and_then(|v| v.as_str()).map(String::from),
    })
}

// --- Wizard Commands ---

#[tauri::command]
pub async fn validate_folder(app: AppHandle, path: String, recursive: Option<bool>) -> Result<serde_json::Value, String> {
    let body = serde_json::json!({ "folder_path": path, "recursive": recursive.unwrap_or(true) });
    request(Method::POST, "/api/wizard/validate-folder", Some(body), &app).await
}

#[tauri::command]
pub async fn scan_folder(app: AppHandle, params: serde_json::Value) -> Result<serde_json::Value, String> {
    request(Method::POST, "/api/wizard/scan-folder", Some(params), &app).await
}

#[tauri::command]
pub async fn analyze_wizard_profile(app: AppHandle, params: serde_json::Value) -> Result<serde_json::Value, String> {
    request(Method::POST, "/api/wizard/analyze-profile", Some(params), &app).await
}

#[tauri::command]
pub async fn complete_wizard(app: AppHandle, params: serde_json::Value) -> Result<serde_json::Value, String> {
    request(Method::POST, "/api/wizard/complete", Some(params), &app).await
}

#[tauri::command]
pub async fn detect_environment(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::GET, "/api/wizard/environment-detection", None, &app).await
}

#[tauri::command]
pub async fn get_current_profile(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::GET, "/api/wizard/current-profile", None, &app).await
}

// --- Setup Status ---

#[tauri::command]
pub async fn get_setup_status(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::GET, "/api/ingestion/setup-status", None, &app).await
}

// --- Ingestion Commands ---

#[tauri::command]
pub async fn get_ingestion_config(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::GET, "/api/ingestion/config", None, &app).await
}

#[tauri::command]
pub async fn update_ingestion_config(app: AppHandle, config: serde_json::Value) -> Result<serde_json::Value, String> {
    request(Method::PUT, "/api/ingestion/config", Some(config), &app).await
}

#[tauri::command]
pub async fn reset_ingestion_config(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::POST, "/api/ingestion/config/reset", None, &app).await
}

#[tauri::command]
pub async fn get_documents(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::GET, "/api/ingestion/documents", None, &app).await
}

#[tauri::command]
pub async fn update_document_metadata(app: AppHandle, id: String, metadata: serde_json::Value) -> Result<serde_json::Value, String> {
    let endpoint = format!("/api/ingestion/documents/{}/metadata", id);
    request(Method::PUT, &endpoint, Some(metadata), &app).await
}

#[tauri::command]
pub async fn analyze_documents(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::POST, "/api/ingestion/analyze", None, &app).await
}

#[tauri::command]
pub async fn get_analysis_progress(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::GET, "/api/ingestion/analyze/progress", None, &app).await
}


// --- Chunking Commands ---

#[tauri::command]
pub async fn get_chunking_config(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::GET, "/api/chunking/config", None, &app).await
}

#[tauri::command]
pub async fn update_chunking_config(app: AppHandle, config: serde_json::Value) -> Result<serde_json::Value, String> {
    request(Method::PUT, "/api/chunking/config", Some(config), &app).await
}

#[tauri::command]
pub async fn reset_chunking_config(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::POST, "/api/chunking/config/reset", None, &app).await
}

#[tauri::command]
pub async fn validate_chunking_config(app: AppHandle, config: serde_json::Value) -> Result<serde_json::Value, String> {
    request(Method::POST, "/api/chunking/config/validate", Some(config), &app).await
}

#[tauri::command]
pub async fn preview_chunking(app: AppHandle, document_id: String) -> Result<serde_json::Value, String> {
    let body = serde_json::json!({ "document_id": document_id });
    request(Method::POST, "/api/chunking/preview", Some(body), &app).await
}

#[tauri::command]
pub async fn preview_chunking_custom(app: AppHandle, document_id: String, config: serde_json::Value) -> Result<serde_json::Value, String> {
    let body = serde_json::json!({ "document_id": document_id, "config": config });
    request(Method::POST, "/api/chunking/preview/custom", Some(body), &app).await
}


// --- Embedding Commands ---

#[tauri::command]
pub async fn get_embedding_config(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::GET, "/api/embedding/config", None, &app).await
}

#[tauri::command]
pub async fn update_embedding_config(app: AppHandle, config: serde_json::Value) -> Result<serde_json::Value, String> {
    request(Method::PUT, "/api/embedding/config", Some(config), &app).await
}

#[tauri::command]
pub async fn reset_embedding_config(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::POST, "/api/embedding/config/reset", None, &app).await
}

#[tauri::command]
pub async fn store_secret(app: AppHandle, key_name: String, value: String) -> Result<serde_json::Value, String> {
    let body = serde_json::json!({"key_name": key_name, "value": value});
    request(Method::POST, "/api/embedding/secrets/store", Some(body), &app).await
}

#[tauri::command]
pub async fn secret_exists(app: AppHandle, key_name: String) -> Result<serde_json::Value, String> {
    let body = serde_json::json!({"key_name": key_name});
    request(Method::POST, "/api/embedding/secrets/exists", Some(body), &app).await
}

#[tauri::command]
pub async fn delete_secret(app: AppHandle, key_name: String) -> Result<serde_json::Value, String> {
    let body = serde_json::json!({"key_name": key_name});
    request(Method::POST, "/api/embedding/secrets/delete", Some(body), &app).await
}

#[tauri::command]
pub async fn test_embedding_connection(app: AppHandle, provider: Option<String>, model: Option<String>) -> Result<serde_json::Value, String> {
    let mut endpoint = String::from("/api/embedding/test-connection");
    let mut query = vec![];
    if let Some(p) = provider { query.push(format!("provider={}", p)); }
    if let Some(m) = model { query.push(format!("model={}", m)); }
    if !query.is_empty() { endpoint.push('?'); endpoint.push_str(&query.join("&")); }
    request(Method::POST, &endpoint, None, &app).await
}

#[tauri::command]
pub async fn test_embedding(app: AppHandle, text_a: String, text_b: String) -> Result<serde_json::Value, String> {
    let body = serde_json::json!({"text_a": text_a, "text_b": text_b});
    request(Method::POST, "/api/embedding/test-embedding", Some(body), &app).await
}

#[tauri::command]
pub async fn get_embedding_environment(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::GET, "/api/embedding/environment", None, &app).await
}

#[tauri::command]
pub async fn get_available_models(app: AppHandle, provider: String) -> Result<serde_json::Value, String> {
    let endpoint = format!("/api/embedding/models?provider={}", provider);
    request(Method::GET, &endpoint, None, &app).await
}

#[tauri::command]
pub async fn get_embedding_cache_stats(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::GET, "/api/embedding/cache/stats", None, &app).await
}

#[tauri::command]
pub async fn clear_embedding_cache(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::POST, "/api/embedding/cache/clear", None, &app).await
}

// --- Vector store Commands ---
#[tauri::command]
pub async fn get_vector_store_config(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::GET, "/api/vector-store/config", None, &app).await
}

#[tauri::command]
pub async fn update_vector_store_config(app: AppHandle, config: serde_json::Value) -> Result<serde_json::Value, String> {
    request(Method::PUT, "/api/vector-store/config", Some(config), &app).await
}

#[tauri::command]
pub async fn reset_vector_store_config(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::POST, "/api/vector-store/config/reset", None, &app).await
}

#[tauri::command]
pub async fn test_vector_store_connection(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::POST, "/api/vector-store/test-connection", None, &app).await
}

#[tauri::command]
pub async fn get_vector_store_collection_stats(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::GET, "/api/vector-store/collection/stats", None, &app).await
}

#[tauri::command]
pub async fn delete_vector_store_collection(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::DELETE, "/api/vector-store/collection/delete", None, &app).await
}

// --- ingestion controls ---
#[tauri::command]
pub async fn start_ingestion(app: AppHandle, incremental: Option<bool>) -> Result<serde_json::Value, String> {
    let body = serde_json::json!({"incremental": incremental.unwrap_or(false)});
    request(Method::POST, "/api/ingestion/start", Some(body), &app).await
}

#[tauri::command]
pub async fn pause_ingestion(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::POST, "/api/ingestion/pause", None, &app).await
}

#[tauri::command]
pub async fn resume_ingestion(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::POST, "/api/ingestion/resume", None, &app).await
}

#[tauri::command]
pub async fn cancel_ingestion(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::POST, "/api/ingestion/cancel", None, &app).await
}

#[tauri::command]
pub async fn get_ingestion_status(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::GET, "/api/ingestion/status", None, &app).await
}

#[tauri::command]
pub async fn detect_changes(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::GET, "/api/ingestion/changes", None, &app).await
}

#[tauri::command]
pub async fn get_ingestion_history(app: AppHandle, limit: Option<u32>) -> Result<serde_json::Value, String> {
    let endpoint = if let Some(l) = limit { format!("/api/ingestion/history?limit={}", l) } else { "/api/ingestion/history".to_string() };
    request(Method::GET, &endpoint, None, &app).await
}

#[tauri::command]
pub async fn get_ingestion_log(app: AppHandle, version: Option<String>) -> Result<serde_json::Value, String> {
    let endpoint = if let Some(v) = version { format!("/api/ingestion/log?version={}", v) } else { "/api/ingestion/log".to_string() };
    request(Method::GET, &endpoint, None, &app).await
}

#[tauri::command]
pub async fn restore_ingestion_version(app: AppHandle, version: String) -> Result<serde_json::Value, String> {
    let endpoint = format!("/api/ingestion/history/{}/restore", version);
    request(Method::POST, &endpoint, None, &app).await
}

#[tauri::command]
pub async fn get_general_settings(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::GET, "/api/ingestion/settings/general", None, &app).await
}

#[tauri::command]
pub async fn update_general_settings(app: AppHandle, settings: serde_json::Value) -> Result<serde_json::Value, String> {
    request(Method::PUT, "/api/ingestion/settings/general", Some(settings), &app).await
}

// --- Semantic retrieval Commands ---

#[tauri::command]
pub async fn get_semantic_search_config(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::GET, "/api/retrieval/semantic/config", None, &app).await
}

#[tauri::command]
pub async fn update_semantic_search_config(app: AppHandle, config: serde_json::Value) -> Result<serde_json::Value, String> {
    request(Method::PUT, "/api/retrieval/semantic/config", Some(config), &app).await
}

#[tauri::command]
pub async fn reset_semantic_search_config(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::POST, "/api/retrieval/semantic/config/reset", None, &app).await
}

#[tauri::command]
pub async fn run_semantic_search(app: AppHandle, query: String) -> Result<serde_json::Value, String> {
    let body = serde_json::json!({"query": query});
    request(Method::POST, "/api/retrieval/semantic/search", Some(body), &app).await
}

#[tauri::command]
pub async fn run_semantic_search_with_options(app: AppHandle, payload: serde_json::Value) -> Result<serde_json::Value, String> {
    request(Method::POST, "/api/retrieval/semantic/search", Some(payload), &app).await
}

#[tauri::command]
pub async fn get_search_filter_values(app: AppHandle, field: String) -> Result<serde_json::Value, String> {
    let endpoint = format!("/api/search/filters/values?field={}", field);
    request(Method::GET, &endpoint, None, &app).await
}

#[tauri::command]
pub async fn get_chat_ready(app: AppHandle) -> Result<serde_json::Value, String> {
    request(Method::GET, "/api/chat/ready", None, &app).await
}
