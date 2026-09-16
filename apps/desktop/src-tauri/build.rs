fn main() {
  // Opt the persistence commands into the capability ACL (design record:
  // docs/design-sqlite-persistence.md). Without this, app-defined commands
  // are callable from every window; with it, each command needs an explicit
  // `allow-<command>` entry in a capability file.
  tauri_build::try_build(
    tauri_build::Attributes::new().app_manifest(
      tauri_build::AppManifest::new().commands(&["load_desk", "save_object", "delete_object"]),
    ),
  )
  .expect("failed to run tauri-build");
}
