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

/** The same structs in C, with the size and offsets `target` must give them. */
const cLayouts = (size, p, inner, z) =>
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

  // `--deny ffi` refuses a program whose only C use is a layout lent to a
  // `declare function`: lending a struct is a call into C like any other.
  // The `--emit-header` of a module that keeps a layout private has no
  // `struct` for it, and the header still compiles as C.
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
    if (has("clang")) {
      const syntax = spawnSync(
        "clang",
        ["-std=c11", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-Iruntime", "-x", "c", header],
        {
          cwd: root,
          encoding: "utf8",
        }
      )
      check("ffi_struct: the --emit-header beside a layout compiles as C", syntax.status === 0, shown(syntax))
    }
  }

  // A layout's `CPtr` is the target's `void *`: eight bytes natively, four on
  // wasm32 (`--profile wasi`), where clang lays the same C struct out in 20 bytes rather than 40.
  // The size `new` zero-fills and the `dereferenceable` a lending function's
  // parameter claims are the target's, and clang agrees with the offsets.
  if (!only || "ffi_struct checks".includes(only) || "wasi".includes(only)) {
    const sized = write("sized.ts", `${LAYOUTS}export const main = (): number => lend(new Outer())\n`)
    const targets = [
      ["native", [], 40, 8, 16, 32, "x86_64-unknown-linux-gnu"],
      ["wasm32", ["--profile", "wasi"], 20, 4, 8, 16, "wasm32"],
    ]
    for (const [name, flags, size, p, inner, z, triple] of targets) {
      const ll = path.join(dir, `sized-${name}.ll`)
      const built = compile(sized, ll, flags)
      const ir = built.status === 0 ? fs.readFileSync(ll, "utf8") : ""
      check(
        `ffi_struct: a ${name} build zero-fills and lends the ${size} bytes clang gives the struct`,
        built.status === 0 &&
          ir.includes("call void @llvm.memset.p0i8.i64(i8* align 8 %") &&
          ir.includes(`i8 0, i64 ${size}, i1 false)`) &&
          ir.includes(`dereferenceable(${size}) nocapture %o)`),
        built.status === 0 ? ir : shown(built)
      )
      if (has("clang")) {
        const c = spawnSync("clang", [`--target=${triple}`, "-fsyntax-only", "-x", "c", "-"], {
          input: cLayouts(size, p, inner, z),
          encoding: "utf8",
        })
        check(`ffi_struct: clang lays the struct out in ${size} bytes on ${name}`, c.status === 0, shown(c))
      } else {
        skip(`skipped: ffi_struct: no clang: the ${name} C layout is not compared`)
      }
    }
  }
}
