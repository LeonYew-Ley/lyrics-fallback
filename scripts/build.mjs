import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "src/config.js",
  "src/log.js",
  "src/ids.js",
  "src/track.js",
  "src/official.js",
  "src/mapping.js",
  "src/http.js",
  "src/text.js",
  "src/providers/netease.js",
  "src/providers/kugou.js",
  "src/providers/lrclib.js",
  "src/providers/lrcmux.js",
  "src/providers/registry.js",
  "src/settings-store.js",
  "src/fallback.js",
  "src/network.js",
  "src/query-cache.js",
  "src/settings-ui.js",
  "src/entry.js",
];

const banner = `/* lyrics-fallback.js
 * Generated from src/. Edit the modules and run: node scripts/build.mjs
 * Backup lyrics source for Spotify's native lyrics UI.
 * Official color-lyrics / has_lyrics win when present. Configured providers are used only as fallback.
 */
(function LyricsFallback() {
  const LF = {};
`;

const footer = `})();
`;

const body = files
  .map((rel) => {
    const abs = path.join(root, rel);
    const text = fs.readFileSync(abs, "utf8").replace(/^\uFEFF/, "").replace(/\s+$/, "");
    const indented = text
      .split("\n")
      .map((line) => (line.length ? "  " + line : ""))
      .join("\n");
    return `\n  /* ===== ${rel} ===== */\n${indented}`;
  })
  .join("\n");

const outDir = path.join(root, "dist");
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, "lyrics-fallback.js");
fs.writeFileSync(out, banner + body + "\n" + footer, "utf8");
console.log("wrote", out, fs.statSync(out).size, "bytes");
