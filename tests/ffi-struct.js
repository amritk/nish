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
 * `ffi_struct_param`'s `Rlimit` and `getrlimit`, printing RLIMIT_NOFILE's soft
 * then hard limit and setting neither. `console.log` prints a `u64` above 2^53
 * exactly, but RLIM_INFINITY (all ones, a literal Nish refuses as inexact) is
 * printed `unlimited`, as `ulimit` prints it.
 */
const LIMITS = [
  "declare class Rlimit {",
  "  cur: u64",
  "  max: u64",
  "}",
  "",
  "declare function getrlimit(resource: i32, rlim: Rlimit): i32",
  "",
  "const RLIMIT_NOFILE: i32 = 7",
  "",
  "export const main = (): number => {",
  "  const none: u64 = 0",
  "  const infinity: u64 = ~none",
  "  const limit = new Rlimit()",
  "  if (getrlimit(RLIMIT_NOFILE, limit) !== 0) {",
  "    return 1",
  "  }",
  '  console.log(limit.cur === infinity ? "unlimited" : `${limit.cur}`)',
  '  console.log(limit.max === infinity ? "unlimited" : `${limit.max}`)',
  "  return 0",
  "}",
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

  // The criterion `ffi_struct_param` cannot pin (its `.out` is fixed and the
  // limits are not): `getrlimit` through a `declare class` reads what `ulimit`
  // reports. One shell lowers the soft limit, then runs the program and asks
  // `ulimit`, so all three see the same limits whatever Node raised its own
  // to. 123 is no platform's default, so the program cannot match by
  // coincidence, and sits under any hard limit a runner has (Linux's default is
  // 4096, CI's 65536 or more). RLIMIT_NOFILE is 7 on Linux only (8 on macOS
  // and the BSDs), so elsewhere the program would read another limit.
  if (!only || "ffi_struct checks".includes(only)) {
    if (process.platform !== "linux") {
      skip("skipped: ffi_struct: RLIMIT_NOFILE is 7 on Linux only: getrlimit is not compared with ulimit")
    } else {
      const source = write("limits.ts", LIMITS)
      const exe = path.join(dir, "limits")
      const built = compile(source, path.join(dir, "limits.ir") + path.sep, ["--link", exe])
      const ran =
        built.status === 0
          ? spawnSync("sh", ["-c", 'ulimit -Sn 123 && "$1" && ulimit -Sn && ulimit -Hn', "sh", exe], {
              encoding: "utf8",
            })
          : built
      const infinity = String(2n ** 64n - 1n)
      const lines = (ran.stdout ?? "").split("\n").map((line) => (line === "unlimited" ? infinity : line))
      const [cur, max, soft, hard] = lines
      check(
        "ffi_struct: getrlimit through a declare class reads the soft and hard RLIMIT_NOFILE ulimit -Sn / -Hn report",
        ran.status === 0 &&
          lines.length === 5 &&
          lines[4] === "" &&
          cur === "123" &&
          soft === "123" &&
          /^\d+$/.test(hard) &&
          max === hard,
        shown(ran)
      )
    }
  }

  // WP27 S4.2: `readStruct` from `nish:unsafe` copies a C-owned struct into a
  // fresh instance of the `declare class` its context names. Its NULL test is
  // an `ffi-null` site beside its allocation's allowed `oom`, so --deny-panics
  // refuses it; --deny unsafe refuses it and names the call; --emit-checked
  // records the import and the call. The copy is `@llvm.memcpy` of the
  // layout's own size: sixteen bytes for two `CPtr` fields natively, eight on
  // wasm32, where a `CPtr` is four.
  if (!only || "ffi_struct checks".includes(only) || "wasi".includes(only)) {
    const read = write(
      "read.ts",
      [
        'import { readStruct } from "nish:unsafe";',
        "",
        "declare class Lconv {",
        "  decimalPoint: CPtr",
        "  thousandsSep: CPtr",
        "}",
        "",
        "declare function localeconv(): CPtr;",
        "",
        "export const main = (): i32 => {",
        "  const lc: Lconv = readStruct(localeconv());",
        "  return lc.decimalPoint === lc.thousandsSep ? 1 : 0;",
        "};",
        "",
      ].join("\n")
    )
    const readDir = path.join(dir, "read") + path.sep
    const json = path.join(dir, "read.panics.json")
    const listed = compile(read, readDir, ["--emit-panics", json])
    const report = listed.status === 0 ? JSON.parse(fs.readFileSync(json, "utf8")) : null
    const kinds = ((report?.functions ?? []).find((f) => f.name === "main")?.panics ?? [])
      .map((p) => `${p.line}:${p.kind}:${p.allowed}`)
      .join(",")
    check(
      "ffi_struct_read: `readStruct` is an unproven `ffi-null` site and the copy's allowed `oom`, and nothing else",
      kinds === "11:ffi-null:undefined,11:oom:true",
      report === null ? shown(listed) : JSON.stringify(report)
    )
    const denyPanics = compile(read, readDir, ["--deny-panics"])
    check(
      "ffi_struct_read: --deny-panics refuses `readStruct` for its NULL test",
      denyPanics.status === 1 &&
        denyPanics.stderr.includes("`ffi-null` may panic here") &&
        denyPanics.stderr.includes("`readStruct` panics on a NULL pointer"),
      shown(denyPanics)
    )
    const denyUnsafe = compile(read, readDir, ["--deny", "unsafe"])
    check(
      "ffi_struct_read: --deny unsafe refuses `readStruct` and names the call",
      denyUnsafe.status === 1 &&
        denyUnsafe.stderr.includes("reaches `unsafe`") &&
        denyUnsafe.stderr.includes("calls readStruct"),
      shown(denyUnsafe)
    )
    const checked = spawnSync(nish, [read, "--emit-checked"], { cwd: root, encoding: "utf8" })
    check(
      "ffi_struct_read: --emit-checked records the `readStruct` import and its call",
      checked.status === 0 &&
        checked.stdout.includes('unsafe import 1:10 readStruct from "nish:unsafe"') &&
        /unsafe call 11:21 readStruct \(node \d+\)/.test(checked.stdout),
      shown(checked)
    )
    for (const [name, flags, size] of [
      ["native", [], 16],
      ["wasm32", ["--profile", "wasi"], 8],
    ]) {
      const ll = path.join(dir, `read-${name}.ll`)
      const built = compile(read, ll, flags)
      const ir = built.status === 0 ? fs.readFileSync(ll, "utf8") : ""
      check(
        `ffi_struct_read: a ${name} build allocates and copies the layout's ${size} bytes`,
        new RegExp(`call i8\\* @nish_alloc_struct\\(i64 ${size}\\)`).test(ir) &&
          new RegExp(
            `call void @llvm\\.memcpy\\.p0i8\\.p0i8\\.i64\\(i8\\* align 8 %[\\w.]+, i8\\* align 1 %[\\w.]+, i64 ${size}, i1 false\\)`
          ).test(ir),
        built.status === 0 ? ir : shown(built)
      )
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
