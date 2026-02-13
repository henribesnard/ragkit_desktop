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
    let res = request(Method::GET, "/health", &app).await?;
    
    Ok(HealthCheckResponse {
        ok: res.get("ok").and_then(|v| v.as_bool()).unwrap_or(false),
        version: res.get("version").and_then(|v| v.as_str()).map(String::from),
    })
}
