#!/usr/bin/env node
/**
 * Patch tw93/Pake src-tauri/pake.json and tauri.conf.json for a Wrappr build job.
 * Usage: node gh-patch-pake.mjs <pakeRoot> <url> <appName> <bundleId>
 */
import fs from 'node:fs';
import path from 'node:path';

const [pakeRoot, url, appName, bundleId] = process.argv.slice(2);
if (!pakeRoot || !url || !appName || !bundleId) {
  console.error('Usage: node gh-patch-pake.mjs <pakeRoot> <url> <appName> <bundleId>');
  process.exit(1);
}

const pakeJsonPath = path.join(pakeRoot, 'src-tauri', 'pake.json');
const tauriConfPath = path.join(pakeRoot, 'src-tauri', 'tauri.conf.json');

const pakeJson = JSON.parse(fs.readFileSync(pakeJsonPath, 'utf8'));
if (!pakeJson.windows?.[0]) {
  pakeJson.windows = [{}];
}
pakeJson.windows[0].url = url;
pakeJson.windows[0].url_type = 'web';
pakeJson.windows[0].title = appName;
pakeJson.windows[0].width = pakeJson.windows[0].width ?? 1200;
pakeJson.windows[0].height = pakeJson.windows[0].height ?? 780;
pakeJson.windows[0].resizable = pakeJson.windows[0].resizable ?? true;
fs.writeFileSync(pakeJsonPath, JSON.stringify(pakeJson, null, 2));

const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
tauriConf.productName = appName;
tauriConf.identifier = bundleId;
if (!tauriConf.app) tauriConf.app = {};
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2));

const libRsPath = path.join(pakeRoot, 'src-tauri', 'src', 'lib.rs');
if (fs.existsSync(libRsPath)) {
  let libRs = fs.readFileSync(libRsPath, 'utf8');

  // Regex patching for mobile targeting
  libRs = libRs.replace(/#\[cfg_attr\(mobile,\s*tauri::mobile_entry_point\)\]\r?\nmod app;/g, '#[cfg(not(mobile))]\nmod app;');
  libRs = libRs.replace(/mod util;/g, '#[cfg(not(mobile))]\nmod util;');
  libRs = libRs.replace(/use tauri::Manager;/g, '#[cfg(not(mobile))]\nuse tauri::Manager;');
  libRs = libRs.replace(/use tauri_plugin_window_state::Builder as WindowStatePlugin;/g, '#[cfg(not(mobile))]\nuse tauri_plugin_window_state::Builder as WindowStatePlugin;');
  libRs = libRs.replace(/use tauri_plugin_window_state::StateFlags;/g, '#[cfg(not(mobile))]\nuse tauri_plugin_window_state::StateFlags;');
  libRs = libRs.replace(/use app::\{/g, '#[cfg(not(mobile))]\nuse app::{');
  libRs = libRs.replace(/use util::get_pake_config;/g, '#[cfg(not(mobile))]\nuse util::get_pake_config;');
  libRs = libRs.replace(/pub fn run_app\(\)\s*\{/g, '#[cfg(not(mobile))]\npub fn run_app() {');
  
  // Replace the run function
  libRs = libRs.replace(/pub fn run\(\)\s*\{\r?\n\s*run_app\(\)\r?\n\}/g, '#[cfg(not(mobile))]\npub fn run() {\n    run_app()\n}');

  // Append mobile run function
  const mobileRun = `
#[cfg(mobile)]
#[tauri::mobile_entry_point]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_oauth::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let pake_json_str = include_str!("../pake.json");
            let pake_json: serde_json::Value = serde_json::from_str(pake_json_str).unwrap_or_default();
            let url_str = pake_json["windows"][0]["url"].as_str().unwrap_or("https://google.com");
            let url = tauri::WebviewUrl::External(url_str.parse().unwrap());
            
            let mut builder = tauri::WebviewWindowBuilder::new(app, "main", url);
            let title = pake_json["windows"][0]["title"].as_str().unwrap_or("Pake App");
            builder = builder.title(title);
            
            let _ = builder.build();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
`;
  libRs += mobileRun;
  fs.writeFileSync(libRsPath, libRs, 'utf8');
  console.log('Patched Pake src-tauri/src/lib.rs for mobile compatibility.');
}

console.log(`Patched Pake config: url=${url} app=${appName} id=${bundleId}`);
