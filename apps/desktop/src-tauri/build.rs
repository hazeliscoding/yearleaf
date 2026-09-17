fn main() {
  // Test executables get no application manifest of their own, and Tauri's
  // menu layer imports Common Controls v6 — which the loader only binds when
  // the binary's manifest asks for it. Without this, any test that builds a
  // Tauri app dies with STATUS_ENTRYPOINT_NOT_FOUND before running. The app
  // binary already gets its manifest from tauri-build.
  if std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc") {
    let manifest = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests.manifest.xml");
    println!("cargo:rerun-if-changed=tests.manifest.xml");
    println!("cargo:rustc-link-arg-tests=/MANIFEST:EMBED");
    println!("cargo:rustc-link-arg-tests=/MANIFESTINPUT:{}", manifest.display());
  }

  // Opt the persistence commands into the capability ACL (design record:
  // docs/design-sqlite-persistence.md). Without this, app-defined commands
  // are callable from every window; with it, each command needs an explicit
  // `allow-<command>` entry in a capability file.
  tauri_build::try_build(
    tauri_build::Attributes::new().app_manifest(
      tauri_build::AppManifest::new().commands(&[
        "load_desk",
        "save_object",
        "delete_object",
        "load_events",
        "save_event",
        "delete_event",
        "import_attachment",
        "load_attachments",
      ]),
    ),
  )
  .expect("failed to run tauri-build");
}
