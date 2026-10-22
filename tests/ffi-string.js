// WP27 S3.1+'s checks (docs/wp27-ffi.md): a `string` handed to a `declare
// function`, its `ffi-nul` site, and the C strings a call gives back. They
// live beside `tests/run.js`, which calls `runFfiStringChecks` with its own
// helpers, so that file stays under Biome's size limit. A record cites each
// check by its exact name.
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

/**
 * Runs the checks, each under `tests/run.js`'s filter: `only`, when set, is
 * matched against a group's name as `tests/run.js` matches its own sections.
 */
export const runFfiStringChecks = ({ only, check, shown, nish, root, buildDir }) => {
  // WP27 S3.1: a `string` handed to a `declare function` is borrowed as
  // `const char *`, and one that holds a NUL panics before the call (`ffi-nul`,
  // docs/wp27-ffi.md §8c). A literal with no NUL is proved and is no site;
  // anything else is a site in the function that makes the call, which
  // `--deny-panics` refuses and `--emit-panics` names through every caller --
  // a constructor reached by `new` included -- and the call is `ffi` under
  // `--deny ffi` whether it passes a string or a scalar. The last program puts
  // the call inside a `using` block and reads the string back through `this`
  // stored out of a constructor, the two other ways `.claude/selfhost.md` names for a value
  // to reach a rule from where its tests do not write it.
  if (!only || "ffi_string checks".includes(only)) {
    const ffiDir = path.join(buildDir, "ffi-string")
    fs.mkdirSync(ffiDir, { recursive: true })
    const write = (name, text) => {
      const file = path.join(ffiDir, name)
      fs.writeFileSync(file, text)
      return file
    }
    const compileFfi = (file, extra) =>
      spawnSync(nish, [file, "-o", path.join(ffiDir, `${path.basename(file, ".ts")}`) + path.sep, ...extra], {
        cwd: root,
        encoding: "utf8",
      })
    const sitesOf = (file) => {
      const json = path.join(ffiDir, `${path.basename(file, ".ts")}.panics.json`)
      const r = compileFfi(file, ["--emit-panics", json])
      return { r, report: r.status === 0 ? JSON.parse(fs.readFileSync(json, "utf8")) : null }
    }
    const irOf = (file) => {
      const ll = path.join(ffiDir, path.basename(file, ".ts"), `${path.basename(file, ".ts")}.ll`)
      return fs.existsSync(ll) ? fs.readFileSync(ll, "utf8") : ""
    }
    const fnSites = (report, name) => (report?.functions ?? []).find((f) => f.name === name)?.panics ?? []

    const literal = write(
      "literal.ts",
      'declare function puts(s: string): i32;\n\nexport const main = (): i32 => {\n  puts("hello");\n  return 0;\n};\n'
    )
    const lit = sitesOf(literal)
    check(
      'ffi_string: `puts("hello")` has no `ffi-nul` site and no NUL check in its IR',
      lit.report !== null &&
        fnSites(lit.report, "main").every((p) => p.kind !== "ffi-nul") &&
        !irOf(literal).includes("@nish_str_index_of(") &&
        /= getelementptr inbounds i8, i8\* bitcast \(\{ i64, \[6 x i8\] \}\* @\.str\.\d+ to i8\*\), i64 8\n\s+%\d+ = call i32 @puts\(/.test(
          irOf(literal)
        ),
      lit.report === null ? shown(lit.r) : irOf(literal)
    )
    const litDeny = compileFfi(literal, ["--deny-panics"])
    check("ffi_string: a NUL-free literal compiles under --deny-panics", litDeny.status === 0, shown(litDeny))
    const litFfi = compileFfi(literal, ["--deny", "ffi"])
    check(
      "ffi_string: --deny ffi refuses a call that passes only a string",
      litFfi.status === 1 && litFfi.stderr.includes("reaches `ffi`") && litFfi.stderr.includes("calls puts"),
      shown(litFfi)
    )

    const ctor = write(
      "ctor.ts",
      [
        "declare function strlen(s: string): u64;",
        "",
        "class Name {",
        "  len: u64;",
        "  constructor(s: string) {",
        "    this.len = strlen(s);",
        "  }",
        "}",
        "",
        "export const main = (): i32 => {",
        `  const n = new Name("ab" + \`\${toI32(Date.now()) % 10}\`);`,
        '  console.log(n.len > 0 ? "some" : "none");',
        "  return 0;",
        "};",
        "",
      ].join("\n")
    )
    const ctorSites = sitesOf(ctor)
    check(
      "ffi_string: a constructor's string argument to C is an `ffi-nul` site, and `new` is a call site via it",
      ctorSites.report !== null &&
        fnSites(ctorSites.report, "Name.constructor").some(
          (p) => p.kind === "ffi-nul" && p.proven === false
        ) &&
        fnSites(ctorSites.report, "main").some(
          (p) => p.kind === "call" && p.callee === "Name.constructor" && p.via === "ffi-nul"
        ),
      ctorSites.report === null ? shown(ctorSites.r) : JSON.stringify(ctorSites.report)
    )
    const ctorDeny = compileFfi(ctor, ["--deny-panics"])
    check(
      "ffi_string: --deny-panics refuses a string that is not a literal, handed to C in a constructor",
      ctorDeny.status === 1 && ctorDeny.stderr.includes("`ffi-nul` may panic here"),
      shown(ctorDeny)
    )
    const ctorFfi = compileFfi(ctor, ["--deny", "ffi"])
    check(
      "ffi_string: --deny ffi refuses a string call reached from a constructor by `new`",
      ctorFfi.status === 1 &&
        ctorFfi.stderr.includes("calls Name.constructor") &&
        ctorFfi.stderr.includes("calls strlen"),
      shown(ctorFfi)
    )

    const reach = write(
      "reach.ts",
      [
        'import { Mutex } from "nish/threads";',
        "",
        "declare function strlen(s: string): u64;",
        "",
        "class Counter {",
        "  n: i32 = 0;",
        "}",
        "",
        "class Holder {",
        "  t: Tag | null = null;",
        "}",
        "",
        "class Tag {",
        "  label: string;",
        "  constructor(h: Holder, s: string) {",
        "    this.label = s;",
        "    h.t = this;",
        "  }",
        "}",
        "",
        "export const main = (): i32 => {",
        "  const m = new Mutex<Counter>(new Counter());",
        `  const name: string = "n" + \`\${toI32(Date.now()) % 10}\`;`,
        "  {",
        "    using g = m.lock();",
        "    g.value.n = toI32(strlen(name));",
        "  }",
        "  const h = new Holder();",
        '  new Tag(h, name + "!");',
        "  const t = h.t;",
        "  if (t !== null) {",
        '    console.log(strlen(t.label) > 0 ? "some" : "none");',
        "  }",
        "  return 0;",
        "};",
        "",
      ].join("\n")
    )
    const reachSites = sitesOf(reach)
    const reachLines = fnSites(reachSites.report, "main")
      .filter((p) => p.kind === "ffi-nul" && p.proven === false)
      .map((p) => p.line)
      .join(",")
    check(
      "ffi_string: a string handed to C inside a `using` block, and one read through `this` stored out of a constructor, are each an `ffi-nul` site",
      reachSites.report !== null && reachLines === "26,32",
      reachSites.report === null ? shown(reachSites.r) : JSON.stringify(reachSites.report)
    )
    const reachFfi = compileFfi(reach, ["--deny", "ffi"])
    check(
      "ffi_string: --deny ffi refuses a string call inside a `using` block",
      reachFfi.status === 1 && reachFfi.stderr.includes("calls strlen"),
      shown(reachFfi)
    )

    // WP27 S3.2: a `string` result is copied out of C's `const char *` after the
    // call, and `NULL` panics (`ffi-null`); `string | null` reads `NULL` as
    // `null` and is no site. The second program reaches the copy through a
    // constructor by `new`, inside a `using` block, and through `this` stored
    // out of a constructor, then churns the arena before it prints each one, so
    // a copy placed in a scope released too early prints other bytes.
    const result = write(
      "result.ts",
      [
        "declare function getenv(name: string): string;",
        "declare function strchr(s: string, c: i32): string | null;",
        "",
        "export const main = (): i32 => {",
        '  const a = getenv("HOME");',
        '  const b = strchr("abc", 98);',
        "  console.log(b === null ? a : b);",
        "  return 0;",
        "};",
        "",
      ].join("\n")
    )
    const resultSites = sitesOf(result)
    const resultKinds = fnSites(resultSites.report, "main")
      .map((p) => `${p.line}:${p.kind}`)
      .join(",")
    check(
      "ffi_string: a `string` result is an `ffi-null` site and a `string | null` one is not, each an allowed `oom`",
      resultKinds === "5:ffi-null,5:oom,6:oom",
      resultSites.report === null ? shown(resultSites.r) : JSON.stringify(resultSites.report)
    )
    const resultDeny = compileFfi(result, ["--deny-panics"])
    check(
      "ffi_string: --deny-panics refuses a `string` result and names `string | null`",
      resultDeny.status === 1 &&
        resultDeny.stderr.includes("`ffi-null` may panic here") &&
        resultDeny.stderr.includes("declare the result `string | null`"),
      shown(resultDeny)
    )
    const nullable = write(
      "nullable.ts",
      [
        "declare function getenv(name: string): string | null;",
        "",
        "export const main = (): i32 => {",
        '  const a = getenv("HOME");',
        '  console.log(a === null ? "unset" : "set");',
        "  return 0;",
        "};",
        "",
      ].join("\n")
    )
    const nullableDeny = compileFfi(nullable, ["--deny-panics"])
    check(
      "ffi_string: a `string | null` result compiles under --deny-panics, with no `ffi.null` block",
      nullableDeny.status === 0 &&
        irOf(nullable).includes("ffi.none:") &&
        !irOf(nullable).includes("ffi.null:"),
      `${shown(nullableDeny)}\n${irOf(nullable)}`
    )

    const kept = write(
      "kept.ts",
      [
        'import { Mutex } from "nish/threads";',
        "",
        "declare function strerror(errnum: i32): string;",
        "",
        "class Counter {",
        '  s: string = "";',
        "}",
        "",
        "class Name {",
        "  text: string;",
        "  constructor(e: i32) {",
        "    this.text = strerror(e);",
        "  }",
        "}",
        "",
        "class Holder {",
        "  t: Tag | null = null;",
        "}",
        "",
        "class Tag {",
        "  constructor(h: Holder, e: i32) {",
        "    h.t = this;",
        "    this.label = strerror(e);",
        "  }",
        '  label: string = "";',
        "}",
        "",
        "const churn = (n: i32): i32 => {",
        "  const t: string[] = [];",
        "  for (let i = 0; i < n; i++) {",
        "    t.push(`${i}`);",
        "  }",
        '  return t.join("").length;',
        "};",
        "",
        "export const main = (): i32 => {",
        "  const m = new Mutex<Counter>(new Counter());",
        "  const n = new Name(1);",
        "  {",
        "    using g = m.lock();",
        "    g.value.s = strerror(2);",
        "  }",
        "  const h = new Holder();",
        "  new Tag(h, 12);",
        "  console.log(`${churn(4000) > 0}`);",
        "  console.log(n.text);",
        "  {",
        "    using g = m.lock();",
        "    console.log(g.value.s);",
        "  }",
        "  const t = h.t;",
        '  console.log(t === null ? "none" : t.label);',
        "  return 0;",
        "};",
        "",
      ].join("\n")
    )
    const keptSites = sitesOf(kept)
    check(
      "ffi_string: a C string result in a constructor reached by `new` is an `ffi-null` site, and `new` a call site via it",
      keptSites.report !== null &&
        fnSites(keptSites.report, "Name.constructor").some(
          (p) => p.kind === "ffi-null" && p.proven === false
        ) &&
        fnSites(keptSites.report, "Tag.constructor").some(
          (p) => p.kind === "ffi-null" && p.proven === false
        ) &&
        fnSites(keptSites.report, "main").some(
          (p) => p.kind === "call" && p.callee === "Name.constructor" && p.via === "ffi-null"
        ) &&
        fnSites(keptSites.report, "main").some(
          (p) => p.kind === "call" && p.callee === "Tag.constructor" && p.via === "ffi-null"
        ) &&
        fnSites(keptSites.report, "main").filter((p) => p.kind === "ffi-null").length === 1,
      keptSites.report === null ? shown(keptSites.r) : JSON.stringify(keptSites.report)
    )
    const keptExe = path.join(ffiDir, "kept.exe")
    const keptBuilt = spawnSync(nish, [kept, "-o", path.join(ffiDir, "kept") + path.sep, "--link", keptExe], {
      cwd: root,
      encoding: "utf8",
    })
    const keptRun = keptBuilt.status === 0 ? spawnSync(keptExe, [], { encoding: "utf8" }) : keptBuilt
    check(
      "ffi_string: C string results kept by a constructor, by a `using` block's guard and through `this` survive churn",
      keptRun.status === 0 &&
        keptRun.stdout ===
          "true\nOperation not permitted\nNo such file or directory\nCannot allocate memory\n",
      shown(keptRun)
    )

    // WP27 S3.3: `readCString` from `nish:unsafe` copies the bytes behind a
    // `CPtr` into the arena. It is an allowed `unchecked` site, so it compiles
    // under --deny-panics, and --deny unsafe and --deny ffi each refuse it; the
    // literal `null` for a `CPtr | null` parameter is `i8* null` at the call.
    // The second program keeps copies through a constructor reached by `new`,
    // a `using` block's guard and `this` stored out of a constructor, then
    // churns the arena before it prints each one.
    const owned = write(
      "owned.ts",
      [
        'import { readCString } from "nish:unsafe";',
        "",
        "declare function realpath(path: string, resolved: CPtr | null): CPtr | null;",
        "declare function free(p: CPtr): void;",
        "",
        "export const main = (): i32 => {",
        '  const p = realpath("/", null);',
        "  if (p === null) {",
        "    return 1;",
        "  }",
        "  const s = readCString(p);",
        "  free(p);",
        "  console.log(s);",
        "  return 0;",
        "};",
        "",
      ].join("\n")
    )
    const ownedSites = sitesOf(owned)
    const ownedKinds = fnSites(ownedSites.report, "main")
      .map((p) => `${p.line}:${p.kind}:${p.allowed}`)
      .join(",")
    check(
      "ffi_owned_string: `readCString` is an allowed `unchecked` site and the copy's `oom`, and nothing else",
      ownedKinds === "11:unchecked:true,11:oom:true",
      ownedSites.report === null ? shown(ownedSites.r) : JSON.stringify(ownedSites.report)
    )
    check(
      "ffi_owned_string: a literal `null` for a `CPtr | null` parameter is `i8* null`, and the copy is `@nish.ffi.str`",
      /call i8\* @realpath\(i8\* %\d+, i8\* null\)/.test(irOf(owned)) &&
        /call i8\* @nish\.ffi\.str\(i8\* %\d+\)/.test(irOf(owned)),
      irOf(owned)
    )
    const ownedDenyPanics = compileFfi(owned, ["--deny-panics"])
    check(
      "ffi_owned_string: `readCString` compiles under --deny-panics",
      ownedDenyPanics.status === 0,
      shown(ownedDenyPanics)
    )
    const ownedUnsafe = compileFfi(owned, ["--deny", "unsafe"])
    check(
      "ffi_owned_string: --deny unsafe refuses `readCString` and names the call",
      ownedUnsafe.status === 1 &&
        ownedUnsafe.stderr.includes("reaches `unsafe`") &&
        ownedUnsafe.stderr.includes("calls readCString"),
      shown(ownedUnsafe)
    )
    const ownedFfi = compileFfi(owned, ["--deny", "ffi"])
    check(
      "ffi_owned_string: --deny ffi refuses a program that reads a C string",
      ownedFfi.status === 1 &&
        ownedFfi.stderr.includes("reaches `ffi`") &&
        ownedFfi.stderr.includes("calls realpath"),
      shown(ownedFfi)
    )
    const ownedChecked = spawnSync(nish, [owned, "--emit-checked"], { cwd: root, encoding: "utf8" })
    check(
      "ffi_owned_string: --emit-checked records the `readCString` import and its call",
      ownedChecked.status === 0 &&
        ownedChecked.stdout.includes('unsafe import 1:10 readCString from "nish:unsafe"') &&
        /unsafe call 11:13 readCString \(node \d+\)/.test(ownedChecked.stdout),
      shown(ownedChecked)
    )
    const ownedKept = write(
      "owned-kept.ts",
      [
        'import { Mutex } from "nish/threads";',
        'import { readCString } from "nish:unsafe";',
        "",
        "declare function strdup(s: string): CPtr | null;",
        "declare function free(p: CPtr): void;",
        "",
        "const copy = (s: string): string => {",
        "  const p = strdup(s);",
        "  if (p === null) {",
        '    return "";',
        "  }",
        "  const r = readCString(p);",
        "  free(p);",
        "  return r;",
        "};",
        "",
        "class Counter {",
        '  s: string = "";',
        "}",
        "",
        "class Name {",
        "  text: string;",
        "  constructor() {",
        '    const p = strdup("from a constructor");',
        '    this.text = p === null ? "" : readCString(p);',
        "    if (p !== null) {",
        "      free(p);",
        "    }",
        "  }",
        "}",
        "",
        "class Holder {",
        "  t: Tag | null = null;",
        "}",
        "",
        "class Tag {",
        "  constructor(h: Holder) {",
        "    h.t = this;",
        '    const p = strdup("through this");',
        "    if (p !== null) {",
        "      this.label = readCString(p);",
        "      free(p);",
        "    }",
        "  }",
        '  label: string = "";',
        "}",
        "",
        "const churn = (n: i32): i32 => {",
        "  const t: string[] = [];",
        "  for (let i = 0; i < n; i++) {",
        "    t.push(`${i}`);",
        "  }",
        '  return t.join("").length;',
        "};",
        "",
        "export const main = (): i32 => {",
        "  const m = new Mutex<Counter>(new Counter());",
        "  const n = new Name();",
        "  {",
        "    using g = m.lock();",
        '    const p = strdup("under a guard");',
        "    if (p !== null) {",
        "      g.value.s = readCString(p);",
        "      free(p);",
        "    }",
        "  }",
        "  const h = new Holder();",
        "  new Tag(h);",
        '  const c = copy("returned");',
        "  console.log(`${churn(4000) > 0}`);",
        "  console.log(n.text);",
        "  {",
        "    using g = m.lock();",
        "    console.log(g.value.s);",
        "  }",
        "  const t = h.t;",
        '  console.log(t === null ? "none" : t.label);',
        "  console.log(c);",
        "  return 0;",
        "};",
        "",
      ].join("\n")
    )
    const ownedKeptExe = path.join(ffiDir, "owned-kept.exe")
    const ownedKeptBuilt = spawnSync(
      nish,
      [ownedKept, "-o", path.join(ffiDir, "owned-kept") + path.sep, "--link", ownedKeptExe],
      { cwd: root, encoding: "utf8" }
    )
    const ownedKeptRun =
      ownedKeptBuilt.status === 0 ? spawnSync(ownedKeptExe, [], { encoding: "utf8" }) : ownedKeptBuilt
    check(
      "ffi_owned_string: `readCString` copies kept by a constructor, by a `using` block's guard and through `this` survive churn",
      ownedKeptRun.status === 0 &&
        ownedKeptRun.stdout === "true\nfrom a constructor\nunder a guard\nthrough this\nreturned\n",
      shown(ownedKeptRun)
    )

    // A `declare function` passed as a function parameter is called from the
    // specialisation (`err<strerror>`), which holds the copy and the site.
    const passed = write(
      "passed.ts",
      [
        "declare function strerror(errnum: i32): string;",
        "declare function getenv(name: string): string | null;",
        "",
        "function err(f: (n: i32) => string, n: i32): string {",
        "  return f(n);",
        "}",
        "",
        "function env(f: (name: string) => string | null, name: string): string {",
        '  return f(name) ?? "unset";',
        "}",
        "",
        "function churn(n: i32): i32 {",
        "  const t: string[] = [];",
        "  for (let i = 0; i < n; i++) {",
        "    t.push(`${i}`);",
        "  }",
        '  return t.join("").length;',
        "}",
        "",
        "export const main = (): i32 => {",
        "  const a = err(strerror, 2);",
        '  const b = env(getenv, "NISH_FFI_PASSED_UNSET");',
        "  console.log(`${churn(4000) > 0}`);",
        "  console.log(`${a}|${b}`);",
        "  return 0;",
        "};",
        "",
      ].join("\n")
    )
    const passedSites = sitesOf(passed)
    check(
      "ffi_string: a C string result through a function parameter is an `ffi-null` site in the specialisation",
      passedSites.report !== null &&
        fnSites(passedSites.report, "err<strerror>").some(
          (p) => p.kind === "ffi-null" && p.proven === false
        ) &&
        !fnSites(passedSites.report, "env<getenv>").some((p) => p.kind === "ffi-null") &&
        fnSites(passedSites.report, "main").some(
          (p) => p.kind === "call" && p.callee === "err<strerror>" && p.via === "ffi-null"
        ),
      passedSites.report === null ? shown(passedSites.r) : JSON.stringify(passedSites.report)
    )
    const passedExe = path.join(ffiDir, "passed.exe")
    const passedBuilt = spawnSync(
      nish,
      [passed, "-o", path.join(ffiDir, "passed") + path.sep, "--link", passedExe],
      { cwd: root, encoding: "utf8" }
    )
    const passedRun = passedBuilt.status === 0 ? spawnSync(passedExe, [], { encoding: "utf8" }) : passedBuilt
    check(
      "ffi_string: C string results through a function parameter are copied and survive churn",
      passedRun.status === 0 && passedRun.stdout === "true\nNo such file or directory|unset\n",
      shown(passedRun)
    )
  }
}
