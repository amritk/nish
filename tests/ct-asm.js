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
 *   - **any call to code this check does not read** — and so any jump out of
 *     the function too: a `jmp` or `b` to a symbol is a tail call, and `br` or
 *     an indirect `jmp` goes who knows where. A call to a function whose body
 *     is in the same listing is not refused but followed (below);
 *   - **any load or store whose address depends on a secret**.
 *
 * The last is a taint analysis over registers, and it is only as good as what
 * it models, so here is what that is. A register is *secret* when it holds a
 * secret argument the fixture names, a byte loaded out of an array whose
 * contents the fixture calls secret, or any value computed from one — the
 * condition flags included, so `sete` or `csetm` after a secret compare is
 * secret. "Loaded out of an array" means loaded through a pointer that itself
 * came out of memory: an array is a header whose `data` field is loaded first,
 * so the header read is public and the element read behind it is not.
 *
 * **The stack is followed by offset.** The model knows where the stack pointer
 * is relative to where it was on entry, through every `push`, `pop`, `sub` and
 * pre- or post-indexed store, and it knows which registers hold a stack
 * address and at which offset (`lea 16(%rsp)`, `add x8, sp, #16`, a frame
 * pointer, a copy of any of them). Each byte stored to the stack keeps the
 * taint of what was stored, so a value spilled and reloaded, or an array the
 * function builds on its own stack and reads back, comes back exactly as it
 * went in, whichever register the address was spelled through. A pointer to
 * the stack that is itself reloaded from the stack stays a pointer to the
 * stack, but one written anywhere else is refused (`escape`), because the model
 * could no longer tell which writes land in the frame.
 *
 * **A call is followed into the callee.** A ladder step or a window step is
 * a sequence of field operations that LLVM does not inline, so it calls them.
 * When the callee's body is in the same listing, the call is not refused: the
 * callee is read on the caller's own state, from a return address pushed where
 * the call pushes it, so its arguments carry exactly the taint they have, what
 * it stores into the caller's frame lands in the bytes it lands in, and a
 * violation inside it is reported at the call. A callee elsewhere, the
 * runtime's for one, is code this check does not read, and a chain of calls
 * deeper than `CALL_DEPTH` is refused rather than followed.
 *
 * Where the model cannot be exact it errs towards refusing. The flags only ever
 * gain a secret, since telling apart the instructions that leave them alone is
 * a table this would get wrong. A write to an 8- or 16-bit register, a lane
 * insert or a bit-set keeps the taint already in the register. A store whose
 * width or place this cannot tell only ever adds taint to the bytes it may
 * have written, and a read it cannot place is secret if any stack byte might
 * be. The pass runs once, in order, which is exact for straight-line code; code
 * with a conditional branch has already failed. Memory other than the stack
 * is not followed byte by byte: a secret stored there makes every element read
 * from then on secret, since it could come back through another pointer. `tests/run.js` holds each of these corners to a hand-written leak the
 * check must refuse; the stack and call rules' own corners are at the foot of
 * this file and are checked when it loads; and `ct_asm_x25519` holds the call
 * rule to one leak in real compiler output.
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

/** Parameter types a fixture may give a function: each arrives in one general register. */
const REGISTER_PARAM = /^(?:[iu](?:8|16|32|64)|boolean|[\w<>, ]+\[\])$/

/**
 * Every `// ct-check:` line of a fixture, with each secret parameter turned into
 * its position from the function's own signature. A spec that cannot be read
 * exactly carries `problems`, which the suite fails on: a misspelt secret would
 * otherwise leave a register untainted and the check reading as a pass. Each
 * spec also carries the parameter and return types, which is what
 * `tests/ct-timing.js` calls the function with.
 */
export const ctSpecs = (source) => {
  const specs = []
  for (const line of source.split("\n").filter((l) => l.startsWith("// ct-check"))) {
    const m = line.match(/^\/\/ ct-check: (\w+) secret=([\w,]+)(?: expect=(branch|load))?\s*$/)
    if (m === null) {
      specs.push({
        name: line,
        problems: ["not `// ct-check: <fn> secret=<names> [expect=branch|load]`"],
      })
      continue
    }
    const [, name, secret, expect] = m
    const signature = source.match(new RegExp(`export const ${name} = \\(([^)]*)\\)(?::\\s*([^=]+?))?\\s*=>`))
    const params = signature === null || signature[1].trim().length === 0 ? [] : signature[1].split(",")
    const names = params.map((p) => p.split(":")[0].trim())
    const types = params.map((p) => (p.split(":")[1] ?? "").trim())
    const problems = signature === null ? [`no \`export const ${name}\` in the fixture`] : []
    // Parameters are matched to argument registers by position, which holds
    // only while every one takes a general register and there are no more of
    // them than the smaller target has (six on x86-64).
    types.forEach((type, i) => {
      if (!REGISTER_PARAM.test(type)) {
        problems.push(`parameter ${names[i]}: ${type} does not arrive in a general register`)
      }
    })
    if (params.length > 6) {
      problems.push(`${params.length} parameters: past six, x86-64 passes them on the stack`)
    }
    const secrets = secret.split(",").filter((n) => n !== "contents")
    for (const unknown of secrets.filter((n) => !names.includes(n))) {
      problems.push(`secret=${unknown} names no parameter`)
    }
    specs.push({
      name,
      problems,
      contents: secret.split(",").includes("contents"),
      secretArgs: secrets.map((n) => names.indexOf(n)),
      types,
      returns: signature === null || signature[2] === undefined ? "void" : signature[2].trim(),
      expect: expect ?? null,
    })
  }
  return specs
}

/** The whole listing each body was read from, so that a call can find its callee's body. */
const LISTINGS = new WeakMap()

/**
 * The instruction lines of `symbol` in the lines of an ELF `.s` for `target`, from its label to the
 * `.Lfunc_end` LLVM writes after it: no directives, labels or comments. `null`
 * when the symbol is not there, which the caller treats as a failure — a check
 * that read nothing has proved nothing.
 */
export const functionBody = (lines, symbol, target) => {
  const start = lines.findIndex((line) => line.startsWith(`${symbol}:`))
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
  LISTINGS.set(body, lines)
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

/** A decimal or hexadecimal immediate, or `null` for anything symbolic. */
const immediate = (text) => {
  const m = text.match(/^[$#]?(-?(?:0x[\da-f]+|\d+))$/i)
  return m === null ? null : Number(m[1])
}

/**
 * The registers an operand reads, and whether it is a memory operand; for one
 * that is, its base, index and constant displacement (`null` when symbolic).
 */
const x86Operand = (text) => {
  const open = text.indexOf("(")
  if (open >= 0) {
    const parts = text
      .slice(open + 1, text.lastIndexOf(")"))
      .split(",")
      .map((p) => p.trim())
    const reg = (part) => (part !== undefined && part.startsWith("%") ? x86Register(part) : null)
    const base = reg(parts[0])
    const index = reg(parts[1])
    const disp = text.slice(0, open).replace(/^\*/, "").trim()
    const address = [base, index].filter((r) => r !== null)
    return {
      memory: true,
      address,
      registers: address,
      text,
      base,
      index,
      disp: disp.length === 0 ? 0 : immediate(disp),
      imm: null,
    }
  }
  const registers = [...text.matchAll(/%\w+/g)].map((m) => x86Register(m[0]))
  return { memory: false, address: [], registers, text, imm: text.startsWith("$") ? immediate(text) : null }
}

const ARM_REGISTER = /\b(?:[xw]\d+|[vqdshb]\d+(?:\.\w+)?|sp|wsp|xzr|wzr)\b/g
/** `ARM_REGISTER` without the `g`, whose `test` would otherwise keep a position between calls. */
const ARM_ONE_REGISTER = new RegExp(ARM_REGISTER.source)

const armOperand = (text) => {
  if (text.startsWith("[")) {
    const parts = text
      .slice(1, text.indexOf("]"))
      .split(",")
      .map((p) => p.trim())
    const address = [...parts.join(",").matchAll(ARM_REGISTER)].map((m) => armRegister(m[0]))
    const second = parts[1]
    const indexed = second !== undefined && ARM_ONE_REGISTER.test(second)
    const disp = second === undefined || indexed ? 0 : immediate(second)
    return {
      memory: true,
      address,
      registers: address,
      text: `[${parts.join(", ")}]`,
      base: armRegister(parts[0]),
      index: indexed ? armRegister(second) : null,
      disp,
      writeback: text.endsWith("!"),
      imm: null,
    }
  }
  const registers = [...text.matchAll(ARM_REGISTER)].map((m) => armRegister(m[0]))
  return { memory: false, address: [], registers, text, imm: immediate(text) }
}

/**
 * How many bytes an x86-64 memory access moves, as `[width, exact]`: from the
 * register on the other side, or from the mnemonic's suffix beside an
 * immediate. `exact` is false when only an upper bound is known, and then a
 * store only adds taint.
 */
const x86Width = (mnemonic, others) => {
  // A sign- or zero-extending move reads what its first suffix names, not
  // its destination's width: `movslq` loads four bytes into a 64-bit register.
  const extend = mnemonic.match(/^mov[sz]([bwl])[wlq]$/)
  if (extend !== null) {
    return [{ b: 1, w: 2, l: 4 }[extend[1]], true]
  }
  const register = others.find((op) => !op.memory && op.registers.length > 0)
  if (register !== undefined) {
    const name = register.text.replace(/^\*/, "")
    if (/^%[xyz]mm/.test(name)) {
      const full = { x: 16, y: 32, z: 64 }[name[1]]
      if (/^v?(movq|movsd|movlp[sd]|movhp[sd]|pextrq)$/.test(mnemonic)) {
        return [8, true]
      }
      if (/^v?(movd|movss|pextrd|extractps)$/.test(mnemonic)) {
        return [4, true]
      }
      if (/^v?(mov[au]p[sd]|movdq[au]|movnt\w+)$/.test(mnemonic)) {
        return [full, true]
      }
      return [full, false]
    }
    if (/^%(?:[abcd][lh]|[sd]il|[bs]pl|r\d+b)$/.test(name)) {
      return [1, true]
    }
    if (/^%(?:[abcd]x|[sd]i|[bs]p|r\d+w)$/.test(name)) {
      return [2, true]
    }
    if (/^%(?:e\w+|r\d+d)$/.test(name)) {
      return [4, true]
    }
    return [8, true]
  }
  const suffix = { b: 1, w: 2, l: 4, q: 8 }[mnemonic.slice(-1)]
  return suffix === undefined ? [64, false] : [suffix, true]
}

/**
 * How many bytes one aarch64 register operand of a load or store moves, as
 * `[width, exact]`. A register list (`{ v0.16b, v1.16b }`) is read as its
 * registers' whole width, and only ever adds taint.
 */
const armWidth = (mnemonic, op) => {
  if (/^(ld|st)\w*b$/.test(mnemonic)) {
    return [1, true]
  }
  if (/^(ld|st)\w*h$/.test(mnemonic)) {
    return [2, true]
  }
  if (/^ldu?rsw$/.test(mnemonic)) {
    return [4, true]
  }
  if (op.text.startsWith("{")) {
    return [16 * op.registers.length, false]
  }
  const width = { x: 8, w: 4, q: 16, d: 8, s: 4, h: 2, b: 1 }[op.text[0]]
  return width === undefined ? [16, false] : [width, true]
}

/** How deep a chain of followed calls may go before the model stops and refuses. */
const CALL_DEPTH = 8

/**
 * Taint state: per register, whether it is secret, whether it came out of
 * memory (a loaded pointer, whose element reads are secret under `contents`),
 * and which stack offset it holds, if it holds a stack address. `flags` is the condition register, as a register of
 * its own. `sp` is the stack pointer's offset from its value on entry, or
 * `null` once an instruction moves it by something this cannot follow.
 */
class Taint {
  constructor(spec, target) {
    this.target = target
    this.secret = new Set()
    this.loaded = new Set()
    this.stackAt = new Map()
    this.sp = 0
    this.bytes = new Map()
    this.unknownSecret = false
    this.contents = spec.contents
    this.listing = null
    this.depth = 0
    this.found = []
    // `ctSpecs` has already refused a secret that names no parameter or one
    // past the registers, so every index here is a register.
    for (const index of spec.secretArgs) {
      this.secret.add(target.args[index])
    }
  }

  anySecret(registers) {
    return registers.some((r) => this.secret.has(r))
  }

  anyLoaded(registers) {
    return registers.some((r) => this.loaded.has(r))
  }

  /** The stack offset `register` holds: a number, `null` for one this cannot place, `undefined` for none. */
  stackOf(register) {
    if (register === "sp") {
      return this.sp
    }
    return this.stackAt.get(register)
  }

  isStack(register) {
    return this.stackOf(register) !== undefined
  }

  /** What a register operand, or an immediate, holds. */
  valueOf(op) {
    const single = op.registers.length === 1 ? op.registers[0] : null
    return {
      secret: this.anySecret(op.registers),
      loaded: this.anyLoaded(op.registers),
      stack: single === null ? undefined : this.stackOf(single),
    }
  }

  set(register, secret, loaded) {
    this.setValue(register, { secret, loaded, stack: undefined })
  }

  setValue(register, value) {
    if (register === "zero") {
      return
    }
    if (register === "sp") {
      this.sp = typeof value.stack === "number" ? value.stack : null
      return
    }
    if (value.secret) {
      this.secret.add(register)
    } else {
      this.secret.delete(register)
    }
    if (value.loaded) {
      this.loaded.add(register)
    } else {
      this.loaded.delete(register)
    }
    if (value.stack === undefined) {
      this.stackAt.delete(register)
    } else {
      this.stackAt.set(register, value.stack)
    }
  }

  /**
   * The flags only ever gain a secret: an instruction that leaves them alone
   * must not clear one, and telling those apart per mnemonic is a table this
   * check would get wrong. A false alarm is a fixture to look at; a cleared
   * taint would be a pass nobody earned.
   */
  taintFlags(secret) {
    if (secret) {
      this.secret.add("flags")
    }
  }

  /** The stack pointer moves by `delta`, or by an amount this cannot follow when `delta` is `null`. */
  moveSp(delta) {
    this.sp = this.sp === null || delta === null ? null : this.sp + delta
  }

  /** Where a memory operand points: `{ stack, at }`, `at` the stack offset or `null` when it cannot be placed. */
  addressOf(op) {
    const base = op.base === null ? undefined : this.stackOf(op.base)
    if (base !== undefined) {
      const exact = typeof base === "number" && op.index === null && op.disp !== null
      return { stack: true, at: exact ? base + op.disp : null }
    }
    return { stack: op.index !== null && this.isStack(op.index), at: null }
  }

  /** What `width` bytes of the stack at `at` hold; exactly what was stored when one store wrote them all. */
  readStack(at, width) {
    if (at === null) {
      let secret = this.unknownSecret
      let stack = false
      for (const b of this.bytes.values()) {
        secret = secret || b.secret
        stack = stack || b.stack !== undefined
      }
      return { secret, loaded: true, stack: stack ? null : undefined }
    }
    const first = this.bytes.get(at)
    let whole = first !== undefined && first.from === at && first.width === width
    let secret = false
    let loaded = false
    let stack = false
    for (let i = 0; i < width; i++) {
      const b = this.bytes.get(at + i)
      if (b === undefined) {
        whole = false
        secret = secret || this.unknownSecret
        loaded = true
        continue
      }
      whole = whole && b.from === at
      secret = secret || b.secret
      loaded = loaded || b.loaded
      stack = stack || b.stack !== undefined
    }
    if (whole) {
      return { secret: first.secret, loaded: first.loaded, stack: first.stack }
    }
    return { secret, loaded, stack: stack ? null : undefined }
  }

  /**
   * Stores `value` into `width` bytes of the stack at `at`. An inexact store,
   * or one this cannot place, only adds taint to what it may have written.
   */
  writeStack(at, width, value, exact) {
    if (at === null) {
      if (value.secret) {
        this.unknownSecret = true
        for (const b of this.bytes.values()) {
          b.secret = true
        }
      }
      return
    }
    for (let i = 0; i < width; i++) {
      const old = this.bytes.get(at + i)
      if (exact || old === undefined) {
        this.bytes.set(at + i, {
          ...value,
          from: at,
          width,
          secret: value.secret || (!exact && this.unknownSecret),
        })
      } else {
        old.secret = old.secret || value.secret
        old.loaded = old.loaded || value.loaded
        old.from = null
      }
    }
  }

  /** A load: from the stack, what was stored there; through a loaded pointer, secret under `contents`. */
  loadFrom(op, width) {
    const place = this.addressOf(op)
    if (place.stack) {
      return this.readStack(place.at, width)
    }
    return { secret: this.contents && this.anyLoaded(op.address), loaded: true, stack: undefined }
  }

  /**
   * A store through `op`. A stack address written anywhere but the stack is
   * refused, since the frame could then be written through memory this does
   * not follow; a secret written anywhere but the stack makes every element
   * read from then on secret, since it could be read back through another
   * pointer.
   */
  storeTo(op, width, exact, value) {
    const place = this.addressOf(op)
    if (place.stack) {
      this.writeStack(place.at, width, value, exact)
      return null
    }
    if (value.stack !== undefined) {
      return "escape"
    }
    if (value.secret) {
      this.contents = true
    }
    return null
  }

  /**
   * A call (`tail` false) or tail call to `operands`. A function whose body is
   * in the same listing is followed: its body is walked on this same state, so
   * its arguments carry exactly the taint they have here, what it stores to
   * this frame lands in the bytes it lands in, and a violation inside it is
   * reported at the call. Anything else is code this check does not read.
   */
  call(operands, tail) {
    const symbol = operands.length === 1 ? operands[0].replace(/@PLT$/, "") : ""
    const body =
      this.listing === null || symbol.length === 0 ? null : functionBody(this.listing, symbol, this.target)
    if (body === null || this.depth >= CALL_DEPTH) {
      return "call"
    }
    const returnAddress = tail ? 0 : this.target.returnAddress
    this.moveSp(-returnAddress)
    this.depth++
    const outer = this.found
    this.found = []
    walk(this, body)
    for (const v of this.found) {
      outer.push({ kind: v.kind, line: `${symbol}: ${v.line}` })
    }
    this.found = outer
    this.depth--
    this.moveSp(returnAddress)
    return null
  }
}

/** `jmp` in every width AT&T spells it; unconditional, so read as a jump and never as a branch. */
const X86_JUMP = /^jmp[wlq]?$/
/** The conditional jumps: every `j<cc>` (anything `X86_JUMP` is not), the `loop` family and `jcxz`. */
const X86_BRANCH = /^(j[a-z]+|loop\w*)$/
const X86_OVERWRITE =
  /^(v?mov|lea|set|cvt|v?pmovmsk|v?movmsk|v?pbroadcast|v?pshuf|bsf|bsr|tzcnt|lzcnt|popcnt)/
/** A plain move: the destination is exactly the source, stack address and all. */
const X86_COPY = /^(mov[bwlq]?|movabsq)$/
const X86_COMPARE = /^(cmp[bwlq]?|test[bwlq]?|bt[wlq]?|v?u?comis[sd]|v?ptest)$/
/** Writes that keep the rest of the register: a lane insert, a scalar move between xmm registers. */
const X86_MERGE = /^(pinsr[bwdq]|insertps|movs[sd]|movlp[sd]|movhp[sd])$/
/**
 * Three operands, and the last is only written. Any other three-operand
 * instruction is read as reading its destination too (`shld`, a fused
 * multiply-add), because a wrong guess that way costs a false alarm and the
 * other way a missed leak.
 */
const X86_THREE_OVERWRITE =
  /^(imul|andn|rorx|sarx|shlx|shrx|pdep|pext|bextr|bzhi|pshuf|shufp|palignr|extractps|v(?!fn?m))/
/** An 8- or 16-bit register name: a write to one leaves the upper bits as they were. */
const X86_PARTIAL = /^%(?:[abcd][lhx]|[sd]il?|[bs]pl?|r\d+[bw])$/
const X86_READS_FLAGS = /^(set|cmov|sbb|adc|adox|rcl|rcr)/
const X86_ZERO_IDIOM = /^(v?p?xor|sub|v?xorp[sd]|v?psub[bwdq])/
const X86_WIDE = /^(i?mul|i?div)[bwlq]?$/

/** One x86-64 (AT&T) instruction: the violation it is, if any, and its effect on `t`. */
const stepX86 = (t, mnemonic, operands) => {
  if (!X86_JUMP.test(mnemonic) && X86_BRANCH.test(mnemonic)) {
    return "branch"
  }
  if (mnemonic.startsWith("call")) {
    return t.call(operands, false)
  }
  // A jump to a local label is control flow inside the function; one anywhere
  // else is a tail call, followed like a call, or an indirect jump, code this
  // check does not read.
  if (X86_JUMP.test(mnemonic)) {
    return operands.length === 1 && operands[0].startsWith(".L") ? null : t.call(operands, true)
  }
  if (mnemonic.startsWith("ret") || mnemonic.startsWith("nop") || mnemonic === "endbr64") {
    return null
  }
  // A string instruction repeats over memory by a count in a register, which
  // this does not follow.
  if (/^rep|^(stos|movs|cmps|scas|lods)[bwlq]?$|^(push|pop)f[wlq]?$/.test(mnemonic)) {
    return "unmodelled"
  }
  // `lea` computes an address and touches no memory, so its operand is read as
  // the registers in it.
  const lea = mnemonic.startsWith("lea")
  const ops = operands.map(x86Operand)
  for (const op of ops) {
    if (op.memory && !lea && t.anySecret(op.address)) {
      return "load"
    }
  }
  // Sign extensions with no operands: within %rax, or %rax's sign into %rdx.
  if (/^(cltq|cwtl|cdqe|cbtw)$/.test(mnemonic)) {
    t.set("a", t.anySecret(["a"]), false)
    return null
  }
  if (/^(cqto|cltd|cwtd|cqo)$/.test(mnemonic)) {
    t.set("d", t.anySecret(["a"]), false)
    return null
  }
  if (/^push[wlq]?$/.test(mnemonic)) {
    const value = ops[0].memory ? t.loadFrom(ops[0], 8) : t.valueOf(ops[0])
    t.moveSp(-8)
    t.writeStack(t.sp, 8, value, true)
    return null
  }
  if (/^pop[wlq]?$/.test(mnemonic)) {
    const top = t.readStack(t.sp, 8)
    t.moveSp(8)
    t.setValue(ops[0].registers[0], top)
    return null
  }
  if (/^xchg[bwlq]?$/.test(mnemonic) && ops.every((op) => !op.memory)) {
    const [a, b] = ops.map((op) => t.valueOf(op))
    t.setValue(ops[0].registers[0], b)
    t.setValue(ops[1].registers[0], a)
    return null
  }
  const readsFlags = X86_READS_FLAGS.test(mnemonic)
  const sources = ops.length > 1 ? ops.slice(0, -1) : ops
  const dest = ops.length > 0 ? ops[ops.length - 1] : null
  const memory = ops.find((op) => op.memory && !lea)
  const [width, exact] = x86Width(
    mnemonic,
    ops.filter((op) => op !== memory)
  )
  let secret = readsFlags && t.secret.has("flags")
  let loaded = false
  let stack = false
  let copied = null
  for (const op of sources) {
    const value = op.memory && !lea ? t.loadFrom(op, width) : t.valueOf(op)
    secret = secret || value.secret
    loaded = loaded || value.loaded
    stack = stack || value.stack !== undefined
    copied = value
  }
  // What the last operand held: read by a compare, and by an instruction that
  // modifies rather than overwrites it.
  let old = null
  if (dest !== null && !lea) {
    old = dest.memory ? t.loadFrom(dest, width) : t.valueOf(dest)
  }
  if (X86_COMPARE.test(mnemonic)) {
    // A compare reads both operands; `sources` stopped short of the last.
    t.taintFlags(secret || old.secret)
    return null
  }
  if (X86_WIDE.test(mnemonic) && ops.length === 1) {
    const all = secret || t.anySecret(["a", "d"])
    t.set("a", all, false)
    t.set("d", all, false)
    t.taintFlags(all)
    return null
  }
  if (dest === null) {
    return null
  }
  const zeroIdiom =
    ops.length === 2 && !dest.memory && ops[0].text === ops[1].text && X86_ZERO_IDIOM.test(mnemonic)
  const partial = !dest.memory && X86_PARTIAL.test(dest.text)
  const merge = partial || X86_MERGE.test(mnemonic)
  const overwrite =
    !merge &&
    (zeroIdiom || X86_OVERWRITE.test(mnemonic) || (ops.length >= 3 && X86_THREE_OVERWRITE.test(mnemonic)))
  if (!overwrite) {
    // A two-operand instruction reads its destination too: `andl %esi, %eax`.
    secret = secret || old.secret
    loaded = loaded || old.loaded
    stack = stack || old.stack !== undefined
  }
  // Where the result points, if at the stack: a copy keeps the source's
  // offset, `lea` and an immediate `add` or `sub` move it, and anything else
  // computed from a stack address is one this cannot place.
  let result = { secret, loaded, stack: stack ? null : undefined }
  if (zeroIdiom) {
    result = { secret: false, loaded: false, stack: undefined }
  } else if (lea) {
    const place = t.addressOf(ops[0])
    result.stack = place.stack ? place.at : undefined
  } else if (X86_COPY.test(mnemonic) && ops.length === 2 && !partial && copied !== null) {
    result = copied
  } else if (/^(add|sub)q$/.test(mnemonic) && sources[0].imm !== null && typeof old.stack === "number") {
    result.stack = old.stack + (mnemonic.startsWith("add") ? sources[0].imm : -sources[0].imm)
  }
  if (partial && old !== null && old.stack !== undefined) {
    result.stack = null
  }
  // Whether this one writes the flags is not asked: they only gain taint, so
  // a `mov` that leaves them alone costs at most a false alarm.
  t.taintFlags(result.secret)
  if (dest.memory) {
    return t.storeTo(dest, width, exact && !merge, result)
  }
  if (dest.registers.length > 0) {
    t.setValue(dest.registers[0], result)
  }
  return null
}

const ARM_BRANCH = /^(b\.\w+|cbn?z|tbn?z)$/
const ARM_CALL = /^(bl|blr)$/
const ARM_STORE = /^(st[rpu]\w*|st[1-4]|stlr\w*|stnp)$/
const ARM_LOAD = /^(ld[rpu]\w*|ld[1-4]\w*|ldar\w*|ldnp|ldx\w*)$/
const ARM_COMPARE = /^(cmp|cmn|tst|f?ccmp|f?ccmn|fcmpe?)$/
const ARM_READS_FLAGS = /^(cs\w+|cset\w*|cinc|cinv|cneg|adcs?|sbcs?|ngcs?|f?ccmp|f?ccmn|fcsel)$/
const ARM_SETS_FLAGS = /^(adds|subs|ands|bics|negs|adcs|sbcs|ngcs)$/
const ARM_READ_MODIFY_WRITE = /^(movk|bfi|bfxil|bfm|ins|mla|mls|f?mla|f?mls|sli|sri|bsl|bit|bif|tbx)$/

/** An aarch64 immediate operand with the `lsl #12` that may follow it, or `null`. */
const armImmediate = (ops, i) => {
  const value = ops[i]?.imm ?? null
  if (value === null) {
    return null
  }
  const shift = ops[i + 1]?.text.match(/^lsl #(\d+)$/)
  return shift === undefined || shift === null ? value : value * 2 ** Number(shift[1])
}

/** One aarch64 instruction, likewise. The destination is the first operand. */
const stepArm = (t, mnemonic, operands) => {
  if (ARM_BRANCH.test(mnemonic)) {
    return "branch"
  }
  if (mnemonic === "bl") {
    return t.call(operands, false)
  }
  if (ARM_CALL.test(mnemonic)) {
    return "call"
  }
  // `b` to a local label stays inside the function; to a symbol it is a tail
  // call, and `br` jumps through a register to code this check does not read.
  if (mnemonic === "b") {
    return operands.length === 1 && operands[0].startsWith(".L") ? null : t.call(operands, true)
  }
  if (mnemonic === "br") {
    return "call"
  }
  const ops = operands.map(armOperand)
  for (const op of ops) {
    if (op.memory && t.anySecret(op.address)) {
      return "load"
    }
  }
  if (mnemonic === "ret" || mnemonic === "nop") {
    return null
  }
  const memoryAt = ops.findIndex((op) => op.memory)
  const store = ARM_STORE.test(mnemonic)
  if ((store || ARM_LOAD.test(mnemonic)) && memoryAt > 0) {
    const mem = ops[memoryAt]
    // Pre-index (`[sp, #-16]!`) moves the base before the access, post-index
    // (`[sp], #16`) after it; either way the base register changes, by an
    // amount this cannot place when it is not an immediate.
    const moveBase = (delta) => {
      if (mem.base === "sp") {
        t.moveSp(delta)
        return
      }
      const base = t.stackOf(mem.base)
      if (base !== undefined) {
        t.stackAt.set(mem.base, typeof base === "number" && delta !== null ? base + delta : null)
      }
    }
    let access = mem
    if (mem.writeback) {
      moveBase(mem.disp)
      access = { ...mem, disp: 0 }
    }
    let offset = 0
    let violation = null
    for (const op of ops.slice(0, memoryAt)) {
      const [width, exact] = armWidth(mnemonic, op)
      const piece = { ...access, disp: access.disp === null ? null : access.disp + offset }
      if (store) {
        violation = violation ?? t.storeTo(piece, width, exact, t.valueOf(op))
      } else {
        const value = t.loadFrom(piece, width)
        for (const r of op.registers) {
          t.setValue(r, value)
        }
      }
      offset += width
    }
    if (memoryAt < ops.length - 1) {
      moveBase(ops[memoryAt + 1].imm)
    }
    return violation
  }
  const readsFlags = ARM_READS_FLAGS.test(mnemonic)
  const flagSecret = readsFlags && t.secret.has("flags")
  if (ARM_COMPARE.test(mnemonic)) {
    const regs = ops.flatMap((op) => op.registers)
    t.taintFlags(flagSecret || t.anySecret(regs))
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
  // Where the result points, if at the stack, as on x86-64: `mov` copies, an
  // immediate `add` or `sub` moves, anything else loses the place.
  const fromStack = sourceRegs.some((r) => t.isStack(r))
  let stack = fromStack ? null : undefined
  const first = ops[1]?.registers.length === 1 ? t.stackOf(ops[1].registers[0]) : undefined
  if (mnemonic === "mov" && ops.length === 2 && ops[1].registers.length === 1) {
    stack = first
  } else if ((mnemonic === "add" || mnemonic === "sub") && typeof first === "number") {
    const imm = armImmediate(ops, 2)
    if (imm !== null) {
      stack = first + (mnemonic === "add" ? imm : -imm)
    }
  }
  if (zeroIdiom) {
    stack = undefined
  }
  if (dest.registers.length > 0) {
    t.setValue(dest.registers[0], { secret, loaded, stack })
  }
  if (ARM_SETS_FLAGS.test(mnemonic)) {
    t.taintFlags(secret)
  }
  return null
}

/**
 * The two targets, with the registers the first integer arguments arrive in
 * and how far a call moves the stack pointer to hold its return address.
 */
export const CT_TARGETS = [
  {
    name: "x86-64",
    triple: "x86_64-unknown-linux-gnu",
    args: ["di", "si", "d", "c", "r8", "r9"],
    returnAddress: 8,
    comment: /#.*$/,
    step: stepX86,
  },
  {
    name: "aarch64",
    triple: "aarch64-unknown-linux-gnu",
    args: ["r0", "r1", "r2", "r3", "r4", "r5", "r6", "r7"],
    // The return address goes to the link register, not the stack.
    returnAddress: 0,
    // `#` starts an immediate here, not a comment.
    comment: /\/\/.*$/,
    step: stepArm,
  },
]

/** Runs `body` on `t`, adding every violation to `t.found`. */
const walk = (t, body) => {
  for (const line of body) {
    const space = line.search(/\s/)
    const mnemonic = space < 0 ? line : line.slice(0, space)
    const operands = space < 0 ? [] : splitOperands(line.slice(space + 1))
    const kind = t.target.step(t, mnemonic, operands)
    if (kind !== null) {
      t.found.push({ kind, line })
    }
  }
}

/**
 * Every violation in one function body: `{ kind, line }`, where `kind` is
 * `branch`, `call`, `load`, `escape` (a stack address stored off the stack) or
 * `unmodelled` (an instruction this does not follow). An empty list is a pass.
 */
export const ctViolations = (body, spec, target) => {
  const t = new Taint(spec, target)
  t.listing = LISTINGS.get(body) ?? null
  walk(t, body)
  return t.found
}

/**
 * The corners of the stack and call rules, each a hand-written leak the model
 * must refuse, or a shape it must pass (`null`). `tests/run.js` holds the
 * model's older corners the same way; these sit beside the rules they pin and
 * run when this module loads, so `npm test`, which imports it, cannot run with
 * a model that misreads one.
 */
const STACK_CORNERS = [
  // A stack address written to the heap: the model can no longer see the frame.
  ["x86-64", "b", "escape", ["leaq 8(%rsp), %rax", "movq %rax, (%rdi)"]],
  ["x86-64", "a", "unmodelled", ["rep stosq %rax, %es:(%rdi)"]],
  // %rbp holding an array's `data` is not a stack slot.
  ["x86-64", "contents", "load", ["movq 16(%rdi), %rbp", "movq 8(%rbp), %rax", "movl (%rsi,%rax,4), %eax"]],
  // `shld` reads its destination.
  ["x86-64", "a", "load", ["movl %edi, %eax", "shldl $3, %esi, %eax", "movl (%rdx,%rax,4), %eax"]],
  // A slot written through %rsp and read back through a register that points at it.
  [
    "x86-64",
    "a",
    "load",
    ["movq %rdi, 16(%rsp)", "leaq 8(%rsp), %rax", "movq 8(%rax), %rcx", "movl (%rsi,%rcx,4), %eax"],
  ],
  // `popcnt` is not a `pop`, and `cltq` leaves %rdx alone.
  ["x86-64", "b", "load", ["movl $0, %eax", "popcntl %esi, %eax", "movl (%rdi,%rax,4), %eax"]],
  ["x86-64", "b", "load", ["movq %rsi, %rdx", "cltq", "movl (%rdi,%rdx,4), %eax"]],
  // A public four-byte spill beside a secret one, reloaded sign-extended: the
  // reload reads its own four bytes and no more, so the index stays public.
  [
    "x86-64",
    "a",
    null,
    ["movl %esi, -12(%rsp)", "movq %rdi, -8(%rsp)", "movslq -12(%rsp), %rax", "movq (%rdx,%rax,8), %rax"],
  ],
  // The other direction: a secret spilled eight bytes wide and reloaded four
  // bytes narrow, or one byte zero-extended, is still secret, because a read
  // takes the taint of every byte it covers.
  ["x86-64", "a", "load", ["movq %rdi, -16(%rsp)", "movslq -12(%rsp), %rax", "movq (%rdx,%rax,8), %rax"]],
  ["x86-64", "a", "load", ["movq %rdi, -16(%rsp)", "movzbl -13(%rsp), %eax", "movq (%rdx,%rax,8), %rax"]],
  // One eight-byte reload across a public four-byte spill and a secret one:
  // its taint is every byte's, not only the first.
  [
    "x86-64",
    "a",
    "load",
    ["movl %esi, -12(%rsp)", "movl %edi, -8(%rsp)", "movq -12(%rsp), %rax", "movq (%rdx,%rax,8), %rax"],
  ],
  // A pre-indexed store and a post-indexed load meet at the same slot.
  ["aarch64", "a", "load", ["str w0, [sp, #-16]!", "ldr w5, [sp], #16", "ldr w6, [x4, x5]"]],
  // #334: an `stp` writes two slots. A public pointer spilled as its second
  // register and reloaded from offset + 8 is public, beside a secret in the
  // first slot and over a secret the slot held before, so a load through it is
  // no violation (fiat's P-256 field multiply spills an array's `data` this
  // way on aarch64).
  [
    "aarch64",
    "a",
    null,
    ["sub sp, sp, #32", "str x0, [sp, #24]", "stp x0, x1, [sp, #16]", "ldr x2, [sp, #24]", "ldr w3, [x2]"],
  ],
  // The first slot of the same pair is the secret, and still refused.
  ["aarch64", "a", "load", ["sub sp, sp, #32", "stp x0, x1, [sp, #16]", "ldr x2, [sp, #16]", "ldr w3, [x2]"]],
]

/** A listing to follow calls through: the callees first, as LLVM lays them out. */
const CALL_LISTING = `get:
	movq	16(%rdi), %rax
	movq	(%rax,%rsi,8), %rax
	retq
.Lfunc_end0:
put:
	movq	16(%rdi), %rax
	movq	%rsi, (%rax)
	retq
.Lfunc_end1:
below:
	movq	16(%rdi), %rax
	movq	(%rax), %rcx
	movq	%rcx, -8(%rax)
	retq
.Lfunc_end2:
calm:
	callq	get@PLT
	retq
.Lfunc_end3:
leak:
	callq	get@PLT
	retq
.Lfunc_end4:
heap:
	pushq	%rbx
	pushq	%r12
	movq	%rdi, %rbx
	movq	%rdx, %r12
	callq	put@PLT
	movq	16(%rbx), %rax
	movq	(%rax), %rax
	movq	16(%r12), %rcx
	movq	(%rcx,%rax,8), %rax
	popq	%r12
	popq	%rbx
	retq
.Lfunc_end5:
under:
	pushq	%rbx
	movq	%rsi, %rbx
	subq	$48, %rsp
	movq	$0, 24(%rsp)
	movq	16(%rdi), %rcx
	movq	(%rcx), %rcx
	movq	%rcx, 32(%rsp)
	leaq	32(%rsp), %rax
	movq	%rax, 16(%rsp)
	movq	%rsp, %rdi
	callq	below@PLT
	movq	24(%rsp), %rax
	movq	16(%rbx), %rcx
	movq	(%rcx,%rax,8), %rax
	addq	$48, %rsp
	popq	%rbx
	retq
.Lfunc_end6:
above:
	movq	8(%rsp), %rax
	movq	(%rdi,%rax,8), %rax
	retq
.Lfunc_end7:
spill:
	subq	$8, %rsp
	movq	%rsi, (%rsp)
	callq	above@PLT
	addq	$8, %rsp
	retq
.Lfunc_end8:
`

const CALL_SOURCE = `// ct-check: get secret=contents
// ct-check: put secret=v,contents
// ct-check: below secret=contents
// ct-check: calm secret=contents
// ct-check: leak secret=i,contents
// ct-check: heap secret=bit
// ct-check: under secret=contents
// ct-check: above secret=contents
// ct-check: spill secret=s
export const get = (a: i64[], i: i32): i64 => a[i]
export const put = (a: i64[], v: i64): void => {}
export const below = (a: i64[]): void => {}
export const calm = (a: i64[], i: i32): i64 => get(a, i)
export const leak = (a: i64[], i: i32): i64 => get(a, i)
export const heap = (a: i64[], bit: i64, table: i64[]): i64 => 0
export const under = (a: i64[], table: i64[]): i64 => 0
export const above = (a: i64[]): i64 => 0
export const spill = (a: i64[], s: i64): i64 => 0
`

const CALL_CORNERS = [
  // A call with a public index into a checked callee is followed.
  ["calm", null],
  // A secret index handed to the callee is refused where the callee uses it.
  ["leak", "load"],
  // What the callee stored through an array's `data` is secret, even to a
  // caller that did not ask for `contents`.
  ["heap", "load"],
  // What it stored into this frame is secret where it landed, below `data` too.
  ["under", "load"],
  // The callee's stack starts below the return address the call pushed, so
  // its first stack slot above that is the caller's own.
  ["spill", "load"],
]

const cornerMisses = () => {
  const missed = []
  for (const [name, secret, kind, body] of STACK_CORNERS) {
    const target = CT_TARGETS.find((t) => t.name === name)
    const [spec] = ctSpecs(`// ct-check: f secret=${secret}\nexport const f = (a: u32, b: u32): u32 => a\n`)
    const found = ctViolations(body, spec, target)
    if (kind === null ? found.length > 0 : !found.some((v) => v.kind === kind)) {
      missed.push(`${name}, expected ${kind ?? "no violation"}: ${body.join("; ")}`)
    }
  }
  const lines = CALL_LISTING.split("\n")
  const specs = ctSpecs(CALL_SOURCE)
  for (const [fn, kind] of CALL_CORNERS) {
    const found = ctViolations(
      functionBody(lines, fn, CT_TARGETS[0]),
      specs.find((sp) => sp.name === fn),
      CT_TARGETS[0]
    )
    if (kind === null ? found.length > 0 : !found.some((v) => v.kind === kind)) {
      missed.push(
        `${fn}, expected ${kind ?? "no violation"}: ${found.map((v) => `${v.kind}: ${v.line}`).join("; ")}`
      )
    }
  }
  return missed
}

const missedCorners = cornerMisses()
if (missedCorners.length > 0) {
  throw new Error(`tests/ct-asm.js misreads the corners of its own model:\n${missedCorners.join("\n")}`)
}
