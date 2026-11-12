// WP27 S4.1's checks (docs/wp27-ffi.md §9): a `declare class` is a C struct
// layout lent by pointer to a `declare function`. They live beside
// `tests/run.js`, which calls `runFfiStructChecks` with its own helpers, so
// that file stays under Biome's size limit. A record cites each check by its
// exact name.
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

/** A layout with a pointer in it and one embedded, lent to C by an internal function. */
const LAYOUTS = [
  "declare class Inner {",
  "  tag: u16",
  "  link: CPtr | null",
  "}",
  "",
  "declare class Outer {",
  "  a: u8",
  "  p: CPtr",
  "  inner: Inner",
  "  z: u8",
  "}",
  "",
  "declare function fill_outer(o: Outer): i32",
  "",
  "const lend = (o: Outer): i32 => fill_outer(o)",
  "",
].join("\n")

/**
 * The same structs in C, asserting the size and offsets Nish's build gave them:
 * clang refuses the file where the two disagree.
 */
const cLayouts = ([p, inner, z, size]) =>
  [
    "struct Inner { unsigned short tag; void *link; };",
    "struct Outer { unsigned char a; void *p; struct Inner inner; unsigned char z; };",
    `_Static_assert(sizeof(struct Outer) == ${size}, "size");`,
    `_Static_assert(__builtin_offsetof(struct Outer, p) == ${p}, "p");`,
    `_Static_assert(__builtin_offsetof(struct Outer, inner) == ${inner}, "inner");`,
    `_Static_assert(__builtin_offsetof(struct Outer, z) == ${z}, "z");`,
    "",
  ].join("\n")

/**
 * An LLVM module that measures Nish's `%struct.Outer` as `llc` lays it out for a
 * target: the offsets of fields 1 to 3, then the size, as four `i64` constants.
 */
const measureOuter = (types) =>
  [
    types,
    "@layout = global [4 x i64] [",
    ...[1, 2, 3].map(
      (i) =>
        `  i64 ptrtoint (%struct.Outer* getelementptr (%struct.Outer, %struct.Outer* null, i32 0, i32 ${i}) to i64),`
    ),
    "  i64 ptrtoint (%struct.Outer* getelementptr (%struct.Outer, %struct.Outer* null, i32 1) to i64)",
    "]",
    "",
  ].join("\n")

/**
 * Runs the checks, each under `tests/run.js`'s filter: `only`, when set, is
 * matched against a group's name as `tests/run.js` matches its own sections.
 */
export const runFfiStructChecks = ({ only, has, check, skip, shown, nish, root, buildDir }) => {
  const dir = path.join(buildDir, "ffi-struct")
  const write = (name, text) => {
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, name)
    fs.writeFileSync(file, text)
    return file
  }
  const compile = (file, out, extra) =>
    spawnSync(nish, [file, "-o", out, ...extra], { cwd: root, encoding: "utf8" })

  /** Nish's struct as `llc` lays it out for `triple`: three offsets and a size, or null. */
  const measure = (types, triple) => {
    const probe = write(`measure-${triple}.ll`, measureOuter(types))
    const asm = spawnSync("llc", [`-mtriple=${triple}`, "-o", "-", probe], { encoding: "utf8" })
    if (asm.status !== 0) {
      return null
    }
    const values = [...asm.stdout.matchAll(/^\s*\.(?:quad|int64)\s+(?:0\+)?(\d+)\s*$/gm)].map((m) =>
      Number(m[1])
    )
    return values.length === 4 ? values : null
  }

  // `--deny ffi` refuses a program whose only C use is a layout lent to a
  // `declare function`: lending a struct is a call into C like any other. The
  // same layouts built and read without the lend pass, so the refusal is the
  // lend's. The `--emit-header` of a module that keeps a layout private has no
  // `struct` for it, a class that holds one is opaque, and the header still
  // compiles as C.
  if (!only || "ffi_struct checks".includes(only)) {
    const lent = write("lent.ts", `${LAYOUTS}export const main = (): number => lend(new Outer())\n`)
    const denied = compile(lent, dir + path.sep, ["--deny", "ffi"])
    check(
      "ffi_struct: --deny ffi refuses a program whose only C use is a layout lent to a declare function",
      denied.status === 1 &&
        denied.stderr.includes("reaches `ffi`") &&
        denied.stderr.includes("calls fill_outer"),
      shown(denied)
    )
    const kept = write(
      "kept.ts",
      `${LAYOUTS}export const main = (): number => (new Outer().z === 0 ? 0 : 1)\n`
    )
    const allowed = compile(kept, dir + path.sep, ["--deny", "ffi"])
    check(
      "ffi_struct: --deny ffi passes the same layouts built and read without the lend",
      allowed.status === 0,
      shown(allowed)
    )

    const exported = write(
      "header.ts",
      `${LAYOUTS}export const twice = (n: i32): i32 => n * 2\n\nexport const main = (): number => lend(new Outer())\n`
    )
    const header = path.join(dir, "header.h")
    const emitted = compile(exported, path.join(dir, "header") + path.sep, ["--emit-header", header])
    const text = emitted.status === 0 ? fs.readFileSync(header, "utf8") : ""
    check(
      "ffi_struct: --emit-header leaves a private layout out and declares the exported function",
      emitted.status === 0 &&
        !text.includes("struct Outer") &&
        !text.includes("struct Inner") &&
        /int32_t twice\(int32_t n\);/.test(text),
      emitted.status === 0 ? text : shown(emitted)
    )

    const holding = write(
      "holder.ts",
      `${LAYOUTS}class Holder {\n  o: Outer\n  constructor() { this.o = new Outer() }\n}\n\n` +
        "export const viaHolder = (): i32 => lend(new Holder().o)\n"
    )
    const holderHeader = path.join(dir, "holder.h")
    const held = compile(holding, path.join(dir, "holder") + path.sep, ["--emit-header", holderHeader])
    const heldText = held.status === 0 ? fs.readFileSync(holderHeader, "utf8") : ""
    check(
      "ffi_struct: --emit-header makes a private class that holds a layout opaque",
      held.status === 0 &&
        heldText.includes("typedef struct Holder Holder;") &&
        heldText.includes("opaque: it holds a `declare class`") &&
        !heldText.includes("struct Holder {") &&
        !heldText.includes("struct Outer") &&
        /int32_t viaHolder\(void\);/.test(heldText),
      held.status === 0 ? heldText : shown(held)
    )
    // `number` is refused where the resolver meets it, so an alias imported
    // from another module, already resolved there, is refused too; an alias
    // of a fixed-width scalar is a layout field like the scalar itself.
    const numberDir = path.join(dir, "number-alias")
    fs.mkdirSync(numberDir, { recursive: true })
    fs.writeFileSync(
      path.join(numberDir, "widths.ts"),
      "export type Width = number\nexport type Fixed = i32\nexport const unit: Width = 1\n"
    )
    const field = (name, type) =>
      fs.writeFileSync(
        path.join(numberDir, name),
        `import { Fixed, Width, unit } from "./widths"\n\ndeclare class Point {\n  x: ${type}\n}\n\n` +
          "export const main = (): number => (new Point().x === 0 ? unit : 0)\n"
      )
    field("imported.ts", "Width")
    field("fixed.ts", "Fixed")
    const imported = compile(
      path.join(numberDir, "imported.ts"),
      path.join(numberDir, "imported") + path.sep,
      []
    )
    check(
      "ffi_struct: a layout field typed by an imported alias of number is refused",
      imported.status === 1 && imported.stderr.includes("whose width `--number-mode` chooses"),
      shown(imported)
    )
    const fixed = compile(path.join(numberDir, "fixed.ts"), path.join(numberDir, "fixed") + path.sep, [])
    check("ffi_struct: a layout field typed by an alias of i32 is accepted", fixed.status === 0, shown(fixed))

    if (has("clang")) {
      for (const [what, file] of [
        ["beside a layout", header],
        ["with an opaque holder", holderHeader],
      ]) {
        const syntax = spawnSync(
          "clang",
          ["-std=c11", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-Iruntime", "-x", "c", file],
          { cwd: root, encoding: "utf8" }
        )
        check(`ffi_struct: the --emit-header ${what} compiles as C`, syntax.status === 0, shown(syntax))
      }
    }
  }

  // A layout's `CPtr` is the target's `void *`: eight bytes natively, four on
  // wasm32 (`--profile wasi`). Nish's build is measured, never assumed: the
  // size its `new` zero-fills and its lending parameter's `dereferenceable`
  // claim are read from the IR, and `llc` lays the IR's own `%struct.Outer` out
  // for the target. clang must give the C struct those offsets and that size,
  // and the pointer width must show (the wasm32 struct is the smaller).
  if (!only || "ffi_struct checks".includes(only) || "wasi".includes(only)) {
    const sized = write("sized.ts", `${LAYOUTS}export const main = (): number => lend(new Outer())\n`)
    const targets = [
      ["native", [], "x86_64-unknown-linux-gnu"],
      ["wasm32", ["--profile", "wasi"], "wasm32"],
    ]
    const sizes = []
    for (const [name, flags, triple] of targets) {
      const ll = path.join(dir, `sized-${name}.ll`)
      const built = compile(sized, ll, flags)
      const ir = built.status === 0 ? fs.readFileSync(ll, "utf8") : ""
      const filled =
        /call void @llvm\.memset\.p0i8\.i64\(i8\* align 8 %[\w.]+, i8 0, i64 (\d+), i1 false\)/.exec(ir)
      const lent = /dereferenceable\((\d+)\) nocapture %o\)/.exec(ir)
      const types = ir
        .split("\n")
        .filter((line) => /^%struct\.(Outer|Inner) = type /.test(line))
        .join("\n")
      const measured = filled && lent && types && has("llc") ? measure(types, triple) : null
      const size = filled ? Number(filled[1]) : -1
      sizes.push(size)
      check(
        `ffi_struct: a ${name} build zero-fills and lends the size llc gives its own struct`,
        built.status === 0 &&
          filled !== null &&
          lent !== null &&
          Number(lent[1]) === size &&
          (!has("llc") || (measured !== null && measured[3] === size)),
        built.status === 0 ? `${ir}\nllc: ${measured}` : shown(built)
      )
      if (!has("llc")) {
        skip(`skipped: ffi_struct: no llc: the ${name} size is not measured, nor the C layout compared`)
      } else if (measured !== null && has("clang")) {
        const c = spawnSync("clang", [`--target=${triple}`, "-fsyntax-only", "-x", "c", "-"], {
          input: cLayouts(measured),
          encoding: "utf8",
        })
        check(
          `ffi_struct: clang gives the C struct the ${name} offsets and size Nish's build has`,
          c.status === 0,
          `llc: ${measured}\n${shown(c)}`
        )
      } else {
        skip(
          `skipped: ffi_struct: no clang, or llc gave no four layout constants: the ${name} C layout is not compared`
        )
      }
    }
    check(
      "ffi_struct: the wasm32 struct is smaller than the native one, its CPtr four bytes",
      sizes[1] > 0 && sizes[1] < sizes[0],
      `native ${sizes[0]}, wasm32 ${sizes[1]}`
    )
  }
}
