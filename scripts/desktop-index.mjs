// Ensures the static desktop build has dist/client/index.html (Tauri's frontendDist).
// The SPA shell's location/name differs between platforms, so search known spots.
import { existsSync, copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const target = join("dist", "client", "index.html");
const roots = ["dist/client", ".output/public", "dist"];
const names = ["_shell.html", "index.html", "_shell/index.html"];

function find() {
  for (const r of roots) for (const n of names) {
    const p = join(r, n);
    if (existsSync(p)) return p;
  }
  // Fallback: any html file under dist/.output
  const walk = (d) => {
    if (!existsSync(d)) return null;
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) { const r = walk(p); if (r) return r; }
      else if (f.endsWith(".html")) return p;
    }
    return null;
  };
  return walk("dist") ?? walk(".output");
}

if (existsSync(target)) { console.log("index.html already present"); process.exit(0); }
const src = find();
if (!src) { console.error("No SPA shell html found in build output"); process.exit(1); }
mkdirSync(join("dist", "client"), { recursive: true });
copyFileSync(src, target);
console.log(`Copied ${src} -> ${target}`);
