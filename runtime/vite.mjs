/**
 * `nish/vite` (WP50 stage 1): a Vite plugin that lets a page import a Nish
 * module as the TypeScript it is and get, in a build, the wasm build of it.
 *
 * The entries are the modules compiled to wasm, `nish({ entries })`, paths
 * from the root. (The root package.json's `nish` field cannot name them yet:
 * the compiler refuses a key there other than `noPanic` and `capabilities`.) In
 * `vite build` an import that resolves to one is answered with a generated
 * module. The plugin compiles the entry with `nish --target wasm32 --emit-dts`,
 * links the IR with `scripts/build.sh --profile wasm-host --inline`, and the
 * generated module calls the loader's `loadSync` on the inlined bytes and
 * re-exports each export by name. The page fetches nothing and awaits nothing.
 * In `vite serve` the import is left to Vite, which serves the TypeScript.
 *
 * Two seams are left for later stages of docs/wp50-wasm-host.md and implement
 * nothing yet: `importsFor`, the import object an entry's host modules will
 * build, and the `.nish` client specifier in `resolveId`.
 *
 * The plugin drives only the hooks Vite and Rollup share (`configResolved`,
 * `resolveId`, `load`), so `tests/run.js` calls them directly, with no Vite.
 */
import { execFile } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PREFIX = "\0nish-entry:";

/**
 * The import object an entry is instantiated with. Stage 1 links no host
 * import, so it is empty; the host modules of a later stage fill it here.
 */
function importsFor(_entry) {
  return "{}";
}

/**
 * The names the loader returns, read from the `Exports` interface of the
 * `.d.ts` the same compile wrote: one member a line, `memory` included.
 */
function exportNames(dts) {
  const body = dts.slice(dts.indexOf("export interface Exports {"));
  const names = [];
  for (const m of body.slice(0, body.indexOf("\n}")).matchAll(/^ {2}(?:readonly )?([A-Za-z_$][\w$]*)[(:]/gm)) {
    names.push(m[1]);
  }
  return names;
}

/** The plugin. `compiler` and `buildScript` default to the ones in this package. */
export function nish(options = {}) {
  const compiler = options.compiler ?? path.join(packageDir, "bin", "nish");
  const buildScript = options.buildScript ?? path.join(packageDir, "scripts", "build.sh");
  const runtimeWasm = path.join(packageDir, "runtime", "runtime-wasm.c");
  let root = process.cwd();
  let building = false;
  let cacheDir = path.join(root, "node_modules", ".vite");
  let entries = new Set();

  const configure = (config) => {
    root = config.root ?? root;
    building = config.command === "build";
    cacheDir = config.cacheDir ?? path.join(root, "node_modules", ".vite");
    entries = new Set((options.entries ?? []).map((e) => path.resolve(root, e)));
  };
  configure({ root });

  /** Compile and link one entry; resolves to the paths the generated module imports. */
  const buildEntry = async (entry) => {
    const stem = path.basename(entry, path.extname(entry));
    const dir = path.join(cacheDir, "nish", path.relative(root, entry).replace(/[\\/]/g, "_"));
    mkdirSync(dir, { recursive: true });
    const ll = path.join(dir, `${stem}.ll`);
    const dts = path.join(dir, `${stem}.d.ts`);
    await run(compiler, [entry, "--target", "wasm32", "--emit-dts", dts, "-o", ll], { cwd: root });
    const loader = path.join(dir, `${stem}.mjs`);
    const ir = readFileSync(ll, "utf8");
    // runtime-wasm.c is linked when the IR needs a runtime function (a weak
    // `extern_weak` one, a panic stub wasm-ld writes itself, does not count)
    // or the loader calls the arena.
    const needsRuntime =
      /^declare (?!extern_weak)[^"]*@nish_/m.test(ir) ||
      readFileSync(loader, "utf8").includes("raw.nish_arena_mark(");
    const inline = path.join(dir, `${stem}.bytes.mjs`);
    const inputs = needsRuntime ? [ll, runtimeWasm] : [ll];
    await run("bash", [buildScript, ...inputs, "-o", path.join(dir, `${stem}.wasm`), "--profile", "wasm-host", "--inline", inline], {
      cwd: root,
    });
    return { loader, inline, names: exportNames(readFileSync(dts, "utf8")) };
  };

  return {
    name: "nish",
    enforce: "pre",
    configResolved: configure,
    async resolveId(source, importer) {
      if (!building) return null;
      // The seam for a `./client.nish` specifier (the page's client module of a
      // later stage) is here; stage 1 resolves only the entries.
      const base = importer ? path.dirname(importer) : root;
      const candidates = source.startsWith(".")
        ? [path.resolve(base, source)]
        : path.isAbsolute(source)
          ? [source, path.join(root, source)]
          : [];
      const hit = candidates.find((c) => entries.has(c));
      return hit === undefined ? null : PREFIX + hit;
    },
    async load(id) {
      if (!id.startsWith(PREFIX)) return null;
      const entry = id.slice(PREFIX.length);
      const { loader, inline, names } = await buildEntry(entry);
      const lines = [
        `import { loadSync } from ${JSON.stringify(loader)};`,
        `import { bytes } from ${JSON.stringify(inline)};`,
        `const exports = loadSync(bytes, ${importsFor(entry)});`,
        "export default exports;",
      ];
      if (names.length > 0) lines.push(`export const { ${names.join(", ")} } = exports;`);
      return `${lines.join("\n")}\n`;
    },
  };
}

export default nish;
