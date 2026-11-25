// WP89 S3's checks (docs/wp89-gfx.md): which links take the graphics shim in
// runtime/gfx/, and what the shim does once it is linked. They live beside
// `tests/run.js`, which calls `runGfxChecks` with its own helpers, so that file
// stays under Biome's size limit. docs/security/gfx.md cites each check by its
// exact name.
//
// The first group needs no graphics library: it points NISH_GFX_PREFIX at a
// directory that does not exist, so a link that wants the shim stops with
// scripts/build.sh's error and one that does not want it links as before. The
// rest need SDL3 and wgpu-native where scripts/fetch-gfx.sh puts them (or
// NISH_GFX_PREFIX), and a GPU adapter, which CI's `gfx` job gets from Mesa's
// lavapipe; without them each says what is missing in a SKIP line.
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"

// The files scripts/build.sh requires under a prefix before it links the shim.
const PREFIX_FILES = [
  "include/SDL3/SDL.h",
  "include/webgpu/webgpu.h",
  "include/webgpu/wgpu.h",
  "lib/libSDL3.a",
  "lib/libwgpu_native.a",
]

// The platform directory scripts/fetch-gfx.sh installs into, or null where it
// pins nothing.
const fetchPlatform = () => {
  const arch = { x64: "x86_64", arm64: "aarch64" }[os.arch()]
  const system = { linux: "linux", darwin: "macos" }[os.platform()]
  return arch && system ? `${system}-${arch}` : null
}

// What a link of the shim needs beside the two archives: the same list as
// scripts/build.sh's `gfx_objects`.
const systemLibs = () =>
  os.platform() === "darwin"
    ? [
        ...[
          "Cocoa",
          "CoreFoundation",
          "CoreVideo",
          "Foundation",
          "IOKit",
          "Carbon",
          "Metal",
          "QuartzCore",
        ].flatMap((f) => ["-framework", f]),
        "-weak_framework",
        "UniformTypeIdentifiers",
      ]
    : ["-pthread", "-ldl", "-lm"]

/**
 * Runs the checks, each under `tests/run.js`'s filter: `only`, when set, is
 * matched against a group's name as `tests/run.js` matches its own sections.
 */
export const runGfxChecks = ({ only, has, check, skip, shown, nish, root, buildDir }) => {
  if (only && !"gfx checks".includes(only)) {
    return
  }
  if (!has("clang")) {
    skip("gfx: clang not on PATH, so nothing can be linked")
    return
  }
  const dir = path.join(buildDir, "gfx")
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const write = (name, text) => {
    const file = path.join(dir, name)
    fs.writeFileSync(file, text)
    return file
  }
  // A `CC` that logs every argument it is handed, so a link's inputs are read
  // off what reached the compiler.
  const ccLog = path.join(dir, "cc.log")
  const tools = path.join(dir, "tools")
  fs.mkdirSync(tools)
  fs.writeFileSync(
    path.join(tools, "cc-log"),
    `#!/bin/sh\nfor a in "$@"; do echo "$a" >> '${ccLog}'; done\nexec clang "$@"\n`,
    { mode: 0o755 }
  )
  const takeLog = () => {
    const seen = fs.existsSync(ccLog) ? fs.readFileSync(ccLog, "utf8").split("\n") : []
    fs.rmSync(ccLog, { force: true })
    return seen
  }
  const build = (ll, out, profile, extraEnv = {}) =>
    spawnSync(
      "bash",
      ["scripts/build.sh", ll, "runtime/runtime.c", "-o", path.join(dir, out), "--profile", profile],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, CC: "cc-log", PATH: `${tools}:${process.env.PATH}`, ...extraEnv },
      }
    )

  // ---- which links take the shim ---------------------------------------------------
  // scripts/build.sh links runtime/gfx/ for a module whose IR has a `declare`
  // line naming an `@nishgfx_` function before any string, and src/run-cache.ts
  // `callsGfx` keys `nish run`'s binary on runtime/gfx/ under the same rule.
  // A name inside a string constant, or one the module defines, is not a call
  // into the shim.
  const plainTs = write("plain.ts", 'export const main = (): void => {\n  console.log("plain")\n}\n')
  const plainLl = path.join(dir, "plain.ll")
  const compiled = spawnSync(nish, [plainTs, "-o", plainLl], { cwd: root, encoding: "utf8" })
  if (compiled.status !== 0) {
    check("gfx: the link fixture compiles", false, shown(compiled))
    return
  }
  const plainIr = fs.readFileSync(plainLl, "utf8")
  const variant = (name, extra) => {
    const file = path.join(dir, `${name}.ll`)
    fs.writeFileSync(file, `${plainIr}\n${extra}\n`)
    return file
  }
  const notCalls = {
    plain: plainLl,
    defined: variant("defined", "define void @nishgfx_local() {\n  ret void\n}"),
    after: variant("after", 'declare void @nish_gfx_other() ; "@nishgfx_x"'),
  }
  const calls = variant("calls", "declare ptr @nishgfx_instance_create()")
  const absent = { NISH_GFX_PREFIX: path.join(dir, "no-such-prefix") }
  for (const [name, ll] of Object.entries(notCalls)) {
    const r = build(ll, name, "debug", absent)
    const args = takeLog()
    const ran = r.status === 0 ? spawnSync(path.join(dir, name), [], { encoding: "utf8" }) : r
    check(
      `gfx: a module that does not declare an @nishgfx_ function (${name}) links without runtime/gfx/ or its libraries`,
      r.status === 0 &&
        ran.stdout === "plain\n" &&
        !args.some(
          (a) => a.includes("runtime/gfx") || a.includes("no-such-prefix") || /^-l(SDL3|wgpu_native)$/.test(a)
        ),
      shown(r) + args.filter((a) => /gfx|SDL|wgpu/.test(a)).join(" ")
    )
  }
  const missing = build(calls, "calls", "debug", absent)
  takeLog()
  check(
    "gfx: a module that declares an @nishgfx_ function, with no SDL3 or wgpu-native installed, is refused naming scripts/fetch-gfx.sh",
    missing.status === 2 &&
      missing.stderr.includes("no-such-prefix/include/SDL3/SDL.h is not there") &&
      missing.stderr.includes("scripts/fetch-gfx.sh") &&
      !fs.existsSync(path.join(dir, "calls")),
    shown(missing)
  )
  for (const profile of ["wasm", "wasm-host", "wasi"]) {
    const r = build(calls, `calls-${profile}`, profile)
    takeLog()
    check(
      `gfx: a module that declares an @nishgfx_ function is refused under --profile ${profile}`,
      r.status === 2 && r.stderr.includes(`which the ${profile} profile cannot link`),
      shown(r)
    )
  }
  // The rule is written twice, once in each language. Both run here on the
  // same IR: build.sh's own grep line, taken from the script, and run-cache.ts's
  // `declaresPrefixed` with the prefixes `callsGfx` passes it, taken from the
  // source with its type annotations dropped. An edit to either that changes
  // an answer turns this red.
  const buildSh = fs.readFileSync(path.join(root, "scripts", "build.sh"), "utf8")
  const runCache = fs.readFileSync(path.join(root, "src", "run-cache.ts"), "utf8")
  const grepLine = /grep -Eq '(\^declare [^']*@nishgfx_)'/.exec(buildSh)
  const gfxPrefixes = /const callsGfx = \(ir: string\): boolean => declaresPrefixed\(ir, (\[[^\]]*\])\)/.exec(
    runCache
  )
  const fnText = /const declaresPrefixed = [\s\S]*?\n}\n/.exec(runCache)
  let callsGfx = null
  try {
    if (gfxPrefixes && fnText) {
      const js = fnText[0].replace(/: (string\[\]|string|boolean)(?=[\s,)=])/g, "")
      callsGfx = new Function(`${js}\nreturn (ir) => declaresPrefixed(ir, ${gfxPrefixes[1]})`)()
    }
  } catch {
    callsGfx = null
  }
  const samples = { ...notCalls, calls }
  const answers = Object.entries(samples).map(([name, ll]) => {
    const sh = grepLine ? spawnSync("grep", ["-Eq", grepLine[1], ll]).status === 0 : null
    const ts = callsGfx ? callsGfx(fs.readFileSync(ll, "utf8")) : null
    return { name, sh, ts, want: name === "calls" }
  })
  check(
    "gfx: scripts/build.sh and src/run-cache.ts callsGfx select the shim by the same declare prefix",
    answers.every((a) => a.sh === a.want && a.ts === a.want),
    answers.map((a) => `${a.name}: build.sh ${a.sh}, callsGfx ${a.ts}`).join("; ")
  )

  // ---- the shim, linked ------------------------------------------------------------
  const platform = fetchPlatform()
  const prefix = process.env.NISH_GFX_PREFIX || (platform ? path.join(root, "build", "gfx", platform) : "")
  const lacking = prefix ? PREFIX_FILES.filter((f) => !fs.existsSync(path.join(prefix, f))) : PREFIX_FILES
  if (lacking.length > 0) {
    skip(
      `gfx: ${prefix ? `${prefix}/${lacking[0]}` : "SDL3 and wgpu-native"} is not there, so the shim is not built: run scripts/fetch-gfx.sh`
    )
    return
  }
  const gfxDir = path.join(root, "runtime", "gfx")
  const include = ["-I", gfxDir, "-I", path.join(prefix, "include")]
  const libs = ["-L", path.join(prefix, "lib"), "-lSDL3", "-lwgpu_native", ...systemLibs()]

  // Every C symbol the shim calls, less SDL's and wgpu-native's own, is one
  // src/c-symbols.ts reserves, as tests/run.js's c-symbols section asks of the
  // runtime: a Nish function of that name would otherwise take the call.
  const nm = ["llvm-nm", "llvm-nm-18"].find(has)
  const shimObj = path.join(dir, "nish-gfx.o")
  const shimCc = spawnSync(
    "clang",
    ["-O2", ...include, "-c", path.join(gfxDir, "nish-gfx.c"), "-o", shimObj],
    {
      encoding: "utf8",
    }
  )
  if (nm === undefined) {
    skip("gfx: no llvm-nm on PATH, so the shim's C symbols are not read")
  } else {
    const symbols = shimCc.status === 0 ? spawnSync(nm, ["-u", "-j", shimObj], { encoding: "utf8" }) : shimCc
    const cSymbols = fs.readFileSync(path.join(root, "src", "c-symbols.ts"), "utf8")
    const listed = new Set([...cSymbols.matchAll(/name === "([^"]+)"/g)].map((m) => m[1]))
    const prefixes = [...cSymbols.matchAll(/name\.startsWith\("([^"]+)"\)/g)].map((m) => m[1])
    const unreserved =
      symbols.status === 0
        ? symbols.stdout
            .split("\n")
            .map((s) => (os.platform() === "darwin" ? s.trim().replace(/^_/, "") : s.trim()))
            .filter((s) => s.length > 0 && !/^(SDL_|wgpu)/.test(s))
            .filter((s) => !listed.has(s) && !prefixes.some((p) => s.startsWith(p)))
        : null
    check(
      "gfx: every C symbol runtime/gfx/nish-gfx.c calls, less SDL's and wgpu-native's, is one src/c-symbols.ts reserves",
      unreserved !== null && unreserved.length === 0,
      unreserved === null ? shown(symbols) : `add to isCLibrarySymbol: ${unreserved.sort().join(" ")}`
    )
  }

  // The C triangle: one offscreen frame, read back and sampled, then the error
  // and event rings overrun and the builder and size caps pushed on purpose.
  // tests/gfx/triangle.c answers 77 when no adapter answers, which is a machine
  // without a GPU or a software Vulkan.
  const triangle = path.join(dir, "triangle")
  const triangleCc = spawnSync(
    "clang",
    [
      "-O1",
      ...include,
      path.join(root, "tests", "gfx", "triangle.c"),
      path.join(gfxDir, "nish-gfx.c"),
      ...libs,
      "-o",
      triangle,
    ],
    { encoding: "utf8" }
  )
  const drawn =
    triangleCc.status === 0 ? spawnSync(triangle, [], { encoding: "utf8", timeout: 120000 }) : triangleCc
  if (triangleCc.status === 0 && drawn.status === 77) {
    skip(`gfx: no GPU adapter answered (${drawn.stdout.trim()}), so the triangle is not drawn`)
  } else {
    // Each bound the triangle exercises is one line it prints on stdout.
    const printed = [
      [
        "gfx: tests/gfx/triangle.c draws a red triangle on a blue clear offscreen and reads it back",
        "centre red, corner blue",
      ],
      [
        "gfx: the device's error ring keeps 16 reports and counts the 4 past it as dropped",
        "error ring kept 16, dropped 4",
      ],
      [
        "gfx: a window's event ring keeps the first 64 events in order and counts the 6 past it as dropped",
        "event ring kept 64 in order, dropped 6",
      ],
      [
        "gfx: an error message is kept to 255 bytes and drained to the caller's cap less its NUL",
        "a long error keeps 255 bytes, a drain into 8 keeps 7",
      ],
      [
        "gfx: the pipeline and bind group builders take 16 entries each and refuse the 17th",
        "builders took 16 attributes and 16 bindings",
      ],
      [
        "gfx: a bind group entry of size 0 binds the rest of the buffer instead of aborting the process",
        "a size-0 binding reached the device and the process lived",
      ],
      [
        "gfx: offscreen_create refuses 0 and 16385 a side and hands 16384 to the device",
        "offscreen refuses 0 and 16385, hands 16384 to the device",
      ],
      ["gfx: a resize SDL reports below zero reaches the program as 0", "a resize to -5 x 7 reads 0 x 7"],
      [
        "gfx: surface_create refuses a window on a video driver other than wayland, x11 or cocoa and reports why",
        "the offscreen driver gets no surface, and the instance is told why",
      ],
    ]
    for (const [name, line] of printed) {
      check(name, drawn.status === 0 && drawn.stdout.includes(`triangle: ${line}\n`), shown(drawn))
    }
    check(
      "gfx: offscreen_read refuses a buffer one byte short and leaves it untouched",
      drawn.status === 0 && !drawn.stderr.includes("a short buffer was not refused"),
      shown(drawn)
    )
  }

  // A Nish program, through `nish c-import`'s binding of the header and
  // `--link`, reaches the shim: scripts/build.sh compiles runtime/gfx/ and
  // links the libraries because its IR declares the shim's functions.
  const binding = path.join(dir, "binding.ts")
  const imported = spawnSync(
    nish,
    [
      "c-import",
      path.join(gfxDir, "nish-gfx.h"),
      "--overrides",
      path.join(gfxDir, "nish-gfx.overrides.json"),
      "-o",
      binding,
    ],
    { cwd: root, encoding: "utf8" }
  )
  const header = fs.readFileSync(path.join(gfxDir, "nish-gfx.h"), "utf8")
  const headerFns = new Set([...header.matchAll(/\b(nishgfx_\w+)\(/g)].map((m) => m[1]))
  const bound = imported.status === 0 ? fs.readFileSync(binding, "utf8") : ""
  const boundFns = new Set([...bound.matchAll(/declare function (nishgfx_\w+)\(/g)].map((m) => m[1]))
  check(
    "gfx: nish c-import binds every function runtime/gfx/nish-gfx.h declares",
    imported.status === 0 && headerFns.size > 0 && [...headerFns].every((f) => boundFns.has(f)),
    imported.status === 0
      ? `unbound: ${[...headerFns].filter((f) => !boundFns.has(f)).join(" ")}`
      : shown(imported)
  )
  const program = write(
    "instance.ts",
    `${bound}\nexport const main = (): void => {\n  const instance = nishgfx_instance_create()\n  if (instance !== null) {\n    console.log("instance")\n    nishgfx_instance_release(instance)\n  } else {\n    console.log("no instance")\n  }\n}\n`
  )
  const exe = path.join(dir, "instance")
  const linked =
    imported.status === 0
      ? spawnSync(nish, [program, "--link", exe, "--profile", "debug"], {
          cwd: root,
          encoding: "utf8",
          env: { ...process.env, NISH_GFX_PREFIX: prefix },
        })
      : imported
  const ran = linked.status === 0 ? spawnSync(exe, [], { encoding: "utf8" }) : linked
  check(
    "gfx: a Nish program that calls nishgfx_instance_create links runtime/gfx/ with --link and gets an instance",
    ran.status === 0 && ran.stdout === "instance\n",
    shown(ran)
  )
}
