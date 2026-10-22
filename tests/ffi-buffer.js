// WP40 B1.2's checks (docs/wp40-ffi-buffers-handles.md): a `u8[]` handed to a
// `declare function`, its `ffi-length` site, and its wasm32 and freestanding
// `--profile wasm` builds. They live beside `tests/run.js`, which calls
// `runFfiBufferChecks` with its own helpers, so that file stays under Biome's
// size limit. A record cites each check by its exact name.
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

/**
 * Runs the checks, each under `tests/run.js`'s filter: `only`, when set, is
 * matched against a group's name as `tests/run.js` matches its own sections.
 */
export const runFfiBufferChecks = ({ only, has, check, skip, shown, nish, root, buildDir }) => {
  // WP40 B1.2: a `u8[]` handed to a `declare function` is lowered as its data
  // pointer, and its length is checked against the count after every argument
  // is evaluated (`ffi-length`, docs/wp40-ffi-buffers-handles.md §3a). Only
  // `toU64(b.length)` of the buffer itself is proved. C writes through a `u8[]`
  // it is passed, so an exported function that hands its parameter to such a C
  // function writes that parameter: its header drops the `const`, its glue
  // copies the bytes back, and its `define` loses `readonly` (§5). The rest pins
  // the ways `.claude/selfhost.md` names for a call to reach a rule: a constructor reached
  // by `new`, every declarator of a `using`, and `this` stored out of a
  // constructor, each for the `ffi-length` site and for the task that races a
  // buffer C writes.
  if (!only || "ffi_buffer checks".includes(only)) {
    const bufDir = path.join(buildDir, "ffi-buffer")
    fs.mkdirSync(bufDir, { recursive: true })
    const write = (name, text) => {
      const file = path.join(bufDir, name)
      fs.writeFileSync(file, text)
      return file
    }
    const compileBuf = (file, extra) =>
      spawnSync(nish, [file, "-o", path.join(bufDir, `${path.basename(file, ".ts")}`) + path.sep, ...extra], {
        cwd: root,
        encoding: "utf8",
      })
    const sitesOf = (file) => {
      const json = path.join(bufDir, `${path.basename(file, ".ts")}.panics.json`)
      const r = compileBuf(file, ["--emit-panics", json])
      return { r, report: r.status === 0 ? JSON.parse(fs.readFileSync(json, "utf8")) : null }
    }
    const fnSites = (report, name) => (report?.functions ?? []).find((f) => f.name === name)?.panics ?? []
    const readDecl = "declare function read(fd: i32, buf: u8[], n: u64): i64;"
    const writeDecl = "declare function write(fd: i32, buf: readonly u8[], n: u64): i64;"

    const exported = path.join(root, "tests", "cases", "ffi_buffer_export_written.ts")
    const exportOut = path.join(bufDir, "export_written")
    const exportBuilt = spawnSync(
      nish,
      [
        exported,
        "-o",
        `${exportOut}.ll`,
        "--emit-header",
        `${exportOut}.h`,
        "--emit-dts",
        `${exportOut}.d.ts`,
      ],
      { cwd: root, encoding: "utf8" }
    )
    const exportText = (ext) =>
      exportBuilt.status === 0 && fs.existsSync(`${exportOut}.${ext}`)
        ? fs.readFileSync(`${exportOut}.${ext}`, "utf8")
        : ""
    const exportHeader = exportText("h")
    check(
      "ffi_buffer: an exported `u8[]` parameter C writes is `nish_array *`, and one C only reads is `const nish_array *`",
      exportHeader.includes("int32_t fill(nish_array *b);") &&
        exportHeader.includes("int64_t peek(const nish_array *b);"),
      exportHeader || shown(exportBuilt)
    )
    const exportGlue = exportText("mjs")
    const glueOf = (name) => exportGlue.slice(exportGlue.indexOf(`    ${name}: (`)).split("\n    }),")[0]
    check(
      "ffi_buffer: the wasm glue copies back a `u8[]` parameter C writes, and not one C only reads",
      glueOf("fill").includes("copyBack(b$, b);") && !glueOf("peek").includes("copyBack("),
      exportGlue || shown(exportBuilt)
    )
    const exportIr = exportText("ll")
    check(
      "ffi_buffer: an exported `u8[]` parameter C writes loses `readonly`, and one C only reads keeps it",
      exportIr.includes(
        "@fill(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %b)"
      ) &&
        exportIr.includes(
          "@peek(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b)"
        ),
      exportIr || shown(exportBuilt)
    )

    const proved = write(
      "proved.ts",
      [
        writeDecl,
        "",
        "export const main = (): i32 => {",
        "  const b: u8[] = [104, 105, 10];",
        "  write(1, b, toU64(b.length));",
        "  return 0;",
        "};",
        "",
      ].join("\n")
    )
    const provedSites = sitesOf(proved)
    check(
      "ffi_buffer: `toU64(b.length)` of the buffer itself is a proved `ffi-length` site",
      provedSites.report !== null &&
        fnSites(provedSites.report, "main").some((p) => p.kind === "ffi-length" && p.proven === true) &&
        fnSites(provedSites.report, "main").every((p) => p.kind !== "ffi-length" || p.proven === true),
      provedSites.report === null ? shown(provedSites.r) : JSON.stringify(provedSites.report)
    )
    const provedDeny = compileBuf(proved, ["--deny-panics"])
    check(
      "ffi_buffer: a proved count compiles under --deny-panics",
      provedDeny.status === 0,
      shown(provedDeny)
    )
    const provedFfi = compileBuf(proved, ["--deny", "ffi"])
    check(
      "ffi_buffer: --deny ffi refuses a call that passes a buffer",
      provedFfi.status === 1 &&
        provedFfi.stderr.includes("reaches `ffi`") &&
        provedFfi.stderr.includes("calls write"),
      shown(provedFfi)
    )

    const ctor = write(
      "ctor.ts",
      [
        writeDecl,
        "",
        "class Sink {",
        "  wrote: i64;",
        "  constructor(b: u8[], n: u64) {",
        "    this.wrote = write(1, b, n);",
        "  }",
        "}",
        "",
        "export const main = (): i32 => {",
        "  const b: u8[] = [104, 105, 10];",
        "  const s = new Sink(b, toU64((toI32(Date.now()) % 2) + 2));",
        "  return s.wrote > 0 ? 0 : 1;",
        "};",
        "",
      ].join("\n")
    )
    const ctorSites = sitesOf(ctor)
    check(
      "ffi_buffer: a constructor's count to C is an `ffi-length` site, and `new` is a call site via it",
      ctorSites.report !== null &&
        fnSites(ctorSites.report, "Sink.constructor").some(
          (p) => p.kind === "ffi-length" && p.proven === false
        ) &&
        fnSites(ctorSites.report, "main").some(
          (p) => p.kind === "call" && p.callee === "Sink.constructor" && p.via === "ffi-length"
        ),
      ctorSites.report === null ? shown(ctorSites.r) : JSON.stringify(ctorSites.report)
    )
    const ctorDeny = compileBuf(ctor, ["--deny-panics"])
    check(
      "ffi_buffer: --deny-panics refuses an unproved count handed to C in a constructor",
      ctorDeny.status === 1 && ctorDeny.stderr.includes("`ffi-length` may panic here"),
      shown(ctorDeny)
    )
    const ctorFfi = compileBuf(ctor, ["--deny", "ffi"])
    check(
      "ffi_buffer: --deny ffi refuses a buffer call reached from a constructor by `new`",
      ctorFfi.status === 1 &&
        ctorFfi.stderr.includes("calls Sink.constructor") &&
        ctorFfi.stderr.includes("calls write"),
      shown(ctorFfi)
    )

    const reach = write(
      "reach.ts",
      [
        writeDecl,
        "",
        "class Holder {",
        "  t: Tag | null = null;",
        "}",
        "",
        "class Tag {",
        "  bytes: u8[];",
        "  constructor(h: Holder, b: u8[]) {",
        "    this.bytes = b;",
        "    h.t = this;",
        "  }",
        "}",
        "",
        "export const main = (): i32 => {",
        "  const b: u8[] = [104, 105, 10];",
        "  const n = toU64((toI32(Date.now()) % 2) + 2);",
        "  {",
        "    using a = arena(), c = arena();",
        "    write(1, b, n);",
        "  }",
        "  const h = new Holder();",
        "  new Tag(h, b);",
        "  const t = h.t;",
        "  if (t !== null) {",
        "    write(1, t.bytes, n);",
        "  }",
        "  return 0;",
        "};",
        "",
      ].join("\n")
    )
    const reachSites = sitesOf(reach)
    const reachLines = fnSites(reachSites.report, "main")
      .filter((p) => p.kind === "ffi-length" && p.proven === false)
      .map((p) => p.line)
      .join(",")
    check(
      "ffi_buffer: a count handed to C inside a two-declarator `using` block, and one for a buffer read through `this` stored out of a constructor, are each an `ffi-length` site",
      reachSites.report !== null && reachLines === "20,26",
      reachSites.report === null ? shown(reachSites.r) : JSON.stringify(reachSites.report)
    )

    // A task that reaches C with a buffer the parent can see is refused, by
    // each way the call can reach the task. The message is the shared-write
    // refusal: a C body is unseen, so it may write what its caller can see.
    const raceHead = ['import { scope } from "nish/threads";', "", readDecl, ""]
    const raceMain = (using, task) => [
      "export function main(): i32 {",
      "  const b = new Array<u8>(8);",
      "  const h = new Holder();",
      "  new Tag(h, b);",
      "  let seen = 0;",
      "  {",
      `    using ${using};`,
      `    ${task}.spawn(() => {`,
      `      ${task === "t" ? "read(0, b, toU64(b.length))" : "go(h)"};`,
      "    });",
      "    seen = toI32(b[0]);",
      "  }",
      "  return seen;",
      "}",
      "",
    ]
    const holder = [
      "class Holder {",
      "  t: Tag | null = null;",
      "}",
      "",
      "class Tag {",
      "  bytes: u8[];",
      "  constructor(h: Holder, b: u8[]) {",
      "    this.bytes = b;",
      "    h.t = this;",
      "  }",
      "}",
      "",
    ]
    const races = [
      ["the second declarator of a `using`", "s = scope(), t = scope()", "t", [], "at "],
      [
        "a constructor reached by `new`",
        "s = scope()",
        "s",
        [
          "class Filler {",
          "  got: i64;",
          "  constructor(b: u8[]) {",
          "    this.got = read(0, b, toU64(b.length));",
          "  }",
          "}",
          "",
          "function go(h: Holder): void {",
          "  const t = h.t;",
          "  if (t !== null) {",
          "    new Filler(t.bytes);",
          "  }",
          "}",
          "",
        ],
        "through `go`",
      ],
      [
        "`this` stored out of a constructor",
        "s = scope()",
        "s",
        [
          "function go(h: Holder): void {",
          "  const t = h.t;",
          "  if (t !== null) {",
          "    read(0, t.bytes, toU64(t.bytes.length));",
          "  }",
          "}",
          "",
        ],
        "through `go`",
      ],
    ]
    for (const [i, [how, using, task, extra, where]] of races.entries()) {
      const file = write(
        `race${i}.ts`,
        [...raceHead, ...holder, ...extra, ...raceMain(using, task)].join("\n")
      )
      const r = compileBuf(file, [])
      check(
        `ffi_buffer: a task that reaches C with a buffer the parent can see is refused, through ${how}`,
        r.status === 1 &&
          r.stderr.includes(`writes memory its caller can see ${where}`) &&
          r.stderr.includes("`spawn` runs it beside the scope's other tasks"),
        shown(r)
      )
    }
  }

  // WP40 B1.2 on wasm (docs/wp40-ffi-buffers-handles.md §5). A `--target
  // wasm32` build of ffi_buffer_write assembles, and llc reads its data pointer
  // as a 32-bit load at the header's offset 16 and its `n <= len` as an i64
  // compare: the header is `{i64 len, i64 cap, i8* data}` on both targets. The
  // freestanding `--profile wasm` route links IR compiled for the host, so it is
  // held separately: linked against a stub `write` with B1's own signature, the
  // symbol resolves, nothing is imported, and `main` hands the stub exactly the
  // bytes the native run writes. The C `size_t` that `u64` stands for is 32 bits
  // on wasm32; that gap is recorded in docs/LANGUAGE.md, not closed here.
  if (!only || "ffi_buffer wasm".includes(only) || "wasi".includes(only)) {
    const wasmBufDir = path.join(buildDir, "ffi-buffer-wasm")
    fs.mkdirSync(wasmBufDir, { recursive: true })
    const bufCase = path.join(root, "tests", "cases", "ffi_buffer_write.ts")
    const w32Dir = path.join(wasmBufDir, "wasm32")
    const w32 = spawnSync(nish, [bufCase, "--target", "wasm32", "-o", `${w32Dir}${path.sep}`], {
      cwd: root,
      encoding: "utf8",
    })
    const w32Ll = path.join(w32Dir, "ffi_buffer_write.ll")
    const w32As =
      w32.status === 0 ? spawnSync("llvm-as", [w32Ll, "-o", "/dev/null"], { encoding: "utf8" }) : w32
    const w32S = path.join(w32Dir, "ffi_buffer_write.s")
    const w32Llc =
      w32As.status === 0 ? spawnSync("llc", ["-O0", w32Ll, "-o", w32S], { encoding: "utf8" }) : w32As
    const asm = w32Llc.status === 0 ? fs.readFileSync(w32S, "utf8") : ""
    const w32Ir = w32.status === 0 ? fs.readFileSync(w32Ll, "utf8") : ""
    check(
      "ffi_buffer: a --target wasm32 build passes llvm-as, and llc reads the data pointer as an i32.load at offset 16 and the count check as i64.le_u",
      w32As.status === 0 &&
        w32Llc.status === 0 &&
        w32Ir.includes('target triple = "wasm32-unknown-unknown"') &&
        w32Ir.includes("declare i64 @write(i32, i8*, i64)") &&
        w32Ir.includes("icmp ule i64 3, ") &&
        /\.functype\s+write \(i32, i32, i64\) -> \(i64\)/.test(asm) &&
        (asm.match(/i32\.load\s+16\n/g) ?? []).length >= 2 &&
        /i64\.le_u/.test(asm),
      shown(w32Llc)
    )

    if (has("wasm-ld")) {
      const freeDir = path.join(wasmBufDir, "freestanding")
      const hostBuilt = spawnSync(nish, [bufCase, "-o", `${freeDir}${path.sep}`], {
        cwd: root,
        encoding: "utf8",
      })
      const stub = path.join(freeDir, "stub.c")
      fs.writeFileSync(
        stub,
        [
          "/* B1's `write`: every byte it is handed, folded into one number. */",
          "static long long seen;",
          "long long write(int fd, const unsigned char *buf, unsigned long long n) {",
          "  for (unsigned long long i = 0; i < n; i++) seen = seen * 31 + buf[i];",
          "  return (long long)n;",
          "}",
          '__attribute__((export_name("seen"))) long long written(void) { return seen; }',
          "",
        ].join("\n")
      )
      const wasm = path.join(freeDir, "write.wasm")
      const linked =
        hostBuilt.status === 0
          ? spawnSync(
              "bash",
              [
                "scripts/build.sh",
                path.join(freeDir, "ffi_buffer_write.ll"),
                "runtime/runtime-wasm.c",
                stub,
                "-o",
                wasm,
                "--profile",
                "wasm",
              ],
              { cwd: root, encoding: "utf8" }
            )
          : hostBuilt
      let want = 0n
      for (const b of fs.readFileSync(path.join(root, "tests", "cases", "ffi_buffer_write.out"))) {
        want = BigInt.asIntN(64, want * 31n + BigInt(b))
      }
      let got = ""
      if (linked.status === 0) {
        try {
          const mod = new WebAssembly.Module(fs.readFileSync(wasm))
          const imports = WebAssembly.Module.imports(mod).map((i) => i.name)
          const instance = new WebAssembly.Instance(mod, { env: {} })
          got = `imports [${imports.join(",")}] main ${instance.exports.main()} seen ${instance.exports.seen()}`
        } catch (e) {
          got = `the module trapped: ${e}`
        }
      }
      check(
        "ffi_buffer: the freestanding --profile wasm link of host IR resolves `write` against a stub with B1's signature, and hands it the bytes the native run writes",
        linked.status === 0 && got === `imports [] main 0 seen ${want}`,
        `${shown(linked)}got  ${got}\nwant imports [] main 0 seen ${want}\n`
      )
    } else {
      skip(
        "skipped: ffi_buffer: no wasm-ld: the freestanding --profile wasm link of a buffer call is not run"
      )
    }
  }
}
