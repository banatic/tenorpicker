#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod window_watcher;
mod tenor;
mod clipboard;

use tauri::WebviewWindow;

// ─── Tauri 커맨드 ───────────────────────────────────────────
#[tauri::command]
async fn cmd_search_tenor(query: String, offset: u32) -> Result<serde_json::Value, String> {
    tenor::search_tenor(&query, offset).await.map_err(|e| e.to_string())
}

#[tauri::command]
fn cmd_copy_html(html: String) -> Result<(), String> {
    clipboard::copy_html_to_clipboard(&html).map_err(|e| e.to_string())
}

#[tauri::command]
fn cmd_hide_window(window: WebviewWindow) {
    let _ = window.hide();
}

// ─── 앱 진입점 ──────────────────────────────────────────────
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                window_watcher::start_watcher(app_handle);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cmd_search_tenor,
            cmd_copy_html,
            cmd_hide_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
