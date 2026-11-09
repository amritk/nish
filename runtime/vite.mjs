/**
 * `nish/vite` (WP50 stage 1): a Vite plugin that lets a page import a Nish
 * module as the TypeScript it is and get, in a build, the wasm build of it.
 *
 * The entries are the modules compiled to wasm, `nish({ entries })`, paths
 * from the root. (The root package.json's `nish` field cannot name them yet:
 * the compiler refuses a key there other than `noPanic`, `capabilities` and
 * `host`.) In
 * `vite build` an import that resolves to one is answered with a generated
 * module. The plugin compiles the entry with `nish --target wasm32 --emit-dts`,
 * links the IR with `scripts/build.sh --profile wasm-host --inline`, and the
 * generated module calls the loader's `loadSync` on the inlined bytes and
 * re-exports each export by name. The page fetches nothing and awaits nothing.
 * In `vite serve` the import is left to Vite, which serves the TypeScript.
 *
 * An entry that imports host modules (WP50 stage 2) is instantiated with
 * them: the generated module imports each one the `.d.ts` names in `Imports`
 * and passes them as `host`, so the page passes nothing. One seam is left for
 * a later stage of docs/wp50-wasm-host.md: the `.nish` client specifier in
 * `resolveId`.
 *
 * The plugin drives only the hooks Vite and Rollup share (`configResolved`,
 * `resolveId`, `load`), so `tests/run.js` calls them directly, with no Vite.
 */
import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PREFIX = "\0nish-entry:";

/**
 * The host modules an entry imports, as absolute paths: the
 * `typeof import("...")` members of the `.d.ts`'s `Imports` type, each a
 * specifier from the `.d.ts`'s directory written without its `.ts`, which is
 * put back so the import names the file. None when there is no `Imports`.
 */
function hostModules(dts, dir) {
  const line = dts.split("\n").find((l) => l.startsWith("export type Imports = "));
  if (line === undefined) return [];
  return [...line.matchAll(/typeof import\("([^"]+)"\)/g)].map((m) => `${path.resolve(dir, m[1])}.ts`);
}

/**
 * The import lines and the import object an entry is instantiated with: each
 * host module imported whole and passed under `host`, or `{}` with none.
 */
function importsFor(hosts) {
  const lines = hosts.map((h, i) => `import * as __nishHost${i} from ${JSON.stringify(h)};`);
  if (hosts.length === 0) return { lines, object: "{}" };
  const host = hosts.length === 1 ? "__nishHost0" : `{ ${hosts.map((_, i) => `...__nishHost${i}`).join(", ")} }`;
  return { lines, object: `{ host: ${host} }` };
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

/** Vite's default `resolve.extensions`, in the order it tries them. */
const VITE_EXTENSIONS = [".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx", ".json"];

/** Whether `p` is a file (`"file"`), a directory (`"dir"`) or neither. */
const kind = (p) => {
  const st = statSync(p, { throwIfNoEntry: false });
  return st?.isFile() ? "file" : st?.isDirectory() ? "dir" : undefined;
};

/** The plugin. `compiler` and `buildScript` default to the ones in this package. */
export default function nish(options = {}) {
  const compiler = options.compiler ?? path.join(packageDir, "bin", "nish");
  const buildScript = options.buildScript ?? path.join(packageDir, "scripts", "build.sh");
  const runtimeWasm = path.join(packageDir, "runtime", "runtime-wasm.c");
  let root = process.cwd();
  let building = false;
  let cacheDir = path.join(root, "node_modules", ".vite");
  let entries = new Set();
  let extensions = VITE_EXTENSIONS;

  const configure = (config) => {
    root = config.root ?? root;
    extensions = config.resolve?.extensions ?? VITE_EXTENSIONS;
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
    const host = (options.host ?? []).flatMap((h) => ["--host", path.resolve(root, h)]);
    await run(compiler, [entry, "--target", "wasm32", ...host, "--emit-dts", dts, "-o", ll], { cwd: root });
    const loader = path.join(dir, `${stem}.mjs`);
    const loaderText = readFileSync(loader, "utf8");
    // The generated module imports `loadSync`. A compiler older than it writes
    // a loader without one, which Rollup would report only as a missing
    // export of a file in the cache, naming neither the compiler nor the fix.
    if (!/^export function loadSync\(/m.test(loaderText)) {
      const version = await run(compiler, ["--version"], { cwd: root }).then(
        (r) => r.stdout.trim(),
        () => "an unknown version",
      );
      throw new Error(
        `nish/vite: the compiler ${compiler} (${version}) wrote a loader with no \`loadSync\` export: ` +
          "it predates `loadSync` (WP50 stage 1), which the generated module calls. " +
          "Use a newer one: update the nish package, or pass its path as `nish({ compiler })`.",
      );
    }
    const ir = readFileSync(ll, "utf8");
    // runtime-wasm.c is linked when the IR needs a runtime function (a weak
    // `extern_weak` one, a panic stub wasm-ld writes itself, does not count)
    // or the loader calls the arena.
    const needsRuntime = /^declare (?!extern_weak)[^"\n]*@nish_/m.test(ir) || loaderText.includes("raw.nish_arena_mark(");
    const inline = path.join(dir, `${stem}.bytes.mjs`);
    const inputs = needsRuntime ? [ll, runtimeWasm] : [ll];
    await run("bash", [buildScript, ...inputs, "-o", path.join(dir, `${stem}.wasm`), "--profile", "wasm-host", "--inline", inline], {
      cwd: root,
    });
    const types = readFileSync(dts, "utf8");
    return { loader, inline, names: exportNames(types), hosts: hostModules(types, dir) };
  };

  return {
    name: "nish",
    enforce: "pre",
    configResolved: configure,
    async resolveId(source, importer) {
      if (!building) return null;
      // The seam for a `./client.nish` specifier (the page's client module of a
      // later stage) is here; stage 1 resolves only the entries.
      // A specifier may leave out the `.ts`, or name a directory for its
      // `index.ts`. It is resolved as Vite would, file then extensions in
      // order then the directory's index, so a sibling `add.js` keeps `./add`.
      const base = importer ? path.dirname(importer) : root;
      const candidates = source.startsWith(".")
        ? [path.resolve(base, source)]
        : path.isAbsolute(source)
          ? [source, path.join(root, source)]
          : [];
      const withExtension = (stem) => extensions.map((e) => stem + e).find((f) => kind(f) === "file");
      const resolve = (c) => {
        if (entries.has(c) || kind(c) === "file") return c;
        return withExtension(c) ?? (kind(c) === "dir" ? withExtension(path.join(c, "index")) : undefined);
      };
      const hit = candidates.map(resolve).find((c) => c !== undefined && entries.has(c));
      return hit === undefined ? null : PREFIX + hit;
    },
    async load(id) {
      if (!id.startsWith(PREFIX)) return null;
      const entry = id.slice(PREFIX.length);
      const { loader, inline, names, hosts } = await buildEntry(entry);
      const imports = importsFor(hosts);
      // The module's own bindings are prefixed, so an export named `bytes`,
      // `loadSync` or `exports` does not redeclare one of them.
      const lines = [
        `import { loadSync as __nishLoadSync } from ${JSON.stringify(loader)};`,
        `import { bytes as __nishBytes } from ${JSON.stringify(inline)};`,
        ...imports.lines,
        `const __nishExports = __nishLoadSync(__nishBytes, ${imports.object});`,
        "export default __nishExports;",
      ];
      if (names.length > 0) lines.push(`export const { ${names.join(", ")} } = __nishExports;`);
      return `${lines.join("\n")}\n`;
    },
  };
}
