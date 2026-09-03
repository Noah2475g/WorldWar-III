// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// The desktop shell (T-M11-03).
///
/// Deliberately empty of game logic: the whole game is the web bundle, and this exists
/// only to give it a window and a place on disk to save. The permissions it does *not*
/// ask for are the point — no http, no shell, no updater, so the promise that the game
/// never phones home (R-FREE-04) is enforced by the platform rather than by us.
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("WorldWar konnte nicht gestartet werden");
}
