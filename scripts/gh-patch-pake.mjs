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

console.log(`Patched Pake config: url=${url} app=${appName} id=${bundleId}`);
