// Injects the landing screen's HTML into dist/index.html so crawlers and the first paint
// don't wait for JS. main.tsx still uses createRoot (not hydrateRoot), which replaces this
// markup on load, so client-only state (invite links, saved prefs) can't cause mismatches.
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "vite";

const file = "dist/index.html";
const root = '<div id="root"></div>';

const vite = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  logLevel: "error",
});
try {
  const { render } = await vite.ssrLoadModule("/src/prerender.tsx");
  const html = await readFile(file, "utf8");
  if (!html.includes(root)) throw new Error(`${root} not found in ${file}`);
  await writeFile(file, html.replace(root, `<div id="root">${render()}</div>`));
} finally {
  await vite.close();
}
