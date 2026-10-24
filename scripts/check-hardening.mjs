#!/usr/bin/env node
// Reads the hardening a native binary carries, from its headers rather than
// from the flags that should have put it there.
//
//   node scripts/check-hardening.mjs <binary> [--imports name,name,...]
//
// An ELF binary must be position independent (DYN), carry GNU_RELRO, bind now
// (DF_BIND_NOW or DF_1_NOW), have a GNU_STACK header without E, and carry
// control-flow protection: the x86 feature note naming IBT and SHSTK, or on
// AArch64 the feature note naming BTI and PAC, or failing that `bti` and
// `paciasp` in its code. The note is the linker's AND over every object, the C
// library's start files included, so the instructions are what show that the
// objects scripts/build.sh compiled carry the protection when a start file
// does not. A Mach-O binary must be MH_PIE and must not be
// MH_ALLOW_STACK_EXECUTION.
//
// `--imports` names undefined symbols the binary must import, without
// Mach-O's leading underscore: `__stack_chk_fail` shows the stack protector
// reached it, and a `__*_chk` function shows _FORTIFY_SOURCE did. Whether one
// appears depends on the code linked, so the caller names them. Exits 0 when
// every property holds, 1 naming the ones that do not, and 2 when no tool to
// read the binary is installed. tests/run.js ("hardening") and CI's
// `bootstrap` job call it (docs/security/runtime.md, RT-HARDEN).

import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

/** The first of `names` that runs, or null. */
const firstTool = (names) =>
  names.find((name) => spawnSync(name, ["--version"], { encoding: "utf8" }).status === 0) ?? null

const run = (tool, args) => {
  const r = spawnSync(tool, args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
  return r.status === 0 ? r.stdout : null
}

const ELF_MAGIC = "7f454c46"
const MACHO_MAGICS = ["cffaedfe", "cefaedfe", "feedfacf", "feedface"]

const magicOf = (file) => {
  const fd = fs.openSync(file, "r")
  const buf = Buffer.alloc(4)
  fs.readSync(fd, buf, 0, 4, 0)
  fs.closeSync(fd)
  return buf.toString("hex")
}

const elfProblems = (file, imports) => {
  const readelf = firstTool(["llvm-readelf", "llvm-readelf-18", "readelf"])
  if (readelf === null) {
    return { skip: "no llvm-readelf or readelf on PATH", problems: [] }
  }
  const out = run(readelf, ["-W", "-h", "-l", "-d", "-n", "--dyn-syms", file])
  if (out === null) {
    return { skip: null, problems: [`${readelf} could not read ${file}`] }
  }
  const problems = []
  const type = /^\s*Type:\s+(\S+)/m.exec(out)
  if (type === null || type[1] !== "DYN") {
    problems.push(`not position independent: Type is ${type === null ? "missing" : type[1]}, not DYN`)
  }
  if (!/^\s*GNU_RELRO\s/m.test(out)) {
    problems.push("no GNU_RELRO program header (-z relro)")
  }
  const flags = /\(FLAGS\)\s+(.*)$/m.exec(out)
  const flags1 = /\(FLAGS_1\)\s+(.*)$/m.exec(out)
  const bindNow =
    (flags !== null && /\bBIND_NOW\b/.test(flags[1])) || (flags1 !== null && /\bNOW\b/.test(flags1[1]))
  if (!bindNow) {
    problems.push("does not bind now: no BIND_NOW in FLAGS or NOW in FLAGS_1 (-z now), so RELRO is partial")
  }
  const stack = /^\s*GNU_STACK\s+(?:0x[0-9a-f]+\s+){5}([RWE ]{3})/m.exec(out)
  if (stack === null) {
    problems.push("no GNU_STACK program header, so the stack may be executable (-z noexecstack)")
  } else if (stack[1].includes("E")) {
    problems.push(`the stack is executable: GNU_STACK flags are "${stack[1].trim()}"`)
  }
  const machine = /^\s*Machine:\s+(.*)$/m.exec(out)
  const machineName = machine === null ? "" : machine[1]
  if (/X86-64/.test(machineName)) {
    const note = /x86 feature:\s*(.*)$/m.exec(out)
    if (note === null || !/\bIBT\b/.test(note[1]) || !/\bSHSTK\b/.test(note[1])) {
      problems.push(
        `no control-flow protection: the x86 feature note is ${note === null ? "missing" : `"${note[1].trim()}"`}, not IBT, SHSTK (-fcf-protection=full)`
      )
    }
  } else if (/AArch64/.test(machineName)) {
    const note = /AArch64 feature:\s*(.*)$/m.exec(out)
    if (note === null || !/\bBTI\b/.test(note[1]) || !/\bPAC\b/.test(note[1])) {
      problems.push(...aarch64CodeProblems(file))
    }
  }
  const undefinedNames = new Set(
    out
      .split("\n")
      .filter((line) => /\sUND\s/.test(line))
      .map((line) => line.trim().split(/\s+/).at(-1).replace(/@.*$/, ""))
  )
  for (const name of imports) {
    if (!undefinedNames.has(name)) {
      problems.push(`does not import ${name}`)
    }
  }
  return { skip: null, problems }
}

/** Without the feature note, the protection shown in the instructions themselves. */
const aarch64CodeProblems = (file) => {
  const objdump = firstTool(["llvm-objdump", "llvm-objdump-18", "objdump"])
  if (objdump === null) {
    return ["no AArch64 feature note naming BTI and PAC, and no llvm-objdump to look for the instructions"]
  }
  const code = run(objdump, ["-d", "--no-show-raw-insn", file]) ?? ""
  const problems = []
  if (!/\sbti\b/.test(code)) {
    problems.push(
      "no BTI: neither the AArch64 feature note nor a `bti` instruction (-mbranch-protection=standard)"
    )
  }
  if (!/\spaciasp\b/.test(code)) {
    problems.push(
      "no return-address signing: neither the AArch64 feature note nor a `paciasp` instruction (-mbranch-protection=standard)"
    )
  }
  return problems
}

const machoProblems = (file, imports) => {
  const readobj = firstTool(["llvm-readobj", "llvm-readobj-18"])
  if (readobj === null) {
    return { skip: "no llvm-readobj on PATH", problems: [] }
  }
  const header = run(readobj, ["--file-headers", file])
  if (header === null) {
    return { skip: null, problems: [`${readobj} could not read ${file}`] }
  }
  const problems = []
  if (!/\bMH_PIE\b/.test(header)) {
    problems.push("not position independent: no MH_PIE flag")
  }
  if (/\bMH_ALLOW_STACK_EXECUTION\b/.test(header)) {
    problems.push("the stack is executable: MH_ALLOW_STACK_EXECUTION is set")
  }
  if (imports.length > 0) {
    const nm = firstTool(["llvm-nm", "llvm-nm-18", "nm"])
    const names = new Set(
      (nm === null ? "" : (run(nm, ["-u", file]) ?? ""))
        .split("\n")
        .map((line) => line.trim().split(/\s+/).at(-1) ?? "")
        .map((name) => (name.startsWith("_") ? name.slice(1) : name))
    )
    for (const name of imports) {
      if (!names.has(name)) {
        problems.push(`does not import ${name}`)
      }
    }
  }
  return { skip: null, problems }
}

/**
 * What `file` lacks of the hardening, or why it could not be read: `skip` is
 * the missing tool, and `problems` is empty when every property holds.
 */
export const hardeningProblems = (file, imports = []) => {
  const magic = magicOf(file)
  if (magic === ELF_MAGIC) {
    return elfProblems(file, imports)
  }
  if (MACHO_MAGICS.includes(magic)) {
    return machoProblems(file, imports)
  }
  return { skip: null, problems: [`${file} is neither ELF nor Mach-O (magic ${magic})`] }
}

const main = () => {
  const args = process.argv.slice(2)
  const at = args.indexOf("--imports")
  const imports = at < 0 ? [] : (args[at + 1] ?? "").split(",").filter((name) => name !== "")
  const files = at < 0 ? args : args.filter((_, i) => i !== at && i !== at + 1)
  if (files.length !== 1 || (at >= 0 && imports.length === 0)) {
    process.stderr.write("usage: node scripts/check-hardening.mjs <binary> [--imports name,name,...]\n")
    process.exit(2)
  }
  const result = hardeningProblems(files[0], imports)
  if (result.skip !== null) {
    process.stderr.write(`check-hardening: ${result.skip}\n`)
    process.exit(2)
  }
  if (result.problems.length > 0) {
    for (const problem of result.problems) {
      process.stderr.write(`check-hardening: ${files[0]}: ${problem}\n`)
    }
    process.exit(1)
  }
  process.stdout.write(`check-hardening: ${files[0]}: hardened\n`)
}

if (path.resolve(process.argv[1] ?? "") === import.meta.filename) {
  main()
}
