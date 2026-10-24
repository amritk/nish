/**
 * `nish/runtime/browser`: importing it installs the browser host on the core
 * in `nish/runtime` (docs/guide/using-nish/to-typescript.md).
 */

/**
 * What the program's `exit(code)`, and every panic, throws: a page cannot end
 * itself. Tell it apart with `instanceof`, not by its `name`.
 */
export class NishExit extends Error {
  /** The 8-bit status a native exit would leave: `code & 0xff`. */
  readonly code: number;
  constructor(code: number);
}
