#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod commands;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::scan_library, commands::detect_install_path, commands::list_game_files,
            commands::read_config_file, commands::write_config_file,
            commands::create_backup, commands::restore_backup, commands::apply_preset,
            commands::start_download, commands::pause_download, commands::cancel_download,
            commands::window_action,
        ])
        .run(tauri::generate_context!())
        .expect("error while running AfScripts");
}
