/**
 * The constant-time check of the runtime's AES kernels (WP38 S5): does each
 * function of runtime/runtime-aes.c stay constant time after `clang -O2`?
 *
 * tests/ct-asm.js reads straight-line Nish functions and refuses every
 * conditional branch. A kernel that encrypts `length` bytes has to loop, so
 * this reads `clang -O2 -S` of the C file for x86-64 and aarch64 and refuses,
 * in every kernel function (`RUNTIME_KERNELS`; the resolver `nish_aes_hw` is
 * the one exception, docs/security/ct-verification.md):
 *
 *   - **a conditional branch on a secret**: one whose flags, or whose register
 *     for `cbz` / `tbz`, a key, data, H or the GHASH state reaches. What is
 *     left is a branch on `length`, `rounds`, an array header or an address:
 *     the loop bounds the module calls public;
 *   - **a load or store whose address a secret reaches**, a call, and a divide
 *     of a secret, exactly as tests/ct-asm.js refuses them.
 *
 * It reuses ct-asm.js's taint model rather than writing a second one: the same
 * `Taint` state and the same per-instruction steps, so a corner that model
 * learns is learnt here too. Every argument of a kernel is an array header,
 * whose fields are public and whose elements are secret (`contents`), except
 * `rounds` and `length`, which are public, and GHASH's `hHi` and `hLo`, which
 * are secret. Two things are added, because code with loops needs them:
 *
 * **Control flow.** The body is read with its labels (`functionBody`'s
 * `labels`). Each label keeps the
 * join of every state that reaches it (`Taint.join`: a register is secret
 * there if it is secret on any edge in, a stack offset is kept only if every
 * edge agrees)
 * and the body is walked again until no label's state changes, so a value a
 * loop's back edge carries round is seen at the loop's head. The violations
 * are those of the last walk, on the settled states.
 *
 * **The flags, per instruction.** ct-asm.js lets the flags only ever gain a
 * secret, which is right for code with no branch at all, but would refuse
 * every loop here once the first block had been XORed. So this reads with the
 * model's `preciseFlags`, whose tables live beside the steps: an instruction that
 * writes every flag a branch reads (`cmp`, `test`, `add`, `sub`, `and`, `or`,
 * `xor`, `neg`, `adc`, `sbb`, `ptest`, `(u)comis`) sets them to its own taint,
 * one that writes none (moves, `lea`, `push`, `pop`, `bswap`, `not`, `set`,
 * `cmov`, and the SSE, AES-NI and PCLMULQDQ instructions but `ptest` and the
 * string compares, `pcmp[ei]str[im]`) leaves them alone, and anything else --
 * `inc`, a shift, a multiply, a string compare -- still only adds its taint. On aarch64 only a compare or an `s`-suffixed instruction
 * writes the flags, and each writes all four, so the step's own taint is the
 * flags'.
 *
 * What this does not model is said in docs/security/ct-verification.md: the
 * resolver, the instructions' own timing (AESENC and PCLMULQDQ are constant
 * time on every processor that has them, by Intel's and Arm's statements), and
 * anything below the instruction set.
 *
 *   node tests/ct-asm-runtime.js   checks runtime/runtime-aes.c and the leaky
 *                                  variants in tests/simd/aes-leaky.c, prints
 *                                  one line per check, and exits 1 on a failure
 */

import { spawnSync } from "node:child_process"
import path from "node:path"
import { CT_TARGETS, functionBody, parseInstruction, Taint } from "./ct-asm.js"

/**
 * The kernels and what is secret in each, by argument position: the elements
 * of every array (`contents`) and, for GHASH, H's two words.
 */
const RUNTIME_KERNELS = [
  { name: "nish_aes_schedule", secretArgs: [] },
  { name: "nish_aes_block", secretArgs: [] },
  { name: "nish_aes_ctr", secretArgs: [] },
  { name: "nish_aes_ghash", secretArgs: [1, 2] },
]

/**
 * tests/simd/aes-leaky.c: kernels shaped like the real ones, each with one
 * leak the check must find, `[function, kind, what the kind is]`.
 */
const RUNTIME_LEAKS = [
  ["nish_aes_leaky_table", "load", "a load at a secret address"],
  ["nish_aes_leaky_branch", "branch", "a branch on a secret"],
]

/**
 * How an instruction moves control, if it does: `{ to, conditional, on }`,
 * where `to` is the local label it may go to and `on` the register a
 * compare-and-branch tests (else the flags). `null` for one that falls
 * through. `ret` ends the path; a jump anywhere but a local label is left to
 * the step, which refuses it as a call.
 */
const control = (target, mnemonic, operands) => {
  const last = operands.at(-1)
  const label = last !== undefined && /^\.L\w+$/.test(last) ? last : null
  if (target.name === "x86-64") {
    if (/^ret/.test(mnemonic)) {
      return { to: null, conditional: false }
    }
    if (/^jmp[wlq]?$/.test(mnemonic)) {
      return label === null ? null : { to: label, conditional: false }
    }
    if (/^j[a-z]+$/.test(mnemonic) && !/^j[er]?cxz$/.test(mnemonic)) {
      return { to: label, conditional: true, on: "flags" }
    }
    return null
  }
  if (mnemonic === "ret") {
    return { to: null, conditional: false }
  }
  if (mnemonic === "b") {
    return label === null ? null : { to: label, conditional: false }
  }
  if (/^bc?\.\w+$/.test(mnemonic)) {
    return { to: label, conditional: true, on: "flags" }
  }
  if (/^(cbn?z|tbn?z)$/.test(mnemonic)) {
    return { to: label, conditional: true, on: operands[0] }
  }
  return null
}

/** Whether the condition a branch reads is secret in `t`. */
const conditionSecret = (t, on) => {
  if (on === "flags") {
    return t.secret.has("flags")
  }
  // `cbz w8` and `tbz x8, #3` test one general register, `w8` and `x8` both `r8`.
  const m = on.match(/^[wx](\d+)$/)
  return m === null || t.secret.has(`r${m[1]}`)
}

/** Violations as text, one a line. */
const listed = (found, separator = "\n") => found.map((v) => `${v.kind}: ${v.line}`).join(separator)

/**
 * Every violation in one kernel body, a listing with its labels kept
 * (`functionBody`'s `labels`): `{ kind, line }`, with `kind` as ct-asm.js
 * names them, `branch` meaning a conditional branch on a secret. Also counts
 * the conditional branches it judged public, so a caller can say that the
 * loops were read rather than absent. `secretArgs` are the argument positions
 * that are secret beside every array's elements.
 */
const runtimeViolations = (body, secretArgs, target) => {
  const entry = () => new Taint({ contents: true, secretArgs, preciseFlags: true }, target)
  /** Each label's joined state, with its key kept beside it so a join is compared once. */
  const at = new Map()
  /** Joins `state` into what `label` holds; whether that changed it. */
  const reach = (label, state) => {
    const old = at.get(label)
    const joined = old === undefined ? state.clone() : old.state.join(state)
    const key = joined.key()
    if (old !== undefined && old.key === key) {
      return false
    }
    at.set(label, { state: joined, key })
    return true
  }
  /** One walk of the body; whether any label's state changed, and what it found. */
  const pass = () => {
    let changed = false
    const found = []
    let branches = 0
    let t = entry()
    for (const line of body) {
      if (line.endsWith(":")) {
        const label = line.slice(0, -1)
        if (t !== null) {
          changed = reach(label, t) || changed
        }
        t = at.has(label) ? at.get(label).state.clone() : null
        continue
      }
      if (t === null) {
        continue
      }
      const [mnemonic, operands] = parseInstruction(line)
      const flow = control(target, mnemonic, operands)
      if (flow === null) {
        const kind = target.step(t, mnemonic, operands)
        if (kind !== null) {
          found.push({ kind, line })
        }
        continue
      }
      if (flow.conditional) {
        branches++
        if (flow.to === null || conditionSecret(t, flow.on)) {
          found.push({ kind: "branch", line })
        }
      }
      if (flow.to !== null) {
        changed = reach(flow.to, t) || changed
      }
      if (!flow.conditional) {
        t = null
      }
    }
    return { changed, found, branches }
  }
  // Each walk only joins more into a label, and there are finitely many
  // registers and stack bytes, so this settles; the bound is a guard against
  // a bug here, reported rather than looped on.
  for (let i = 0; i < 64; i++) {
    const { changed, found, branches } = pass()
    if (!changed) {
      return { found, branches }
    }
  }
  return { found: [{ kind: "unsettled", line: "the label states did not settle in 64 walks" }], branches: 0 }
}

/**
 * The x86-64 target read at `march`, the one level `nish --cpu` accepts
 * (docs/LANGUAGE.md, "The CPU level"): the same model as the baseline, since
 * `name` picks the steps, with the level in `level` and the flag clang is
 * given in `flags`. A target without `level` is read at the baseline.
 */
export const ctAtLevel = (march) => ({ ...CT_TARGETS[0], level: march, flags: [`-march=${march}`] })

/** How a check names `target`: `x86-64`, or `x86-64 at x86-64-v3` for a level. */
export const ctTargetName = (target) =>
  target.level === undefined ? target.name : `${target.name} at ${target.level}`

/**
 * `clang -O2 -S` of `file` for `target`: the listing's lines, or the failure.
 * `-ffreestanding` because a host has its own libc's headers and no other
 * target's, and the kernels already ask for no libc calls (`no_builtin`), so
 * it changes nothing they compile to.
 */
const runtimeAsm = (root, file, target) => {
  const cc = spawnSync(
    "clang",
    ["-O2", "-S", "-ffreestanding", `--target=${target.triple}`, ...(target.flags ?? []), file, "-o", "-"],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }
  )
  return cc.status === 0 ? { ok: true, lines: cc.stdout.split("\n") } : { ok: false, why: String(cc.stderr) }
}

/**
 * How a listing's exported functions (its `.globl` symbols) differ from the
 * kernels this file reads and the resolver: `unread`, exported and never read,
 * and `missing`, read and not exported. Both empty means a fifth kernel cannot
 * be added without this file reading it.
 */
const exportGap = (lines) => {
  const exported = lines
    .map((line) => line.match(/^\s*\.globl\s+(\w+)/)?.[1])
    .filter((name) => name !== undefined)
  const named = [...RUNTIME_KERNELS.map((spec) => spec.name), "nish_aes_hw"]
  return {
    unread: exported.filter((name) => !named.includes(name)),
    missing: named.filter((name) => !exported.includes(name)),
  }
}

/**
 * Every reading this file makes, as `{ file, fn, target, kind, expect, ok, detail }`:
 * `kind` `exports` for the unit's exported functions being exactly the kernels
 * read here and the resolver, so a fifth kernel cannot go unread; `kernel` for
 * each kernel on each target clean, with at least one loop branch read; and
 * `leak` for each leaky variant refused for its kind (`expect` the words for
 * it). tests/run.js names the checks, so that a record citing one finds it
 * there.
 *
 * `march` empty reads both targets at the baseline; a level (`x86-64-v3`)
 * reads x86-64 alone with `-march=` that level, `target` naming it.
 */
export const runtimeChecks = (root, march = "") => {
  const results = []
  /** `fn` read from `asm` with `secretArgs`: its violations and loop branches, or why there is nothing to read. */
  const read = (asm, fn, secretArgs, target) => {
    if (!asm.ok) {
      return { why: asm.why, found: [], branches: 0 }
    }
    const body = functionBody(asm.lines, fn, target, { labels: true })
    if (body === null) {
      return {
        why: `no symbol ${fn} in the ${target.name} assembly: a check that read nothing proves nothing`,
        found: [],
        branches: 0,
      }
    }
    return { why: null, ...runtimeViolations(body, secretArgs, target) }
  }
  for (const target of march === "" ? CT_TARGETS : [ctAtLevel(march)]) {
    const real = runtimeAsm(root, "runtime/runtime-aes.c", target)
    const { unread, missing } = exportGap(real.ok ? real.lines : [])
    results.push({
      file: "runtime-aes.c",
      fn: "exports",
      target: ctTargetName(target),
      kind: "exports",
      expect: null,
      ok: real.ok && unread.length === 0 && missing.length === 0,
      detail: real.ok
        ? `exported and unread: ${unread.join(" ") || "none"}; read and not exported: ${missing.join(" ") || "none"}`
        : real.why,
    })
    for (const spec of RUNTIME_KERNELS) {
      const { why, found, branches } = read(real, spec.name, spec.secretArgs, target)
      results.push({
        file: "runtime-aes.c",
        fn: spec.name,
        target: ctTargetName(target),
        kind: "kernel",
        expect: null,
        ok: why === null && found.length === 0 && branches > 0,
        detail: why ?? (listed(found) || `${branches} conditional branches, all public`),
      })
    }
    const leaky = runtimeAsm(root, path.join("tests", "simd", "aes-leaky.c"), target)
    for (const [fn, kind, what] of RUNTIME_LEAKS) {
      const { why, found } = read(leaky, fn, [], target)
      results.push({
        file: "tests/simd/aes-leaky.c",
        fn,
        target: ctTargetName(target),
        kind: "leak",
        expect: what,
        ok: why === null && found.some((v) => v.kind === kind),
        detail: why ?? (listed(found) || "no violation found"),
      })
    }
  }
  return results
}

/**
 * The corners of what this file adds to ct-asm.js's model: a branch on a loop
 * counter passes, one on data does not, a value the back edge brings round to
 * the loop's head is seen there, and the flags follow the last instruction
 * that wrote them. `[target, secretArgs, kind, body]`, `kind` `null` for a
 * shape that must pass. Checked when this module loads.
 */
const CORNERS = [
  // A counted loop over public `length` (the sixth argument), XORing secrets.
  [
    "x86-64",
    [],
    null,
    [
      "movq 16(%rdi), %rax",
      "xorl %ecx, %ecx",
      ".LBB0_1:",
      "movdqu (%rax,%rcx), %xmm0",
      "pxor %xmm0, %xmm1",
      "addq $16, %rcx",
      "cmpq %r9, %rcx",
      "jb .LBB0_1",
      "retq",
    ],
  ],
  // The same with a byte of data as the bound.
  [
    "x86-64",
    [],
    "branch",
    [
      "movq 16(%rdi), %rax",
      "movzbl (%rax), %r9d",
      "xorl %ecx, %ecx",
      ".LBB0_1:",
      "incq %rcx",
      "cmpq %r9, %rcx",
      "jb .LBB0_1",
      "retq",
    ],
  ],
  // A secret the back edge carries into the register the loop then indexes by:
  // a single walk in order would read the index as the public zero it starts as.
  [
    "x86-64",
    [],
    "load",
    [
      "movq 16(%rdi), %rax",
      "xorl %ecx, %ecx",
      "xorl %edx, %edx",
      ".LBB0_1:",
      "movl (%rsi,%rdx,4), %r8d",
      "movzbl (%rax,%rcx), %edx",
      "incq %rcx",
      "cmpq %r9, %rcx",
      "jb .LBB0_1",
      "retq",
    ],
  ],
  // A forward jump past the code that would have cleared a secret.
  [
    "x86-64",
    [],
    "load",
    [
      "movq 16(%rdi), %rax",
      "movzbl (%rax), %edx",
      "testq %r9, %r9",
      "je .LBB0_2",
      "xorl %edx, %edx",
      ".LBB0_2:",
      "movl (%rsi,%rdx,4), %eax",
      "retq",
    ],
  ],
  // A vector instruction between the compare and the branch leaves the flags public.
  [
    "x86-64",
    [],
    null,
    [
      "movq 16(%rdi), %rax",
      "cmpq $16, %r9",
      "movdqu (%rax), %xmm0",
      "pxor %xmm0, %xmm1",
      "jb .LBB0_2",
      ".LBB0_2:",
      "retq",
    ],
  ],
  // A shift of a secret only adds to the flags, so a branch after it is refused.
  [
    "x86-64",
    [],
    "branch",
    [
      "movq 16(%rdi), %rax",
      "movq (%rax), %rdx",
      "cmpq $16, %r9",
      "shlq $3, %rdx",
      "jb .LBB0_2",
      ".LBB0_2:",
      "retq",
    ],
  ],
  // aarch64: a loop on public `length` (x5), and `cbz` on a secret.
  [
    "aarch64",
    [],
    null,
    [
      "ldr x8, [x0, #16]",
      "mov x9, xzr",
      ".LBB0_1:",
      "ldr q0, [x8, x9]",
      "eor v1.16b, v1.16b, v0.16b",
      "add x9, x9, #16",
      "cmp x9, x5",
      "b.lo .LBB0_1",
      "ret",
    ],
  ],
  [
    "aarch64",
    [],
    "branch",
    ["ldr x8, [x0, #16]", "ldrb w9, [x8]", "cbz w9, .LBB0_2", "nop", ".LBB0_2:", "ret"],
  ],
  // GHASH's H, a secret argument, as a bound.
  ["aarch64", [1], "branch", ["cmp x1, #4", "b.hi .LBB0_2", "nop", ".LBB0_2:", "ret"]],
]

const cornerMisses = () => {
  const missed = []
  for (const [name, secretArgs, kind, lines] of CORNERS) {
    const target = CT_TARGETS.find((t) => t.name === name)
    const { found } = runtimeViolations(lines, secretArgs, target)
    if (kind === null ? found.length > 0 : !found.some((v) => v.kind === kind)) {
      missed.push(
        `${name}, expected ${kind ?? "no violation"}: ${lines.join("; ")}\n  found: ${listed(found, "; ") || "nothing"}`
      )
    }
  }
  return missed
}

/**
 * The exports comparison's own corners: the unit's five, which pass; a sixth
 * global, which must be named as unread; and one of the five gone, which must
 * be named as missing.
 */
const exportMisses = () => {
  const five = [...RUNTIME_KERNELS.map((spec) => spec.name), "nish_aes_hw"].map((name) => `\t.globl\t${name}`)
  const missed = []
  const clean = exportGap(five)
  if (clean.unread.length > 0 || clean.missing.length > 0) {
    missed.push("the five exports read as differing from themselves")
  }
  if (exportGap([...five, "\t.globl\tnish_aes_extra"]).unread.join() !== "nish_aes_extra") {
    missed.push("a sixth exported function, nish_aes_extra, is not named as unread")
  }
  if (exportGap(five.slice(1)).missing.join() !== RUNTIME_KERNELS[0].name) {
    missed.push(`${RUNTIME_KERNELS[0].name} left out of the listing is not named as missing`)
  }
  return missed
}

const missedCorners = [...cornerMisses(), ...exportMisses()]
if (missedCorners.length > 0) {
  throw new Error(`tests/ct-asm-runtime.js misreads the corners of its model:\n${missedCorners.join("\n")}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = path.join(import.meta.dirname, "..")
  let failed = 0
  for (const r of [...runtimeChecks(root), ...runtimeChecks(root, "x86-64-v3")]) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.file} ${r.fn} on ${r.target}: ${r.expect ?? r.kind}`)
    if (!r.ok) {
      failed++
      console.log(r.detail)
    }
  }
  process.exit(failed > 0 ? 1 : 0)
}
