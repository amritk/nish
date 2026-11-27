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

  // ---- std/gpu/sys.ts is c-import's binding of the shim, as it stands -------------
  // The module is written by the command on its own `Regenerate:` line, run
  // from std/gpu/. That command runs again here into a scratch file, and any
  // byte that differs from the checked-in module turns this red, the way
  // `node scripts/gen-reference.mjs --check` holds docs/reference/.
  const sysFile = path.join(root, "std", "gpu", "sys.ts")
  const sysText = fs.existsSync(sysFile) ? fs.readFileSync(sysFile, "utf8") : ""
  const regenLine = /^\/\/ Regenerate: nish (c-import .*) -o sys\.ts$/m.exec(sysText)
  const regenDir = path.join(dir, "sys")
  fs.mkdirSync(regenDir)
  const regen = regenLine
    ? spawnSync(nish, [...regenLine[1].split(" "), "-o", path.join(regenDir, "sys.ts")], {
        cwd: path.dirname(sysFile),
        encoding: "utf8",
      })
    : null
  const regenText = regen?.status === 0 ? fs.readFileSync(path.join(regenDir, "sys.ts"), "utf8") : null
  let regenWhy = "it differs: run the Regenerate line from std/gpu/"
  if (regen === null) {
    regenWhy = "std/gpu/sys.ts has no `// Regenerate: nish c-import ... -o sys.ts` line"
  } else if (regenText === null) {
    regenWhy = shown(regen)
  }
  check(
    "gfx: std/gpu/sys.ts is what nish c-import writes from runtime/gfx/nish-gfx.h and its overrides",
    regenLine !== null &&
      regenLine[1].startsWith(
        "c-import ../../runtime/gfx/nish-gfx.h --overrides ../../runtime/gfx/nish-gfx.overrides.json "
      ) &&
      regenText === sysText,
    regenWhy
  )

  // ---- what scripts/fetch-gfx.sh counts as installed -------------------------------
  // A copy of the script runs in a scratch root (it works from its own `..`)
  // with a PATH that holds the few tools its "already there" test reads and no
  // curl: an install it accepts exits 0 there, and one it does not stops at the
  // tool check with 2. No byte is downloaded either way.
  const platform = fetchPlatform()
  if (platform) {
    const fake = path.join(dir, "fetch-root")
    fs.mkdirSync(path.join(fake, "scripts"), { recursive: true })
    fs.copyFileSync(path.join(root, "scripts", "fetch-gfx.sh"), path.join(fake, "scripts", "fetch-gfx.sh"))
    const fetchBin = path.join(dir, "fetch-bin")
    fs.mkdirSync(fetchBin)
    const toolsFound = ["sh", "uname", "cat", "dirname"].every((t) => {
      const where = spawnSync("sh", ["-c", `command -v ${t}`], { encoding: "utf8" }).stdout.trim()
      if (where.startsWith("/")) {
        fs.symlinkSync(where, path.join(fetchBin, t))
      }
      return where.startsWith("/")
    })
    const fetchDest = path.join(fake, "build", "gfx", platform)
    const runFetch = () =>
      spawnSync(path.join(fetchBin, "sh"), ["scripts/fetch-gfx.sh"], {
        cwd: fake,
        encoding: "utf8",
        env: { PATH: fetchBin, HOME: fake },
      })
    const fetchSh = fs.readFileSync(path.join(fake, "scripts", "fetch-gfx.sh"), "utf8")
    const stampText = /^want="(.*)"$/m.exec(fetchSh)
    const versions = /^wgpu_version=(\S+)$[\s\S]*^sdl_version=(\S+)$/m.exec(fetchSh)
    if (toolsFound && stampText && versions) {
      const want = stampText[1].replace("$wgpu_version", versions[1]).replace("$sdl_version", versions[2])
      for (const f of PREFIX_FILES.filter((p) => p.startsWith("lib/"))) {
        fs.mkdirSync(path.dirname(path.join(fetchDest, f)), { recursive: true })
        fs.writeFileSync(path.join(fetchDest, f), "")
      }
      fs.writeFileSync(path.join(fetchDest, ".fetched"), `${want}\n`)
      const headers = PREFIX_FILES.filter((f) => f.startsWith("include/"))
      const lackingOne = headers.map((h) => {
        for (const other of headers) {
          fs.mkdirSync(path.dirname(path.join(fetchDest, other)), { recursive: true })
          fs.writeFileSync(path.join(fetchDest, other), "")
        }
        fs.rmSync(path.join(fetchDest, h))
        return { h, status: runFetch().status }
      })
      fs.rmSync(path.join(fetchDest, "include"), { recursive: true })
      const noInclude = runFetch()
      for (const h of headers) {
        fs.mkdirSync(path.dirname(path.join(fetchDest, h)), { recursive: true })
        fs.writeFileSync(path.join(fetchDest, h), "")
      }
      const whole = runFetch()
      check(
        "gfx: scripts/fetch-gfx.sh fetches again over a stamped install that lacks include/ or any header, and accepts a whole one",
        noInclude.status === 2 && lackingOne.every((l) => l.status === 2) && whole.status === 0,
        `no include/: ${noInclude.status}; ${lackingOne.map((l) => `no ${l.h}: ${l.status}`).join("; ")}; whole: ${whole.status}\n${shown(whole)}`
      )
    } else {
      check(
        "gfx: scripts/fetch-gfx.sh fetches again over a stamped install that lacks include/ or any header, and accepts a whole one",
        false,
        `tools found: ${toolsFound}; want line read: ${Boolean(stampText)}; versions read: ${Boolean(versions)}`
      )
    }
  } else {
    skip(
      `gfx: scripts/fetch-gfx.sh pins nothing for ${os.platform()}-${os.arch()}, so its install test is not run`
    )
  }

  // ---- the shim, linked ------------------------------------------------------------
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
        "gfx: nishgfx_buffer_new builds a buffer from scalars that takes a write, and a bad usage is one validation report",
        "buffer_new from scalars takes a write, and a bad usage is one validation report",
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

  // examples/gfx/clear.ts, through std/gpu/sys.ts: six offscreen frames, each
  // cleared to its own colour and read back. Frame f clears to red f/5 and
  // green (5 - f)/5, whose unorm bytes round exactly; the program prints each
  // frame's first pixel and whether every pixel matches it. It answers 77 when
  // no adapter answers, as the C triangle does.
  const clearExe = path.join(dir, "clear")
  const clearLinked = spawnSync(
    nish,
    [path.join(root, "examples", "gfx", "clear.ts"), "--link", clearExe, "--profile", "debug"],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, NISH_GFX_PREFIX: prefix },
    }
  )
  const cleared =
    clearLinked.status === 0
      ? spawnSync(clearExe, ["--offscreen"], { encoding: "utf8", timeout: 120000 })
      : clearLinked
  if (clearLinked.status === 0 && cleared.status === 77) {
    skip(`gfx: no GPU adapter answered (${cleared.stdout.trim()}), so examples/gfx/clear.ts is not drawn`)
  } else {
    const byte = (x) => Math.round(x * 255)
    const expected = [0, 1, 2, 3, 4, 5]
      .map((f) => `frame ${f}: ${byte(f / 5)},${byte((5 - f) / 5)},0,255 on every pixel\n`)
      .join("")
    check(
      "gfx: examples/gfx/clear.ts clears six offscreen frames to their own colours and reads each back on every pixel",
      cleared.status === 0 && cleared.stdout === expected,
      `${shown(cleared)}\nexpected:\n${expected}`
    )
  }
}
