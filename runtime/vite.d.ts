/**
 * `nish/vite`: the Vite plugin that builds a Nish module imported by a page
 * into wasm, inlined and loaded without a fetch (docs/guide/using-nish/interop.md).
 */

export interface NishViteOptions {
  /** Modules to build to wasm, paths from the root. Default: none. */
  entries?: string[];
  /**
   * Host modules, paths from the root, each passed to the compiler as
   * `--host`; a root `package.json` `"nish": { "host": [...] }` also names
   * them. The ones an entry imports are passed to its loader. Default: none.
   */
  host?: string[];
  /** The `nish` command. Default: this package's `bin/nish`. */
  compiler?: string;
  /** `scripts/build.sh`. Default: this package's. */
  buildScript?: string;
}

/** The hooks the plugin uses, which Vite and Rollup share. */
export interface NishVitePlugin {
  name: "nish";
  enforce: "pre";
  configResolved(config: { root?: string; command?: "build" | "serve"; cacheDir?: string }): void;
  resolveId(source: string, importer?: string): Promise<string | null>;
  load(id: string): Promise<string | null>;
}

export default function nish(options?: NishViteOptions): NishVitePlugin;
