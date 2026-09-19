//! Drives `import_attachment` across a real Tauri IPC boundary.
//!
//! The unit tests beside `import_attachment_impl` cover what happens once the
//! bytes have arrived. They cannot cover the part that carries the risk: the
//! raw request body and the headers holding the metadata, which are shaped by
//! the webview on one side and destructured by the command on the other. A
//! header renamed on one side, or a permission missing from
//! `capabilities/default.json`, would pass every unit test and fail in the
//! user's hands.
//!
//! Tauri's mock runtime runs the genuine dispatch — argument extraction,
//! capability ACL and all — so both are caught here instead.

use tauri::ipc::{CallbackFn, InvokeBody};
use tauri::test::{mock_builder, MockRuntime, INVOKE_KEY};
use tauri::webview::InvokeRequest;
use tauri::{Manager, WebviewWindow};

use yearleaf_lib::commands::{AssetRoot, Db};

/// A throwaway desk directory holding both the database and the assets.
fn desk_dir(tag: &str) -> std::path::PathBuf {
  let dir = std::env::temp_dir().join(format!("yearleaf-ipc-{}-{tag}", std::process::id()));
  let _ = std::fs::remove_dir_all(&dir);
  std::fs::create_dir_all(&dir).expect("desk dir");
  dir
}

/// Builds the app against the real config, so the capability file under test
/// is the one that ships.
fn app_on(dir: &std::path::Path) -> tauri::App<MockRuntime> {
  let app = mock_builder()
    .invoke_handler(tauri::generate_handler![
      yearleaf_lib::commands::import_attachment,
      yearleaf_lib::commands::load_attachments
    ])
    .build(tauri::generate_context!())
    .expect("mock app");
  let conn = yearleaf_lib::db::open(&dir.join("desk.db")).expect("db");
  app.manage(Db(std::sync::Mutex::new(conn)));
  app.manage(AssetRoot(dir.join("assets")));
  app
}

/// The capability grants these commands to the `main` window specifically, so
/// the label here is load-bearing: build this webview under any other name and
/// every request below is denied by the ACL.
fn main_webview(app: &tauri::App<MockRuntime>) -> WebviewWindow<MockRuntime> {
  tauri::WebviewWindowBuilder::new(app, "main", Default::default())
    .build()
    .expect("main webview")
}

/// The URL Tauri serves the application from, which is not the same everywhere.
///
/// Windows and Android get a `http://tauri.localhost` shim; every other target
/// gets the real `tauri://localhost` (`Manager::tauri_protocol_url`). The
/// capability matches on `URL: local`, so hardcoding either one passes on the
/// platform it was written on and is refused by the ACL on the rest. This file
/// had the Windows spelling, which is why it had only ever been run there.
fn protocol_url() -> tauri::Url {
  if cfg!(windows) || cfg!(target_os = "android") {
    "http://tauri.localhost".parse().expect("windows protocol url")
  } else {
    "tauri://localhost".parse().expect("protocol url")
  }
}

fn send_import(
  webview: &WebviewWindow<MockRuntime>,
  body: InvokeBody,
  headers: &[(&'static str, &str)],
) -> Result<serde_json::Value, serde_json::Value> {
  let mut map = tauri::http::HeaderMap::new();
  for (name, value) in headers {
    map.insert(*name, value.parse().expect("ascii header value"));
  }
  tauri::test::get_ipc_response(
    webview,
    InvokeRequest {
      cmd: "import_attachment".into(),
      callback: CallbackFn(0),
      error: CallbackFn(1),
      url: protocol_url(),
      body,
      headers: map,
      invoke_key: INVOKE_KEY.to_string(),
    },
  )
  .map(|response| response.deserialize::<serde_json::Value>().expect("json response"))
}

/// An import shaped exactly as the webview sends it.
fn import_png(
  webview: &WebviewWindow<MockRuntime>,
  file_name: &str,
  bytes: &[u8],
) -> Result<serde_json::Value, serde_json::Value> {
  send_import(
    webview,
    InvokeBody::Raw(bytes.to_vec()),
    &[("desk-id", "desk-1"), ("media-type", "image/png"), ("file-name", file_name)],
  )
}

#[test]
fn a_raw_body_import_crosses_the_boundary_and_lands_on_disk() {
  let dir = desk_dir("roundtrip");
  let app = app_on(&dir);
  let webview = main_webview(&app);

  let record = import_png(&webview, "moodboard.png", b"pretend png bytes").expect("import");

  assert_eq!(record["fileName"], "moodboard.png");
  assert_eq!(record["mediaType"], "image/png");
  assert_eq!(record["byteSize"], 17);
  // The record has to point at bytes that are really there, not just a row.
  let path = record["path"].as_str().expect("path");
  assert_eq!(std::fs::read(path).expect("stored file"), b"pretend png bytes");

  drop(app);
  let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn a_percent_encoded_file_name_arrives_decoded() {
  let dir = desk_dir("name");
  let app = app_on(&dir);
  let webview = main_webview(&app);

  // Header values may only be ASCII, so the webview encodes the name. If the
  // two sides ever disagree the desk stores a name the user never typed.
  let record = import_png(&webview, "caf%C3%A9%20sketch.png", b"bytes").expect("import");

  assert_eq!(record["fileName"], "café sketch.png");

  drop(app);
  let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn an_import_missing_its_metadata_is_refused_by_name() {
  let dir = desk_dir("headers");
  let app = app_on(&dir);
  let webview = main_webview(&app);

  let error = send_import(&webview, InvokeBody::Raw(b"bytes".to_vec()), &[("desk-id", "desk-1")])
    .expect_err("metadata is not optional");

  assert!(
    error.as_str().unwrap_or_default().contains("media-type"),
    "the refusal must name the header that is missing, got {error}"
  );

  drop(app);
  let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn a_window_outside_the_capability_cannot_import_at_all() {
  let dir = desk_dir("acl");
  let app = app_on(&dir);
  // capabilities/default.json grants these commands to `windows: ["main"]`.
  // Any other window must be refused, or the scoping is decorative.
  let stray = tauri::WebviewWindowBuilder::new(&app, "stray", Default::default())
    .build()
    .expect("stray webview");

  let error = send_import(
    &stray,
    InvokeBody::Raw(b"bytes".to_vec()),
    &[("desk-id", "desk-1"), ("media-type", "image/png"), ("file-name", "a.png")],
  )
  .expect_err("an ungranted window must not reach the importer");

  assert!(
    error.as_str().unwrap_or_default().contains("not allowed"),
    "expected an ACL refusal, got {error}"
  );
  // And nothing was written on the way to being refused.
  assert!(!dir.join("assets").exists());

  drop(app);
  let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn the_old_json_argument_form_is_refused_rather_than_half_working() {
  let dir = desk_dir("json");
  let app = app_on(&dir);
  let webview = main_webview(&app);

  // Imports used to pass the bytes as a command argument. Accepting that shape
  // now would let a stale caller keep paying the cost the change removed.
  let error = send_import(
    &webview,
    InvokeBody::Json(serde_json::json!({ "deskId": "desk-1", "bytes": [1, 2, 3] })),
    &[("desk-id", "desk-1"), ("media-type", "image/png"), ("file-name", "a.png")],
  )
  .expect_err("a JSON body is not an import");

  assert!(error.as_str().unwrap_or_default().contains("request body"), "got {error}");

  drop(app);
  let _ = std::fs::remove_dir_all(&dir);
}
