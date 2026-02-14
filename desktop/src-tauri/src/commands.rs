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
