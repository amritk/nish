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
 * **Control flow.** The body is read with its labels. Each label keeps the
 * join of every state that reaches it -- a register is secret there if it is
 * secret on any edge in, a stack offset is kept only if every edge agrees --
 * and the body is walked again until no label's state changes, so a value a
 * loop's back edge carries round is seen at the loop's head. The violations
 * are those of the last walk, on the settled states.
 *
 * **The flags, per instruction.** ct-asm.js lets the flags only ever gain a
 * secret, which is right for code with no branch at all, but would refuse
 * every loop here once the first block had been XORed. So an instruction that
 * writes every flag a branch reads (`cmp`, `test`, `add`, `sub`, `and`, `or`,
 * `xor`, `neg`, `adc`, `sbb`, `ptest`, `(u)comis`) sets them to its own taint,
 * one that writes none (moves, `lea`, `push`, `pop`, `bswap`, `not`, `set`,
 * `cmov`, and the SSE, AES-NI and PCLMULQDQ instructions but `ptest`) leaves
 * them alone, and anything else -- `inc`, a shift, a multiply -- still only
 * adds its taint. On aarch64 only a compare or an `s`-suffixed instruction
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
import { CT_TARGETS, parseInstruction, Taint } from "./ct-asm.js"

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

/** x86-64 instructions that write every flag a conditional jump reads. */
const X86_FLAGS_ASSIGN = /^(cmp|test|add|sub|and|or|xor|neg|adc|sbb)[bwlq]?$|^v?(ptest|u?comis[sd])$/
/** x86-64 instructions that write no flag. `p...` is every SSE integer instruction (and `push`, `pop`, `pdep`, `pext`), less `ptest` and `popcnt`. */
const X86_FLAGS_KEEP =
  /^(v?mov\w*|lea[wlq]?|bswap[lq]?|not[bwlq]?|set\w+|cmov\w+|cltq|cqto|cltd|cwtl|v?p(?!test|opcnt)\w+|v?aes\w+|v?(shuf|unpck[hl]|xor|andn?|or|blend)p[sd]|v?insertps|v?extractps)$/

/**
 * The `Taint` state with the flags followed per instruction (the header). The
 * step sets `mnemonic` before it runs.
 */
class RuntimeTaint extends Taint {
  taintFlags(secret) {
    if (this.target.name === "aarch64" || X86_FLAGS_ASSIGN.test(this.mnemonic)) {
      if (secret) {
        this.secret.add("flags")
      } else {
        this.secret.delete("flags")
      }
      return
    }
    if (!X86_FLAGS_KEEP.test(this.mnemonic)) {
      super.taintFlags(secret)
    }
  }
}

/** A copy of `t` that shares nothing mutable with it. */
const cloneTaint = (t) => {
  const c = new RuntimeTaint({ contents: t.contents, secretArgs: [] }, t.target)
  c.secret = new Set(t.secret)
  c.loaded = new Set(t.loaded)
  c.stackAt = new Map(t.stackAt)
  c.sp = t.sp
  c.bytes = new Map([...t.bytes].map(([at, b]) => [at, { ...b }]))
  c.unknownSecret = t.unknownSecret
  return c
}

/** Two stack places joined: the one place if both are it, "somewhere on the stack" if either is one. */
const joinPlace = (a, b) => (a === b ? a : null)

/**
 * The join of two states where control flow meets: everything secret on
 * either side is secret, and a stack place both sides do not agree on is one
 * this cannot place. A stack byte only one side wrote holds, on the other,
 * whatever the frame held, which is secret if anything unplaced was.
 */
const joinTaint = (a, b) => {
  const j = cloneTaint(a)
  for (const r of b.secret) {
    j.secret.add(r)
  }
  for (const r of b.loaded) {
    j.loaded.add(r)
  }
  for (const r of new Set([...a.stackAt.keys(), ...b.stackAt.keys()])) {
    const place = joinPlace(a.stackAt.get(r), b.stackAt.get(r))
    if (place === undefined) {
      j.stackAt.delete(r)
    } else {
      j.stackAt.set(r, place)
    }
  }
  j.sp = a.sp === b.sp ? a.sp : null
  for (const at of new Set([...a.bytes.keys(), ...b.bytes.keys()])) {
    const x = a.bytes.get(at)
    const y = b.bytes.get(at)
    if (x !== undefined && y !== undefined) {
      const same = x.from === y.from && x.width === y.width
      j.bytes.set(at, {
        secret: x.secret || y.secret,
        loaded: x.loaded || y.loaded,
        stack: joinPlace(x.stack, y.stack),
        from: same ? x.from : null,
        width: same ? x.width : null,
      })
    } else {
      const one = x ?? y
      const other = x === undefined ? a : b
      j.bytes.set(at, { ...one, secret: one.secret || other.unknownSecret, loaded: true, from: null })
    }
  }
  j.unknownSecret = a.unknownSecret || b.unknownSecret
  j.contents = a.contents || b.contents
  return j
}

/** A state as text, for telling whether a join changed anything. */
const taintKey = (t) =>
  JSON.stringify([
    [...t.secret].sort(),
    [...t.loaded].sort(),
    [...t.stackAt].sort(),
    t.sp,
    [...t.bytes].sort((x, y) => x[0] - y[0]),
    t.unknownSecret,
    t.contents,
  ])

/**
 * The lines of `symbol` in an ELF `.s` for `target`, from its label to the
 * `.Lfunc_end` after it: `{ label }` for each local label and `{ line }` for
 * each instruction, without directives or comments. `null` when the symbol is
 * not there: a check that read nothing has proved nothing.
 */
const labelledBody = (lines, symbol, target) => {
  const start = lines.findIndex((line) => line.startsWith(`${symbol}:`))
  if (start < 0) {
    return null
  }
  const body = []
  for (let i = start + 1; i < lines.length && !/^\.Lfunc_end\d+:/.test(lines[i]); i++) {
    const text = lines[i].replace(target.comment, "").trim()
    if (/^\.L\w+:$/.test(text)) {
      body.push({ label: text.slice(0, -1) })
    } else if (text.length > 0 && !text.startsWith(".") && !text.endsWith(":")) {
      body.push({ line: text })
    }
  }
  return body
}

/**
 * How an instruction moves control, if it does: `{ to, conditional, on }`,
 * where `to` is the local label it may go to and `on` the register a
 * compare-and-branch tests (else the flags). `null` for one that falls
 * through. `ret` ends the path; a jump anywhere but a local label is left to
 * the step, which refuses it as a call.
 */
const control = (target, mnemonic, operands) => {
  const label = operands.length > 0 && /^\.L\w+$/.test(operands[operands.length - 1]) ? operands.at(-1) : null
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

/**
 * Every violation in one kernel body: `{ kind, line }`, with `kind` as
 * ct-asm.js names them, `branch` meaning a conditional branch on a secret.
 * Also counts the conditional branches it judged public, so a caller can say
 * that the loops were read rather than absent.
 */
const runtimeViolations = (body, spec, target) => {
  const entry = () => new RuntimeTaint({ contents: true, secretArgs: spec.secretArgs }, target)
  const at = new Map()
  /** Joins `state` into what `label` holds; whether that changed it. */
  const reach = (label, state) => {
    const old = at.get(label)
    const joined = old === undefined ? cloneTaint(state) : joinTaint(old, state)
    if (old !== undefined && taintKey(old) === taintKey(joined)) {
      return false
    }
    at.set(label, joined)
    return true
  }
  /** One walk of the body; whether any label's state changed, and what it found. */
  const pass = () => {
    let changed = false
    const found = []
    let branches = 0
    let t = entry()
    for (const item of body) {
      if (item.label !== undefined) {
        if (t !== null) {
          changed = reach(item.label, t) || changed
        }
        t = at.has(item.label) ? cloneTaint(at.get(item.label)) : null
        continue
      }
      if (t === null) {
        continue
      }
      const [mnemonic, operands] = parseInstruction(item.line)
      const flow = control(target, mnemonic, operands)
      if (flow === null) {
        t.mnemonic = mnemonic
        const kind = target.step(t, mnemonic, operands)
        if (kind !== null) {
          found.push({ kind, line: item.line })
        }
        continue
      }
      if (flow.conditional) {
        branches++
        if (flow.to === null || conditionSecret(t, flow.on)) {
          found.push({ kind: "branch", line: item.line })
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
 * `clang -O2 -S` of `file` for `target`: the listing's lines, or the failure.
 * `-ffreestanding` because a host has its own libc's headers and no other
 * target's, and the kernels already ask for no libc calls (`no_builtin`), so
 * it changes nothing they compile to.
 */
const runtimeAsm = (root, file, target) => {
  const cc = spawnSync(
    "clang",
    ["-O2", "-S", "-ffreestanding", `--target=${target.triple}`, file, "-o", "-"],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }
  )
  return cc.status === 0 ? { ok: true, lines: cc.stdout.split("\n") } : { ok: false, why: String(cc.stderr) }
}

/**
 * Every reading this file makes, as `{ file, fn, target, expect, ok, detail }`:
 * each kernel on each target clean (`expect` null), with at least one loop
 * branch read, and each leaky variant refused for its kind (`expect` the words
 * for it). tests/run.js names the checks, so that a record citing one finds it
 * there.
 */
export const runtimeChecks = (root) => {
  const results = []
  /** `fn` read from `asm` under `spec`: its violations and loop branches, or why there is nothing to read. */
  const read = (asm, fn, spec, target) => {
    if (!asm.ok) {
      return { why: asm.why, found: [], branches: 0 }
    }
    const body = labelledBody(asm.lines, fn, target)
    if (body === null) {
      return {
        why: `no symbol ${fn} in the ${target.name} assembly: a check that read nothing proves nothing`,
        found: [],
        branches: 0,
      }
    }
    return { why: null, ...runtimeViolations(body, spec, target) }
  }
  const listed = (found) => found.map((v) => `${v.kind}: ${v.line}`).join("\n")
  for (const target of CT_TARGETS) {
    const real = runtimeAsm(root, "runtime/runtime-aes.c", target)
    for (const spec of RUNTIME_KERNELS) {
      const { why, found, branches } = read(real, spec.name, spec, target)
      results.push({
        file: "runtime-aes.c",
        fn: spec.name,
        target: target.name,
        expect: null,
        ok: why === null && found.length === 0 && branches > 0,
        detail: why ?? (listed(found) || `${branches} conditional branches, all public`),
      })
    }
    const leaky = runtimeAsm(root, path.join("tests", "simd", "aes-leaky.c"), target)
    for (const [fn, kind, what] of RUNTIME_LEAKS) {
      const { why, found } = read(leaky, fn, { secretArgs: [] }, target)
      results.push({
        file: "tests/simd/aes-leaky.c",
        fn,
        target: target.name,
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
    const body = lines.map((line) => (line.endsWith(":") ? { label: line.slice(0, -1) } : { line }))
    const { found } = runtimeViolations(body, { secretArgs }, target)
    if (kind === null ? found.length > 0 : !found.some((v) => v.kind === kind)) {
      missed.push(
        `${name}, expected ${kind ?? "no violation"}: ${lines.join("; ")}\n  found: ${found.map((v) => `${v.kind}: ${v.line}`).join("; ") || "nothing"}`
      )
    }
  }
  return missed
}

const missedCorners = cornerMisses()
if (missedCorners.length > 0) {
  throw new Error(`tests/ct-asm-runtime.js misreads the corners of its model:\n${missedCorners.join("\n")}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = path.join(import.meta.dirname, "..")
  let failed = 0
  for (const r of runtimeChecks(root)) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.file} ${r.fn} on ${r.target}: ${r.expect ?? "clean"}`)
    if (!r.ok) {
      failed++
      console.log(r.detail)
    }
  }
  process.exit(failed > 0 ? 1 : 0)
}
