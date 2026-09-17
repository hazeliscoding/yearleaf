// Public so `tests/ipc.rs` can drive the command surface across a real Tauri
// IPC boundary rather than only calling the functions behind it.
pub mod commands;
pub mod db;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let data_dir = app.path().app_data_dir()?;
      std::fs::create_dir_all(&data_dir)?;
      let conn = db::open(&data_dir.join("infinite-desk.db"))?;

      // Imported binaries sit beside the database, per the architecture
      // record's desk layout, so a desk is one directory to copy or back up.
      let assets = data_dir.join("assets");
      std::fs::create_dir_all(&assets)?;

      // Reclaim pictures nothing refers to any more. Startup is the safe
      // moment: the undo history is empty, so nothing can claim them back.
      match db::sweep_unreferenced_attachments(&conn, &assets) {
        Ok(0) => {}
        Ok(count) => log::info!("reclaimed {count} unreferenced attachment(s)"),
        Err(error) => log::warn!("attachment sweep failed: {error}"),
      }

      app.manage(commands::Db(std::sync::Mutex::new(conn)));
      app.manage(commands::AssetRoot(assets));
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::load_desk,
      commands::save_object,
      commands::delete_object,
      commands::load_events,
      commands::save_event,
      commands::delete_event,
      commands::import_attachment,
      commands::load_attachments,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
