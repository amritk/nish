/**
 * The WP34 N6 assembly check: does a constant-time function stay constant time
 * after LLVM has seen it?
 *
 * `ctSelect` and `ctEq` are lowered behind an optimisation barrier so that
 * `opt -O2` cannot turn a mask back into a `select` and `llc` cannot turn that
 * `select` into a branch (docs/LANGUAGE.md, "Constant time"). A golden `.ll`
 * cannot show that the promise holds, because the promise is about the machine
 * code: this reads the `.s` that `clang -O2 -S` writes for x86-64 and aarch64
 * and refuses, inside each function a fixture names,
 *
 *   - **any conditional branch** — `j<cc>` (every `j` but `jmp`), `loop`,
 *     `jrcxz` on x86-64; `b.<cond>`, `cbz`, `cbnz`, `tbz` and `tbnz` on
 *     aarch64 — whether or not it depends on a secret, because a function
 *     that is straight-line cannot leak through its branches at all;
 *   - **any call**, because the callee is code this check does not read;
 *   - **any load or store whose address depends on a secret**.
 *
 * The last is a taint analysis over registers, and it is only as good as what
 * it models, so here is what that is. A register is *secret* when it holds a
 * secret argument the fixture names, a byte loaded out of an array whose
 * contents the fixture calls secret, or any value computed from one — the
 * condition flags included, so `sete` or `csetm` after a secret compare is
 * secret. "Loaded out of an array" means loaded through a pointer that itself
 * came out of memory: an array is a header whose `data` field is loaded first,
 * so the header read is public and the element read behind it is not. A value
 * stored to the stack and loaded back keeps its taint, by the slot's text.
 * The pass runs once, in order, which is exact for straight-line code; code
 * with a conditional branch has already failed. What it does not model is
 * other memory: a secret written through a pointer and read back through
 * another is lost, which the fixtures, small and register-allocated, do not do.
 *
 * A fixture says which functions to read and what is secret in comments:
 *
 * ```ts
 * // ct-check: macEqual secret=contents
 * // ct-check: selectU32 secret=mask,a,b
 * // ct-check: naiveEqual secret=contents expect=branch
 * ```
 *
 * `secret=` names parameters, or `contents` for the elements of every array
 * argument. `expect=branch` or `expect=load` marks a function written to fail,
 * which is how the suite proves the check can: it must find that violation.
 */

/** The two targets, with the registers the first integer arguments arrive in. */
export const CT_TARGETS = [
  {
    name: "x86-64",
    triple: "x86_64-unknown-linux-gnu",
    args: ["di", "si", "d", "c", "r8", "r9"],
    comment: /#.*$/,
  },
  {
    name: "aarch64",
    triple: "aarch64-unknown-linux-gnu",
    args: ["r0", "r1", "r2", "r3", "r4", "r5", "r6", "r7"],
    // `#` starts an immediate here, not a comment.
    comment: /\/\/.*$/,
  },
]

/**
 * Every `// ct-check:` line of a fixture, with each secret parameter turned into
 * its position from the function's own signature.
 */
export const ctSpecs = (source) => {
  const specs = []
  for (const m of source.matchAll(/^\/\/ ct-check: (\w+) secret=([\w,]+)(?: expect=(branch|load))?\s*$/gm)) {
    const [, name, secret, expect] = m
    const signature = source.match(new RegExp(`export const ${name} = \\(([^)]*)\\)`))
    const params = signature === null ? [] : signature[1].split(",").map((p) => p.split(":")[0].trim())
    const names = secret.split(",")
    specs.push({
      name,
      found: signature !== null,
      contents: names.includes("contents"),
      secretArgs: names.filter((n) => n !== "contents").map((n) => params.indexOf(n)),
      expect: expect ?? null,
    })
  }
  return specs
}

/**
 * The instruction lines of `symbol` in an ELF `.s` for `target`, from its label to the
 * `.Lfunc_end` LLVM writes after it: no directives, labels or comments. `null`
 * when the symbol is not there, which the caller treats as a failure — a check
 * that read nothing has proved nothing.
 */
export const functionBody = (asm, symbol, target) => {
  const lines = asm.split("\n")
  const start = lines.findIndex((line) => line === `${symbol}:` || line.startsWith(`${symbol}:`))
  if (start < 0) {
    return null
  }
  const body = []
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\.Lfunc_end\d+:/.test(lines[i])) {
      break
    }
    const text = lines[i].replace(target.comment, "").trim()
    if (text.length === 0 || text.startsWith(".") || text.endsWith(":")) {
      continue
    }
    body.push(text)
  }
  return body
}

/** Split operands on the commas outside `()`, `[]` and `{}`. */
const splitOperands = (text) => {
  const out = []
  let depth = 0
  let current = ""
  for (const ch of text) {
    if (ch === "(" || ch === "[" || ch === "{") {
      depth++
    } else if (ch === ")" || ch === "]" || ch === "}") {
      depth--
    }
    if (ch === "," && depth === 0) {
      out.push(current.trim())
      current = ""
    } else {
      current += ch
    }
  }
  if (current.trim().length > 0) {
    out.push(current.trim())
  }
  return out
}

/** An x86-64 register, as the one physical register every width of it names. */
const x86Register = (name) => {
  const r = name.replace(/^%/, "")
  const legacy = r.match(/^[re]?([abcd])[xlh]$/)
  if (legacy !== null) {
    return legacy[1]
  }
  const indexed = r.match(/^[re]?(si|di|bp|sp)l?$/)
  if (indexed !== null) {
    return indexed[1]
  }
  const numbered = r.match(/^(r\d+)[dwb]?$/)
  if (numbered !== null) {
    return numbered[1]
  }
  const vector = r.match(/^[xyz]mm(\d+)$/)
  if (vector !== null) {
    return `v${vector[1]}`
  }
  return r
}

/** An aarch64 register, likewise: `x3` and `w3` are `r3`; `q0`, `d0` and `v0.16b` are `v0`. */
const armRegister = (name) => {
  const r = name.split(".")[0].replace(/\[\d+\]$/, "")
  const general = r.match(/^[xw](\d+)$/)
  if (general !== null) {
    return `r${general[1]}`
  }
  const vector = r.match(/^[vqdshb](\d+)$/)
  if (vector !== null) {
    return `v${vector[1]}`
  }
  if (r === "wsp") {
    return "sp"
  }
  if (r === "xzr" || r === "wzr") {
    return "zero"
  }
  return r
}

/** The registers an operand reads, and whether it is a memory operand (and then which address). */
const x86Operand = (text) => {
  const open = text.indexOf("(")
  if (open >= 0) {
    const inside = text.slice(open + 1, text.lastIndexOf(")"))
    const address = [...inside.matchAll(/%\w+/g)].map((m) => x86Register(m[0]))
    return { memory: true, address, registers: address, text }
  }
  const registers = [...text.matchAll(/%\w+/g)].map((m) => x86Register(m[0]))
  return { memory: false, address: [], registers, text }
}

const ARM_REGISTER = /\b(?:[xw]\d+|[vqdshb]\d+(?:\.\w+)?|sp|wsp|xzr|wzr)\b/g

const armOperand = (text) => {
  if (text.startsWith("[")) {
    const inside = text.slice(1, text.indexOf("]"))
    const address = [...inside.matchAll(ARM_REGISTER)].map((m) => armRegister(m[0]))
    return { memory: true, address, registers: address, text: `[${inside}]` }
  }
  const registers = [...text.matchAll(ARM_REGISTER)].map((m) => armRegister(m[0]))
  return { memory: false, address: [], registers, text }
}

/** A stack slot is memory this check can follow, by the operand's text. */
const isStackSlot = (operand) =>
  operand.memory &&
  operand.address.length === 1 &&
  (operand.address[0] === "sp" || operand.address[0] === "bp")

/**
 * Taint state: per register, whether it is secret and whether it came out of
 * memory (a loaded pointer, whose element reads are secret under `contents`).
 * `flags` is the condition register, as a register of its own.
 */
class Taint {
  constructor(spec, target) {
    this.secret = new Set()
    this.loaded = new Set()
    this.slots = new Map()
    this.stack = []
    this.contents = spec.contents
    for (const index of spec.secretArgs) {
      if (index >= 0 && index < target.args.length) {
        this.secret.add(target.args[index])
      }
    }
  }

  anySecret(registers) {
    return registers.some((r) => this.secret.has(r))
  }

  anyLoaded(registers) {
    return registers.some((r) => this.loaded.has(r))
  }

  set(register, secret, loaded) {
    if (register === "zero") {
      return
    }
    if (secret) {
      this.secret.add(register)
    } else {
      this.secret.delete(register)
    }
    if (loaded) {
      this.loaded.add(register)
    } else {
      this.loaded.delete(register)
    }
  }

  /**
   * What a load from `operand` yields: a stack slot gives back what was stored
   * there; an element read through a loaded pointer is secret under `contents`;
   * anything else is public, and is itself a loaded value.
   */
  loadFrom(operand) {
    if (isStackSlot(operand) && this.slots.has(operand.text)) {
      return this.slots.get(operand.text)
    }
    return { secret: this.contents && this.anyLoaded(operand.address), loaded: true }
  }
}

const X86_BRANCH = /^(j(?!mp\b)[a-z]+|loop\w*|j[er]?cxz)$/
const X86_OVERWRITE =
  /^(v?mov|lea|set|cvt|v?pmovmsk|v?movmsk|v?pbroadcast|v?pshuf|bsf|bsr|tzcnt|lzcnt|popcnt)/
const X86_COMPARE = /^(cmp|test|bt|v?u?comis|v?ptest)/
const X86_READS_FLAGS = /^(set|cmov|sbb|adc|rcl|rcr)/
const X86_ZERO_IDIOM = /^(v?p?xor|sub|v?xorp[sd]|v?psub[bwdq])/
const X86_WIDE = /^(i?mul|i?div)[bwlq]?$/

/** One x86-64 (AT&T) instruction: the violation it is, if any, and its effect on `t`. */
const stepX86 = (t, mnemonic, operands) => {
  if (X86_BRANCH.test(mnemonic)) {
    return "branch"
  }
  if (mnemonic.startsWith("call")) {
    return "call"
  }
  if (
    mnemonic.startsWith("ret") ||
    mnemonic === "jmp" ||
    mnemonic.startsWith("nop") ||
    mnemonic === "endbr64"
  ) {
    return null
  }
  // `lea` computes an address and touches no memory, so its operand is read as
  // the registers in it.
  const lea = mnemonic.startsWith("lea")
  const ops = operands.map(x86Operand).map((op) => (lea ? { ...op, memory: false } : op))
  for (const op of ops) {
    if (op.memory && t.anySecret(op.address)) {
      return "load"
    }
  }
  if (/^(cltq|cwtl|cqto|cltd|cdqe|cqo)$/.test(mnemonic)) {
    t.set("d", t.anySecret(["a"]), false)
    return null
  }
  if (mnemonic.startsWith("push")) {
    t.stack.push({ secret: t.anySecret(ops[0].registers), loaded: t.anyLoaded(ops[0].registers) })
    return null
  }
  if (mnemonic.startsWith("pop")) {
    const top = t.stack.pop() ?? { secret: false, loaded: true }
    t.set(ops[0].registers[0], top.secret, top.loaded)
    return null
  }
  const readsFlags = X86_READS_FLAGS.test(mnemonic)
  const sources = ops.length > 1 ? ops.slice(0, -1) : ops
  const dest = ops.length > 0 ? ops[ops.length - 1] : null
  let secret = readsFlags && t.secret.has("flags")
  let loaded = false
  for (const op of sources) {
    if (op.memory) {
      const value = t.loadFrom(op)
      secret = secret || value.secret
      loaded = loaded || value.loaded
    } else {
      secret = secret || t.anySecret(op.registers)
      loaded = loaded || t.anyLoaded(op.registers)
    }
  }
  if (X86_COMPARE.test(mnemonic)) {
    t.set("flags", secret || (dest !== null && t.anySecret(dest.registers)), false)
    return null
  }
  if (X86_WIDE.test(mnemonic) && ops.length === 1) {
    const all = secret || t.anySecret(["a", "d"])
    t.set("a", all, false)
    t.set("d", all, false)
    t.set("flags", all, false)
    return null
  }
  if (dest === null) {
    return null
  }
  const zeroIdiom =
    ops.length === 2 && !dest.memory && ops[0].text === ops[1].text && X86_ZERO_IDIOM.test(mnemonic)
  const overwrite = zeroIdiom || X86_OVERWRITE.test(mnemonic) || ops.length >= 3
  if (!overwrite) {
    // A two-operand instruction reads its destination too: `andl %esi, %eax`.
    const before = dest.memory ? t.loadFrom(dest) : { secret: t.anySecret(dest.registers), loaded: false }
    secret = secret || before.secret
    loaded = loaded || t.anyLoaded(dest.registers)
  }
  if (zeroIdiom) {
    secret = false
    loaded = false
  }
  if (dest.memory) {
    if (isStackSlot(dest)) {
      t.slots.set(dest.text, { secret, loaded })
    }
  } else if (dest.registers.length > 0) {
    t.set(dest.registers[0], secret, loaded)
  }
  if (!X86_OVERWRITE.test(mnemonic)) {
    t.set("flags", secret, false)
  }
  return null
}

const ARM_BRANCH = /^(b\.\w+|cbn?z|tbn?z)$/
const ARM_CALL = /^(bl|blr)$/
const ARM_STORE = /^(st[rpu]\w*|st[1-4]|stlr\w*|stnp)$/
const ARM_LOAD = /^(ld[rpu]\w*|ld[1-4]\w*|ldar\w*|ldnp|ldx\w*)$/
const ARM_COMPARE = /^(cmp|cmn|tst|f?ccmp|f?ccmn|fcmpe?)$/
const ARM_READS_FLAGS = /^(cs\w+|cset\w*|cinc|cinv|cneg|adcs?|sbcs?|ngcs?|f?ccmp|f?ccmn|fcsel)$/
const ARM_READ_MODIFY_WRITE = /^(movk|bfi|bfxil|bfm|ins|mla|mls|f?mla|f?mls|sli|sri|bsl|bit|bif|tbx)$/

/** One aarch64 instruction, likewise. The destination is the first operand. */
const stepArm = (t, mnemonic, operands) => {
  if (ARM_BRANCH.test(mnemonic)) {
    return "branch"
  }
  if (ARM_CALL.test(mnemonic)) {
    return "call"
  }
  const ops = operands.map(armOperand)
  for (const op of ops) {
    if (op.memory && t.anySecret(op.address)) {
      return "load"
    }
  }
  if (mnemonic === "ret" || mnemonic === "b" || mnemonic === "nop" || mnemonic === "br") {
    return null
  }
  const memoryAt = ops.findIndex((op) => op.memory)
  if (ARM_STORE.test(mnemonic) && memoryAt > 0) {
    const stored = ops.slice(0, memoryAt).flatMap((op) => op.registers)
    if (isStackSlot(ops[memoryAt])) {
      t.slots.set(ops[memoryAt].text, { secret: t.anySecret(stored), loaded: t.anyLoaded(stored) })
    }
    return null
  }
  if (ARM_LOAD.test(mnemonic) && memoryAt > 0) {
    const value = t.loadFrom(ops[memoryAt])
    for (const op of ops.slice(0, memoryAt)) {
      for (const r of op.registers) {
        t.set(r, value.secret, value.loaded)
      }
    }
    return null
  }
  const readsFlags = ARM_READS_FLAGS.test(mnemonic)
  const flagSecret = readsFlags && t.secret.has("flags")
  if (ARM_COMPARE.test(mnemonic)) {
    const regs = ops.flatMap((op) => op.registers)
    t.set("flags", flagSecret || t.anySecret(regs), false)
    return null
  }
  if (ops.length === 0) {
    return null
  }
  const dest = ops[0]
  const sources = ops.slice(1).flatMap((op) => op.registers)
  const laneInsert = /\[\d+\]$/.test(dest.text)
  const readModifyWrite = laneInsert || ARM_READ_MODIFY_WRITE.test(mnemonic)
  const sourceRegs = readModifyWrite ? [...sources, ...dest.registers] : sources
  const zeroIdiom = mnemonic === "eor" && ops.length === 3 && ops[1].text === ops[2].text
  const secret = !zeroIdiom && (flagSecret || t.anySecret(sourceRegs))
  const loaded = !zeroIdiom && t.anyLoaded(sourceRegs)
  if (dest.registers.length > 0) {
    t.set(dest.registers[0], secret, loaded)
  }
  if (/s$/.test(mnemonic) && !/^(ins|movs)$/.test(mnemonic)) {
    t.set("flags", secret, false)
  }
  return null
}

const STEPS = new Map([
  ["x86-64", stepX86],
  ["aarch64", stepArm],
])

/**
 * Every violation in one function body: `{ kind, line }`, where `kind` is
 * `branch`, `call` or `load`. An empty list is a pass.
 */
export const ctViolations = (body, spec, target) => {
  const t = new Taint(spec, target)
  const step = STEPS.get(target.name)
  const found = []
  for (const line of body) {
    const space = line.search(/\s/)
    const mnemonic = space < 0 ? line : line.slice(0, space)
    const operands = space < 0 ? [] : splitOperands(line.slice(space + 1))
    const kind = step(t, mnemonic, operands)
    if (kind !== null) {
      found.push({ kind, line })
    }
  }
  return found
}
