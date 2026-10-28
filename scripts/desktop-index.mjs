// Prepares dist/client (Tauri's frontendDist) from the static desktop build.
// The client output folder differs between platforms (Linux: dist/client, Windows CI:
// .output/public), so locate the folder holding the SPA shell and copy the WHOLE folder
// (assets, icons, html) into dist/client — copying only the html leaves the app unstyled.
import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";

const outDir = join("dist", "client");
const roots = ["dist/client", ".output/public", "dist"];
const names = ["_shell.html", "index.html", "_shell/index.html"];

function findShell() {
  for (const r of roots) for (const n of names) {
    const p = join(r, n);
    if (existsSync(p) && existsSync(join(r, "assets"))) return { root: r, file: p };
  }
  return null;
}

const found = findShell();
if (!found) { console.error("No SPA shell html with an assets folder found in build output"); process.exit(1); }

mkdirSync(outDir, { recursive: true });
if (resolve(found.root) !== resolve(outDir)) {
  cpSync(found.root, outDir, { recursive: true, force: true });
  console.log(`Copied client build from ${found.root} to ${outDir}`);
}

// Tauri serves the app from a custom protocol; keep asset references relative.
const shellInOut = join(outDir, found.file.slice(found.root.length + 1));
let html = readFileSync(shellInOut, "utf8");
html = html
  .replace(/(["'(=])\/\.\//g, "$1./")
  .replace(/(["'(=])\/(assets\/)/g, "$1./$2");
writeFileSync(join(outDir, "index.html"), html);

// Fail the build if any referenced asset is missing, so a broken installer is never published.
const assetsDir = join(outDir, "assets");
const present = new Set(readdirSync(assetsDir));
const missing = [...html.matchAll(/\.\/assets\/([^"'?)\s]+)/g)].map((m) => m[1]).filter((f) => !present.has(f));
if (missing.length) { console.error(`Missing assets in ${assetsDir}: ${missing.join(", ")}`); process.exit(1); }
if (!/\.\/assets\/[^"']+\.css/.test(html)) { console.error("index.html has no stylesheet link"); process.exit(1); }
console.log(`Wrote ${join(outDir, "index.html")} with ${present.size} assets (source ${dirname(found.file)})`);
