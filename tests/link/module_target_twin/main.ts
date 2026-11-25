// WP89 S6, at the unit level: the pieces a wasm32 build uses to pick a module
// file by target. A library module's twin is `<name>.wasm32.ts` beside
// `<name>.ts`, and no library module has one yet (WP89 S7 adds the first), so
// the compiler's own helpers are checked here: the twin's name, the export
// comparison both builds run on a pair (NL3063), and the package condition a
// wasm32 build asks first. `module_target_std_twin` resolves a library pair
// through `Compilation`, and `package_target_wasm32` and
// `package_target_mismatch` cover the package half end to end.
import { Suite } from "../../../std/testing"
import { replaceAll } from "../../../std/text"
import { WASM_PACKAGE_CONDITION, packageConditionFor } from "../../../src/branding"
import { twinMismatch } from "../../../src/module-twins"
import { wasmTwinOf } from "../../../src/std-modules"

const NATIVE: string = `// native
export const draw = (x: i32, y: i32): i32 => x + y

export class Canvas {
  width: i32 = 0
  constructor(width: i32) {
    this.width = width
  }
  clear(colour: u32): void {}
}

export interface Size {
  width: i32
}
`

// The same exports, reformatted, with other bodies and initializers.
const REFORMATTED: string = `// wasm32
export const draw = (x: i32,
    y: i32): i32 => {
  return 0
}

export class Canvas {
  width: i32 = 4
  constructor(width: i32) {}
  clear(colour: u32): void {
    this.width = 0
  }
}

export interface   Size {
  width: i32
}
`

// A class whose `private` state is the twin's own business.
const STATEFUL: string = `export class Cache {
  size: i32 = 0
  private slots: i32[] = []
  get(key: i32): i32 {
    return key
  }
  private grow(by: i32): void {}
}
`

const STATEFUL_TWIN: string = `export class Cache {
  size: i32 = 0
  private table: u32 = 0
  private misses: f64 = 0
  get(key: i32): i32 {
    return 0
  }
  private rehash(): i32 {
    return 1
  }
}
`

export const main = (): i32 => {
  const t = new Suite("module_target_twin")
  t.eqStr("a module's wasm32 twin is <name>.wasm32.ts beside it", wasmTwinOf("std/gfx.ts"), "std/gfx.wasm32.ts")
  t.eqStr("a path that is not a .ts file has no twin name", wasmTwinOf("std/gfx"), "std/gfx")
  t.eqStr("a twin with the same exports agrees, however it is laid out", twinMismatch("a.ts", NATIVE, "b.ts", REFORMATTED), "")
  t.eqStr(
    "a twin that drops an export is refused, naming it",
    twinMismatch("a.ts", NATIVE, "b.ts", replaceAll(REFORMATTED, "export interface", "interface")),
    "`Size` is exported by `a.ts` and not by `b.ts`"
  )
  t.eqStr(
    "a twin that adds an export is refused, naming it",
    twinMismatch("a.ts", NATIVE, "b.ts", `${REFORMATTED}export const extra: i32 = 1\n`),
    "`extra` is exported by `b.ts` and not by `a.ts`"
  )
  t.eqStr(
    "a function parameter's type is compared",
    twinMismatch("a.ts", NATIVE, "b.ts", replaceAll(REFORMATTED, "y: i32", "y: f64")),
    "`draw` is `export const draw = (x: i32, y: i32): i32 =>` in `a.ts` and `export const draw = (x: i32, y: f64): i32 =>` in `b.ts`"
  )
  t.ok(
    "a method's parameter is compared",
    twinMismatch("a.ts", NATIVE, "b.ts", replaceAll(REFORMATTED, "colour: u32", "colour: i32")).length > 0
  )
  t.ok(
    "a field's type is compared",
    twinMismatch("a.ts", NATIVE, "b.ts", replaceAll(REFORMATTED, "width: i32 = 4", "width: u32 = 4")).length > 0
  )
  t.eqStr("a class's private members may differ", twinMismatch("a.ts", STATEFUL, "b.ts", STATEFUL_TWIN), "")
  t.eqStr(
    "a class's public method is compared",
    twinMismatch("a.ts", STATEFUL, "b.ts", replaceAll(STATEFUL_TWIN, "get(key: i32)", "get(key: u32)")),
    "`Cache` is `export class Cache { size: i32; get(key: i32): i32;` in `a.ts` and `export class Cache { size: i32; get(key: u32): i32;` in `b.ts`"
  )
  t.ok(
    "a class's public members count in the order they are written",
    twinMismatch(
      "a.ts",
      "export class P {\n  x: i32 = 0\n  y: i32 = 0\n}\n",
      "b.ts",
      "export class P {\n  y: i32 = 0\n  x: i32 = 0\n}\n"
    ).length > 0
  )
  t.eqStr(
    "an annotated constant's initializer may differ",
    twinMismatch("a.ts", "export const LIMIT: i32 = 10\n", "b.ts", "export const LIMIT: i32 = 20\n"),
    ""
  )
  t.eqStr(
    "an unannotated constant is compared with its initializer, which is its type",
    twinMismatch("a.ts", "export const LIMIT = 10\n", "b.ts", "export const LIMIT = 10.5\n"),
    "`LIMIT` is `const LIMIT = 10` in `a.ts` and `const LIMIT = 10.5` in `b.ts`"
  )
  t.eqStr(
    "an unannotated constant with the same initializer agrees",
    twinMismatch("a.ts", "export const LIMIT = 10\n", "b.ts", "export const LIMIT =\n  10\n"),
    ""
  )
  t.eqStr(
    "a constant declared after an exported arrow is compared too",
    twinMismatch(
      "a.ts",
      "export const f = (): i32 => 1, g = 2\n",
      "b.ts",
      "export const f = (): i32 => 3, g = 2.5\n"
    ),
    "`g` is `const g = 2` in `a.ts` and `const g = 2.5` in `b.ts`"
  )
  t.eqStr("a twin that does not parse is left to the build that compiles it", twinMismatch("a.ts", NATIVE, "b.ts", "export const ("), "")
  t.ok("nish-wasm32 is not the i32 mode's condition", WASM_PACKAGE_CONDITION !== packageConditionFor("i32"))
  t.ok("nish-wasm32 is not the f64 mode's condition", WASM_PACKAGE_CONDITION !== packageConditionFor("f64"))
  return t.done()
}
