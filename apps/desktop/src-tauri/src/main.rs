// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// The desktop shell (T-M11-03).
///
/// Deliberately empty of game logic: the whole game is the web bundle, and this exists
/// only to give it a window and a place on disk to save. The permissions it does *not*
/// ask for are the point — no http, no shell, no updater, so the promise that the game
/// never phones home (R-FREE-04) is enforced by the platform rather than by us.
///
/// The save files go through the app's OWN six commands below instead of
/// `tauri-plugin-fs` (T-M28-03, 2026-09-08). Reason, established by falsification
/// against the running binary over CDP: the plugin's scope check canonicalises paths
/// that exist, which on Windows yields the `\\?\C:\...` verbatim form, and the glob
/// patterns of the scope never match it — so writing a NEW save worked while reading
/// it back was "forbidden path", with `fs:allow-appdata-read-recursive` granted, an
/// explicit `fs:scope`, and even a runtime `allow_directory` for both spellings
/// (`is_allowed` returned false immediately after `allow_directory` returned Ok).
/// Own commands are narrower anyway: they accept a file NAME, never a path, and they
/// only ever touch `$APPDATA/saves`.
use std::fs;
use std::path::PathBuf;

use tauri::Manager;

/// The one directory these commands may touch. Never derived from caller input.
fn saves_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("saves");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// A save name is a single file name, percent-encoded by the frontend. Anything that
/// could climb out of the directory is refused, not sanitised.
fn checked_name(name: &str) -> Result<&str, String> {
    if name.is_empty() || name.contains(['/', '\\', ':']) || name.contains("..") {
        return Err(format!("unzulaessiger Name: {name}"));
    }
    Ok(name)
}

fn save_path(app: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
    Ok(saves_dir(app)?.join(format!("{}.json", checked_name(name)?)))
}

#[tauri::command]
fn saves_list(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let dir = saves_dir(&app)?;
    let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;
    let mut names = Vec::new();
    for entry in entries.flatten() {
        let file = entry.file_name();
        let file = file.to_string_lossy();
        if let Some(stem) = file.strip_suffix(".json") {
            names.push(stem.to_string());
        }
    }
    names.sort();
    Ok(names)
}

#[tauri::command]
fn saves_read(app: tauri::AppHandle, name: String) -> Result<String, String> {
    fs::read_to_string(save_path(&app, &name)?).map_err(|e| e.to_string())
}

#[tauri::command]
fn saves_write(app: tauri::AppHandle, name: String, data: String) -> Result<(), String> {
    fs::write(save_path(&app, &name)?, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn saves_remove(app: tauri::AppHandle, name: String) -> Result<(), String> {
    match fs::remove_file(save_path(&app, &name)?) {
        Ok(()) => Ok(()),
        // Removing what is not there is not an error — the storage contract says so.
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn saves_exists(app: tauri::AppHandle, name: String) -> Result<bool, String> {
    Ok(save_path(&app, &name)?.exists())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            saves_list,
            saves_read,
            saves_write,
            saves_remove,
            saves_exists
        ])
        .run(tauri::generate_context!())
        .expect("WorldWar konnte nicht gestartet werden");
}
