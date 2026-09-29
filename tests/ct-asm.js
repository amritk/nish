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
 *     an indirect `jmp` goes who knows where. The one call it follows is to
 *     another function the same fixture checks (below);
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
 * **A call to a checked function.** A ladder step or a window step is a
 * sequence of field operations that LLVM does not inline, so it calls them.
 * Such a call is followed, not refused, when the callee is itself named by a
 * `// ct-check:` line of the same fixture (and so is held to this check on its
 * own), and when what the callee might do is something this model can account
 * for: it makes no call itself; it stores only through pointers it loaded (the
 * `data` of the arrays it was handed) or into its own frame; it is checked with
 * `secret=contents` whenever anything the caller passes may hold a secret; no
 * argument register the callee reads as public is secret here or was loaded
 * from memory; and no array header on the stack that it is handed holds a
 * secret. The callee is read to find how far past each `data` pointer it
 * stores, and after the call every stack byte that far past the start of any
 * array this function laid out on its stack is secret, as is every byte the
 * model has no record of and every register the call may overwrite.
 *
 * Where the model cannot be exact it errs towards refusing. The flags only ever
 * gain a secret, since telling apart the instructions that leave them alone is
 * a table this would get wrong. A write to an 8- or 16-bit register, a lane
 * insert or a bit-set keeps the taint already in the register. A store whose
 * width or place this cannot tell only ever adds taint to the bytes it may
 * have written, and a read it cannot place is secret if any stack byte might
 * be. The pass runs once, in order, which is exact for straight-line code; code
 * with a conditional branch has already failed. What it does not model is
 * other memory: a secret written through a pointer and read back through
 * another is lost, which the fixtures, small and register-allocated, do not
 * do. `tests/run.js` holds each of these corners to a hand-written leak the
 * check must refuse, and `ct_asm_x25519` holds the call rule to one.
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
 * otherwise leave a register untainted and the check reading as a pass. Every
 * spec also carries `callable`, the fixture's readable specs by name, which is
 * what a call from one checked function to another is judged against.
 */
export const ctSpecs = (source) => {
  const specs = []
  const callable = new Map()
  for (const line of source.split("\n").filter((l) => l.startsWith("// ct-check"))) {
    const m = line.match(/^\/\/ ct-check: (\w+) secret=([\w,]+)(?: expect=(branch|load))?\s*$/)
    if (m === null) {
      specs.push({
        name: line,
        problems: ["not `// ct-check: <fn> secret=<names> [expect=branch|load]`"],
        callable,
      })
      continue
    }
    const [, name, secret, expect] = m
    const signature = source.match(new RegExp(`export const ${name} = \\(([^)]*)\\)`))
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
    const spec = {
      name,
      problems,
      contents: secret.split(",").includes("contents"),
      secretArgs: secrets.map((n) => names.indexOf(n)),
      params: params.length,
      expect: expect ?? null,
      callable,
    }
    specs.push(spec)
    if (problems.length === 0) {
      callable.set(name, spec)
    }
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

const armOperand = (text) => {
  if (text.startsWith("[")) {
    const parts = text
      .slice(1, text.indexOf("]"))
      .split(",")
      .map((p) => p.trim())
    const address = [...parts.join(",").matchAll(ARM_REGISTER)].map((m) => armRegister(m[0]))
    const second = parts[1]
    const indexed = second !== undefined && new RegExp(ARM_REGISTER.source).test(second)
    let disp = 0
    if (second !== undefined && !indexed) {
      disp = immediate(second)
    }
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

/** Nish's array header, `{ i64 length, i64 capacity, i8* data }`: what an array argument points at. */
const ARRAY_HEADER_BYTES = 24

/** The effects of a callee this model must account for, per listing and name. */
const SUMMARIES = new WeakMap()

/**
 * Taint state: per register, whether it is secret, whether it came out of
 * memory (a loaded pointer, whose element reads are secret under `contents`),
 * whether it is exactly a word loaded from memory (`fresh`, which a callee's
 * store extent is measured from), and which stack offset it holds, if it
 * holds a stack address. `flags` is the condition register, as a register of
 * its own. `sp` is the stack pointer's offset from its value on entry, or
 * `null` once an instruction moves it by something this cannot follow.
 */
class Taint {
  constructor(spec, target) {
    this.target = target
    this.secret = new Set()
    this.loaded = new Set()
    this.fresh = new Set()
    this.stackAt = new Map()
    this.sp = 0
    this.bytes = new Map()
    this.unknownSecret = false
    this.escaped = new Set()
    this.escapedSomewhere = false
    this.contents = spec.contents
    this.callable = spec.callable ?? new Map()
    this.listing = null
    this.summary = null
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
      fresh: single !== null && this.fresh.has(single),
    }
  }

  set(register, secret, loaded) {
    this.setValue(register, { secret, loaded, stack: undefined, fresh: false })
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
    if (value.fresh) {
      this.fresh.add(register)
    } else {
      this.fresh.delete(register)
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

  moveSp(delta) {
    this.sp = this.sp === null ? null : this.sp + delta
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
      return { secret, loaded: true, stack: stack ? null : undefined, fresh: false }
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
      return { secret: first.secret, loaded: first.loaded, stack: first.stack, fresh: first.fresh }
    }
    return { secret, loaded, stack: stack ? null : undefined, fresh: false }
  }

  /**
   * Stores `value` into `width` bytes of the stack at `at`. An inexact store,
   * or one this cannot place, only adds taint to what it may have written.
   */
  writeStack(at, width, value, exact) {
    if (value.stack !== undefined) {
      if (typeof value.stack === "number") {
        this.escaped.add(value.stack)
      } else {
        this.escapedSomewhere = true
      }
    }
    if (at === null) {
      if (value.secret) {
        this.unknownSecret = true
        for (const b of this.bytes.values()) {
          b.secret = true
        }
      }
      return null
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
    return null
  }

  /** A load: from the stack, what was stored there; through a loaded pointer, secret under `contents`. */
  loadFrom(op, width) {
    const place = this.addressOf(op)
    if (place.stack) {
      return this.readStack(place.at, width)
    }
    return {
      secret: this.contents && this.anyLoaded(op.address),
      loaded: true,
      stack: undefined,
      fresh: true,
    }
  }

  /** A store through `op`; a stack address written anywhere but the stack is refused. */
  storeTo(op, width, exact, value) {
    const place = this.addressOf(op)
    if (place.stack) {
      // A callee's own frame is below where the stack pointer was on entry;
      // at or above it is the return address and the caller's frame.
      if (this.summary !== null && (place.at === null || place.at >= 0)) {
        this.summary.otherStores = true
      }
      return this.writeStack(place.at, width, value, exact)
    }
    if (value.stack !== undefined) {
      return "escape"
    }
    if (this.summary !== null) {
      // How far past a `data` pointer the callee writes, when it writes
      // through one it loaded and has not moved; anything else is unbounded.
      if (
        op.base !== null &&
        this.fresh.has(op.base) &&
        this.loaded.has(op.base) &&
        op.index === null &&
        op.disp !== null
      ) {
        this.summary.extent = Math.max(this.summary.extent, op.disp + width)
      } else if (this.anyLoaded(op.address)) {
        this.summary.extent = Number.POSITIVE_INFINITY
      } else {
        this.summary.otherStores = true
      }
    }
    return null
  }

  /** Every byte from `from` for `length` bytes becomes secret; with no bound, every byte from `from` on. */
  poison(from, length) {
    if (length === Number.POSITIVE_INFINITY) {
      for (const [at, b] of this.bytes) {
        if (at >= from) {
          b.secret = true
          b.loaded = true
          b.from = null
        }
      }
      return
    }
    for (let i = 0; i < length; i++) {
      this.bytes.set(from + i, { secret: true, loaded: true, stack: undefined, from: null, width: 1 })
    }
  }

  /**
   * A call or tail call to `operand`. Answers `"call"` unless the callee is a
   * function this fixture checks and its effects are ones this model can
   * account for (the header of this file lists them), and then applies them.
   */
  call(operands) {
    if (this.summary !== null) {
      this.summary.calls = true
    }
    const symbol = operands.length === 1 ? operands[0].replace(/@PLT$/, "") : ""
    const callee = this.callable.get(symbol)
    if (callee === undefined || callee.expect !== null || this.listing === null) {
      return "call"
    }
    const effects = calleeEffects(this.listing, callee, this.target)
    if (effects === null || effects.calls || effects.otherStores) {
      return "call"
    }
    const anySecretOnStack = this.unknownSecret || [...this.bytes.values()].some((b) => b.secret)
    if (!callee.contents && (this.contents || anySecretOnStack)) {
      return "call"
    }
    for (let i = 0; i < callee.params; i++) {
      const r = this.target.args[i]
      if ((this.secret.has(r) && !callee.secretArgs.includes(i)) || this.loaded.has(r)) {
        return "call"
      }
      const at = this.stackOf(r)
      if (at === null || (at !== undefined && this.readStack(at, ARRAY_HEADER_BYTES).secret)) {
        return "call"
      }
    }
    if (this.escapedSomewhere) {
      this.poison(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)
    }
    for (const from of this.escaped) {
      this.poison(from, effects.extent)
    }
    // What the callee left below the stack pointer, and anything this has no
    // record of, may be a secret now.
    for (const [at, b] of this.bytes) {
      if (this.sp === null || at < this.sp) {
        b.secret = true
      }
    }
    this.unknownSecret = true
    for (const r of this.target.callerSaved) {
      this.setValue(r, { secret: true, loaded: false, stack: undefined, fresh: false })
    }
    this.secret.add("flags")
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
/** Three operands, and the last is read as well as written. */
const X86_THREE_READS_DEST = /^(shld|shrd)[wlq]?$/
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
    return t.call(operands)
  }
  // A jump to a local label is control flow inside the function; one anywhere
  // else is a tail call or an indirect jump, code this check does not read
  // unless it is a function the fixture checks.
  if (X86_JUMP.test(mnemonic)) {
    return operands.length === 1 && operands[0].startsWith(".L") ? null : t.call(operands)
  }
  if (mnemonic.startsWith("ret") || mnemonic.startsWith("nop") || mnemonic === "endbr64") {
    return null
  }
  // A string instruction repeats over memory by a count in a register, which
  // this does not follow.
  if (/^rep|^(stos|movs|cmps|scas|lods)[bwlq]?$/.test(mnemonic)) {
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
  if (/^(cltq|cwtl|cqto|cltd|cdqe|cqo)$/.test(mnemonic)) {
    t.set("d", t.anySecret(["a"]), false)
    return null
  }
  if (mnemonic.startsWith("push")) {
    const value = ops[0].memory ? t.loadFrom(ops[0], 8) : t.valueOf(ops[0])
    t.moveSp(-8)
    return t.writeStack(t.sp, 8, { ...value, fresh: false }, true)
  }
  if (mnemonic.startsWith("pop")) {
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
    stack = stack || value.stack !== undefined || (lea && op.address.some((r) => t.isStack(r)))
    copied = value
  }
  if (X86_COMPARE.test(mnemonic)) {
    // A compare reads both operands; `sources` stopped short of the last.
    const last = dest.memory ? t.loadFrom(dest, width) : t.valueOf(dest)
    t.taintFlags(secret || last.secret)
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
    (zeroIdiom || X86_OVERWRITE.test(mnemonic) || (ops.length >= 3 && !X86_THREE_READS_DEST.test(mnemonic)))
  const old = dest.memory ? t.loadFrom(dest, width) : t.valueOf(dest)
  if (!overwrite) {
    // A two-operand instruction reads its destination too: `andl %esi, %eax`.
    secret = secret || old.secret
    loaded = loaded || old.loaded
    stack = stack || old.stack !== undefined
  }
  // Where the result points, if at the stack: a copy keeps the source's
  // offset, `lea` and an immediate `add` or `sub` move it, and anything else
  // computed from a stack address is one this cannot place.
  let result = { secret, loaded, stack: stack ? null : undefined, fresh: false }
  if (zeroIdiom) {
    result = { secret: false, loaded: false, stack: undefined, fresh: false }
  } else if (lea) {
    const place = t.addressOf(ops[0])
    result.stack = place.stack ? place.at : undefined
  } else if (X86_COPY.test(mnemonic) && ops.length === 2 && !partial && copied !== null) {
    result = { ...copied, fresh: copied.fresh && ops[0].memory }
  } else if (/^(add|sub)q$/.test(mnemonic) && sources[0].imm !== null && typeof old.stack === "number") {
    result.stack = old.stack + (mnemonic.startsWith("add") ? sources[0].imm : -sources[0].imm)
  }
  if (partial && old.stack !== undefined) {
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
    return t.call(operands)
  }
  if (ARM_CALL.test(mnemonic)) {
    return "call"
  }
  // `b` to a local label stays inside the function; to a symbol it is a tail
  // call, and `br` jumps through a register to code this check does not read.
  if (mnemonic === "b") {
    return operands.length === 1 && operands[0].startsWith(".L") ? null : t.call(operands)
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
  if ((ARM_STORE.test(mnemonic) || ARM_LOAD.test(mnemonic)) && memoryAt > 0) {
    const mem = ops[memoryAt]
    const post = memoryAt < ops.length - 1 ? ops[memoryAt + 1].imm : null
    // Pre-index (`[sp, #-16]!`) moves the base before the access, post-index
    // (`[sp], #16`) after it; either way the base register changes, by an
    // amount this cannot place when it is not an immediate.
    const moveBase = (delta) => {
      if (mem.base === "sp") {
        t.sp = t.sp === null || delta === null ? null : t.sp + delta
        return
      }
      const base = t.stackOf(mem.base)
      t.fresh.delete(mem.base)
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
      if (ARM_STORE.test(mnemonic)) {
        violation = violation ?? t.storeTo(piece, width, exact, { ...t.valueOf(op), fresh: false })
      } else {
        const value = t.loadFrom(piece, width)
        for (const r of op.registers) {
          t.setValue(r, value)
        }
      }
      offset += width
    }
    if (memoryAt < ops.length - 1) {
      moveBase(post)
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
    const fresh = mnemonic === "mov" && ops[1]?.registers.length === 1 && t.fresh.has(ops[1].registers[0])
    t.setValue(dest.registers[0], { secret, loaded, stack, fresh })
  }
  if (ARM_SETS_FLAGS.test(mnemonic)) {
    t.taintFlags(secret)
  }
  return null
}

/** The two targets, with the registers the first integer arguments arrive in and the ones a call may overwrite. */
export const CT_TARGETS = [
  {
    name: "x86-64",
    triple: "x86_64-unknown-linux-gnu",
    args: ["di", "si", "d", "c", "r8", "r9"],
    callerSaved: [
      "a",
      "c",
      "d",
      "si",
      "di",
      "r8",
      "r9",
      "r10",
      "r11",
      ...[...Array(16).keys()].map((i) => `v${i}`),
    ],
    comment: /#.*$/,
    step: stepX86,
  },
  {
    name: "aarch64",
    triple: "aarch64-unknown-linux-gnu",
    args: ["r0", "r1", "r2", "r3", "r4", "r5", "r6", "r7"],
    // v8 to v15 keep only their low halves across a call, so every vector register is overwritten.
    callerSaved: [...[...Array(19).keys()].map((i) => `r${i}`), ...[...Array(32).keys()].map((i) => `v${i}`)],
    // `#` starts an immediate here, not a comment.
    comment: /\/\/.*$/,
    step: stepArm,
  },
]

/** Runs `body` under `spec`, answering every violation and leaving `t` as the body leaves it. */
const walk = (t, body) => {
  const found = []
  for (const line of body) {
    const space = line.search(/\s/)
    const mnemonic = space < 0 ? line : line.slice(0, space)
    const operands = space < 0 ? [] : splitOperands(line.slice(space + 1))
    const kind = t.target.step(t, mnemonic, operands)
    if (kind !== null) {
      found.push({ kind, line })
    }
  }
  return found
}

/**
 * What a checked callee may do that its caller has to account for: whether it
 * calls anything, whether it stores anywhere but through a pointer it loaded
 * and its own frame, and how many bytes past such a pointer it stores. `null`
 * when the listing does not hold it.
 */
const calleeEffects = (listing, spec, target) => {
  let byName = SUMMARIES.get(listing)
  if (byName === undefined) {
    byName = new Map()
    SUMMARIES.set(listing, byName)
  }
  const key = `${target.name}:${spec.name}`
  if (!byName.has(key)) {
    const body = functionBody(listing, spec.name, target)
    let effects = null
    if (body !== null) {
      const t = new Taint(spec, target)
      t.summary = { calls: false, otherStores: false, extent: 0 }
      walk(t, body)
      effects = t.summary
    }
    byName.set(key, effects)
  }
  return byName.get(key)
}

/**
 * Every violation in one function body: `{ kind, line }`, where `kind` is
 * `branch`, `call`, `load`, `escape` (a stack address stored off the stack) or
 * `unmodelled` (an instruction this does not follow). An empty list is a pass.
 */
export const ctViolations = (body, spec, target) => {
  const t = new Taint(spec, target)
  t.listing = LISTINGS.get(body) ?? null
  return walk(t, body)
}
