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
            
            let _ = tauri::WebviewWindowBuilder::new(app, "main", url).build();
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

const injectPaths = [
  path.join(pakeRoot, 'src-tauri', 'inject', 'custom.js'),
  path.join(pakeRoot, 'src-tauri', 'src', 'inject', 'custom.js')
];

let customJsPath = null;
for (const p of injectPaths) {
  if (fs.existsSync(p)) {
    customJsPath = p;
    break;
  }
}

if (customJsPath) {
  const adBlockCode = `
// Wrappr Adblocker Integration
(function() {
  const adSelectors = [
    '.ad-container', '.ad-wrapper', '.adsbygoogle', '[id^="google_ads_"]',
    'iframe[src*="googleads"]', 'iframe[src*="doubleclick"]',
    '.ad-box', '.ad-banner', '.advertisement', '[class*="advertisement"]',
    'a[href*="googleadservices.com"]', '[data-ad-client]', '[data-ad-slot]'
  ];

  function hideAds() {
    adSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('opacity', '0', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
        el.style.setProperty('height', '0', 'important');
        el.style.setProperty('width', '0', 'important');
      });
    });
  }

  hideAds();
  window.addEventListener('DOMContentLoaded', hideAds);
  window.addEventListener('load', hideAds);
  
  const observer = new MutationObserver(hideAds);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  const adBlockDomains = [
    'googleads.g.doubleclick.net',
    'googlesyndication.com',
    'google-analytics.com',
    'pagead2.googlesyndication.com',
    'adservice.google.com',
    'doubleclick.net',
    'partner.googleadservices.com',
    'ads.pubmatic.com',
    'securepubads.g.doubleclick.net',
    'adnxs.com',
    'criteo.com',
    'amazon-adsystem.com'
  ];

  function isAdUrl(url) {
    if (!url) return false;
    const urlString = String(url).toLowerCase();
    return adBlockDomains.some(domain => urlString.includes(domain));
  }

  if (window.fetch) {
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
      const url = typeof input === 'string' ? input : (input?.url || '');
      if (isAdUrl(url)) {
        return Promise.reject(new TypeError('Ad blocked by Wrappr'));
      }
      return originalFetch.apply(this, arguments);
    };
  }

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (isAdUrl(url)) {
      this.send = function() {};
      this.setRequestHeader = function() {};
      return;
    }
    return originalOpen.apply(this, arguments);
  };
})();
`;
  fs.appendFileSync(customJsPath, adBlockCode, 'utf8');
  console.log('Integrated Wrappr Adblocker into Pake custom.js.');
}

console.log(`Patched Pake config: url=${url} app=${appName} id=${bundleId}`);
