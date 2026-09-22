// Drive `web/worker.mjs` from Node: the same worker a page runs, in a
// `node:worker_threads` worker, so the browser path can be exercised (and
// tested) without a browser.
//
//   node dist/index.js self/compile.ts --link build/nish.wasm --profile wasi
//   build/nish self/compile.ts --link build/nish.wasm --profile wasi   (or with stage1)
//   node web/compile.mjs build/nish.wasm examples/add.ts
//   node web/compile.mjs build/nish.wasm examples/nbody.ts --number-mode f64
//
// The IR goes to stdout and the compiler's diagnostics to stderr, so the exit
// code and the streams are the ones `nish` itself would have produced. Files
// are read here and handed over as text: the worker has no filesystem, which is
// the point — in a page the sources come from an editor buffer instead.
import fs from "node:fs";
import path from "node:path";
import { Worker } from "node:worker_threads";

const [wasmPath, entry, ...flags] = process.argv.slice(2);
if (!wasmPath || !entry) {
  console.error("usage: node web/compile.mjs <nish.wasm> <entry.ts> [flags...]");
  process.exit(2);
}

/**
 * Every module the entry reaches, keyed by the path the compiler will see.
 * The specifier rule is `resolveModule` in `self/paths.ts`: `./x` and `./x.js`
 * both mean `x.ts`. A specifier that is not relative is left to the compiler,
 * which refuses bare specifiers with a diagnostic of its own.
 *
 * Keys stay relative to the working directory so that the IR carries the same
 * `source_filename` the native compiler would have written; an entry outside it
 * is rooted at its own directory instead, since the in-memory filesystem has no
 * way to spell a path above its preopen.
 */
const collectModules = (entryPath) => {
  const fromCwd = path.relative(process.cwd(), path.normalize(entryPath));
  const root = fromCwd.startsWith("..") ? path.dirname(entryPath) : process.cwd();
  const files = {};
  const queue = [path.normalize(entryPath)];
  while (queue.length > 0) {
    const file = queue.pop();
    const key = path.relative(root, file).split(path.sep).join("/");
    if (files[key] !== undefined) continue;
    // A specifier naming a file that is not there is the compiler's diagnostic
    // to give (`readFileSyncOrNull`, WP14 B3), not a Node stack trace: leave it
    // out of the filesystem and let the message come from the right place.
    if (!fs.existsSync(file)) continue;
    files[key] = fs.readFileSync(file, "utf8");
    for (const match of files[key].matchAll(/^\s*(?:import|export)\b[^;]*?from\s*"(\.[^"]*)"/gm)) {
      const specifier = match[1].endsWith(".js") ? `${match[1].slice(0, -3)}.ts` : match[1];
      const resolved = specifier.endsWith(".ts") ? specifier : `${specifier}.ts`;
      queue.push(path.normalize(path.join(path.dirname(file), resolved)));
    }
  }
  return { files, entry: path.relative(root, path.normalize(entryPath)).split(path.sep).join("/") };
};

const { files, entry: entryKey } = collectModules(entry);
const worker = new Worker(new URL("./worker.mjs", import.meta.url));
const reply = (message) =>
  new Promise((resolve) => {
    worker.once("message", resolve);
    worker.postMessage(message);
  });

// A program of one module writes one `.ll`; anything bigger needs `-o <dir>/`,
// the same rule the CLI applies (`planOutputs` in self/compile.ts).
const single = Object.keys(files).length === 1;
await reply({ id: "load", wasm: fs.readFileSync(wasmPath) });
const result = await reply({
  id: "compile",
  files,
  entry: entryKey,
  output: single ? "out.ll" : "out/",
  args: flags,
});
await worker.terminate();

process.stderr.write(result.stderr);
for (const [name, text] of Object.entries(result.files)) {
  if (!single) process.stdout.write(`; ---- ${name} ----\n`);
  process.stdout.write(text);
}
process.exitCode = result.status;
