// The module `nish proto` writes from a parsed `.proto` file
// (docs/wp72-proto-classes.md §4): one enum per enum, one class per message
// with `encode` onto S1's `ProtoWriter` and `decode` from its `ProtoReader`,
// and each service method's path as a constant. The text depends only on the
// file, its name and the command, so the output is byte-deterministic.

import {
  addMethodConstant,
  ProtoField,
  ProtoFile,
  ProtoLabel,
  ProtoMessage,
  ProtoScalar,
} from "./proto-parse"
import { StringBuilder } from "./strings"

/** The Nish type a field's values have. */
const nishType = (type: ProtoScalar, target: string): string => {
  if (type === ProtoScalar.Int32 || type === ProtoScalar.Sint32 || type === ProtoScalar.Sfixed32) {
    return "i32"
  }
  if (type === ProtoScalar.Uint32 || type === ProtoScalar.Fixed32) {
    return "u32"
  }
  if (type === ProtoScalar.Int64 || type === ProtoScalar.Sint64 || type === ProtoScalar.Sfixed64) {
    return "i64"
  }
  if (type === ProtoScalar.Uint64 || type === ProtoScalar.Fixed64) {
    return "u64"
  }
  if (type === ProtoScalar.Float) {
    return "f32"
  }
  if (type === ProtoScalar.Double) {
    return "f64"
  }
  if (type === ProtoScalar.Bool) {
    return "boolean"
  }
  if (type === ProtoScalar.Str) {
    return "string"
  }
  if (type === ProtoScalar.Bytes) {
    return "u8[]"
  }
  if (type === ProtoScalar.Enum) {
    return "i32"
  }
  return target
}

/** A scalar's proto3 default, as a Nish expression of its type. */
const defaultOf = (type: ProtoScalar): string => {
  const t = nishType(type, "")
  if (t === "u32") {
    return "toU32(0)"
  }
  if (t === "i64") {
    return "toI64(0)"
  }
  if (t === "u64") {
    return "toU64(0)"
  }
  if (t === "f32") {
    return "toF32(0)"
  }
  if (t === "f64") {
    return "toF64(0)"
  }
  if (t === "boolean") {
    return "false"
  }
  if (t === "string") {
    return '""'
  }
  if (t === "u8[]") {
    return "[]"
  }
  return "0"
}

/** The wire type a scalar is written with, by its constant's name. */
const wireOf = (type: ProtoScalar): string => {
  if (type === ProtoScalar.Fixed64 || type === ProtoScalar.Sfixed64 || type === ProtoScalar.Double) {
    return "PROTO_WIRE_I64"
  }
  if (type === ProtoScalar.Fixed32 || type === ProtoScalar.Sfixed32 || type === ProtoScalar.Float) {
    return "PROTO_WIRE_I32"
  }
  if (type === ProtoScalar.Str || type === ProtoScalar.Bytes || type === ProtoScalar.Message) {
    return "PROTO_WIRE_LEN"
  }
  return "PROTO_WIRE_VARINT"
}

/** The `ProtoReader` and `ProtoWriter` method a numeric scalar's value goes through. */
const methodOf = (type: ProtoScalar): string => {
  if (type === ProtoScalar.Double) {
    return "double"
  }
  if (type === ProtoScalar.Float) {
    return "float"
  }
  if (type === ProtoScalar.Int64) {
    return "int64"
  }
  if (type === ProtoScalar.Uint64) {
    return "uint64"
  }
  if (type === ProtoScalar.Fixed64) {
    return "fixed64"
  }
  if (type === ProtoScalar.Fixed32) {
    return "fixed32"
  }
  if (type === ProtoScalar.Bool) {
    return "bool"
  }
  if (type === ProtoScalar.Uint32) {
    return "uint32"
  }
  if (type === ProtoScalar.Sfixed32) {
    return "sfixed32"
  }
  if (type === ProtoScalar.Sfixed64) {
    return "sfixed64"
  }
  if (type === ProtoScalar.Sint32) {
    return "sint32"
  }
  if (type === ProtoScalar.Sint64) {
    return "sint64"
  }
  return "int32"
}

/** Whether a scalar goes in a packed field: a number, a bool or an enum. */
const isPackable = (type: ProtoScalar): boolean =>
  type !== ProtoScalar.Str && type !== ProtoScalar.Bytes && type !== ProtoScalar.Message

/** The expression that reads one value of a scalar from `r`. */
const readOf = (type: ProtoScalar): string => {
  if (type === ProtoScalar.Str) {
    return "protoString(r)"
  }
  if (type === ProtoScalar.Bytes) {
    return "protoBytes(r)"
  }
  return `r.${methodOf(type)}()`
}

/** The condition under which an implicit-presence scalar `x` is written: it is not its default. */
const isSetOf = (type: ProtoScalar, x: string): string => {
  const t = nishType(type, "")
  if (t === "boolean") {
    return x
  }
  if (t === "string" || t === "u8[]") {
    return `${x}.length > 0`
  }
  if (t === "f32") {
    return `f32ToBits(${x}) !== 0`
  }
  if (t === "f64") {
    return `f64ToBits(${x}) !== toI64(0)`
  }
  return `${x} !== ${defaultOf(type)}`
}

/** The statement that writes field `n` of a scalar `x`. */
const writeOf = (type: ProtoScalar, n: i32, x: string): string => {
  if (type === ProtoScalar.Str) {
    return `w.string(${n}, ${x})`
  }
  if (type === ProtoScalar.Bytes) {
    return `w.bytes(${n}, ${x}, 0, toI32(${x}.length))`
  }
  return `w.${methodOf(type)}(${n}, ${x})`
}

/** The statement that writes one element `v` of a packed field. */
const packedOf = (type: ProtoScalar, v: string): string => {
  if (type === ProtoScalar.Fixed32) {
    return `w.packedFixed32(${v})`
  }
  if (type === ProtoScalar.Sfixed32) {
    return `w.packedFixed32(toU32(${v}))`
  }
  if (type === ProtoScalar.Float) {
    return `w.packedFixed32(toU32(f32ToBits(${v})))`
  }
  if (type === ProtoScalar.Fixed64) {
    return `w.packedFixed64(${v})`
  }
  if (type === ProtoScalar.Sfixed64) {
    return `w.packedFixed64(toU64(${v}))`
  }
  if (type === ProtoScalar.Double) {
    return `w.packedFixed64(toU64(f64ToBits(${v})))`
  }
  if (type === ProtoScalar.Uint64) {
    return `w.packedVarint(${v})`
  }
  if (type === ProtoScalar.Int64 || type === ProtoScalar.Uint32) {
    return `w.packedVarint(toU64(${v}))`
  }
  if (type === ProtoScalar.Sint32) {
    return `w.packedVarint(toU64(toU32((${v} << 1) ^ (${v} >> 31))))`
  }
  if (type === ProtoScalar.Sint64) {
    return `w.packedVarint(toU64((${v} << toI64(1)) ^ (${v} >> toI64(63))))`
  }
  if (type === ProtoScalar.Bool) {
    return `w.packedVarint(${v} ? toU64(1) : toU64(0))`
  }
  return `w.packedVarint(toU64(toI64(${v})))`
}

/** The module's text as it is built, and which imports and helpers it uses. */
class ProtoEmitter {
  out: StringBuilder
  file: ProtoFile
  usesVarint: boolean = false
  usesI64: boolean = false
  usesLen: boolean = false
  usesI32: boolean = false
  usesString: boolean = false
  usesBytes: boolean = false

  constructor(file: ProtoFile) {
    this.out = new StringBuilder()
    this.file = file
  }

  /** One line at `indent` levels of two spaces. */
  line(indent: i32, text: string): void {
    for (let i = 0; i < indent; i++) {
      this.out.add("  ")
    }
    this.out.add(text)
    this.out.add("\n")
  }

  /** A wire type's constant, marked as imported. */
  wire(name: string): string {
    if (name === "PROTO_WIRE_VARINT") {
      this.usesVarint = true
    }
    if (name === "PROTO_WIRE_I64") {
      this.usesI64 = true
    }
    if (name === "PROTO_WIRE_LEN") {
      this.usesLen = true
    }
    if (name === "PROTO_WIRE_I32") {
      this.usesI32 = true
    }
    return name
  }

  /** The read of a scalar, marking the helper it calls. */
  read(type: ProtoScalar): string {
    if (type === ProtoScalar.Str) {
      this.usesString = true
    }
    if (type === ProtoScalar.Bytes) {
      this.usesBytes = true
    }
    return readOf(type)
  }

  /** One enum, as an `i32` constant per value: proto3 enums are open, and a Nish enum converts to and from nothing. */
  emitEnum(index: i32): void {
    const e = this.file.enums[index]
    this.line(0, "")
    this.line(0, `// enum ${e.name}: open, so a field holds any i32 and these name its values.`)
    for (let i = 0; i < e.values.length && i < e.numbers.length; i++) {
      this.line(0, `export const ${e.name}_${e.values[i]}: i32 = ${e.numbers[i]}`)
    }
  }

  /** One message's class. */
  emitMessage(msg: ProtoMessage): void {
    this.line(0, "")
    this.line(0, `export class ${msg.name} {`)
    const seen: boolean[] = []
    for (let o = 0; o < msg.oneofs.length; o++) {
      seen.push(false)
    }
    for (let i = 0; i < msg.fields.length; i++) {
      const f = msg.fields[i]
      if (f.oneof >= 0 && f.oneof < seen.length && !seen[f.oneof]) {
        seen[f.oneof] = true
        this.line(1, `/** The number of the ${msg.oneofs[f.oneof]} member set, or 0. */`)
        this.line(1, `${msg.oneofs[f.oneof]}_case: i32 = 0`)
      }
      this.emitDeclaration(f)
    }
    const maps = msg.fields.filter((f: ProtoField): boolean => f.label === ProtoLabel.Map)
    if (maps.length > 0) {
      this.line(0, "")
      this.line(1, "constructor() {")
      for (let i = 0; i < maps.length; i++) {
        const f = maps[i]
        this.line(2, `this.${f.name} = new Map<${nishType(f.keyType, "")}, ${nishType(f.type, f.target)}>()`)
      }
      this.line(1, "}")
    }
    this.line(0, "")
    this.line(1, "/** Writes this message's fields onto `w`, in field-number order. */")
    this.line(1, "encode(w: ProtoWriter): void {")
    const order = byNumber(msg)
    for (let i = 0; i < order.length; i++) {
      const k = order[i]
      if (k >= 0 && k < msg.fields.length) {
        this.emitEncode(msg, msg.fields[k])
      }
    }
    this.line(1, "}")
    this.line(0, "")
    this.line(
      1,
      "/** Reads fields from the reader's current span until its end, merging them into this message; false on a fault. */"
    )
    this.line(1, "decode(r: ProtoReader): boolean {")
    this.line(2, "while (r.next()) {")
    for (let i = 0; i < msg.fields.length; i++) {
      this.emitDecode(msg, msg.fields[i], i === 0)
    }
    if (msg.fields.length > 0) {
      this.line(3, "}")
    }
    this.line(2, "}")
    this.line(2, "return r.failed === PROTO_OK")
    this.line(1, "}")
    this.line(0, "}")
  }

  /** A field's declaration, and its presence flag. */
  emitDeclaration(f: ProtoField): void {
    const t = nishType(f.type, f.target)
    if (f.label === ProtoLabel.Map) {
      this.line(1, `${f.name}: Map<${nishType(f.keyType, "")}, ${t}>`)
    } else if (f.label === ProtoLabel.Repeated) {
      this.line(1, `${f.name}: ${t}[] = []`)
    } else if (f.type === ProtoScalar.Message) {
      this.line(1, `${f.name}: ${t} | null = null`)
    } else {
      const d = defaultOf(f.type)
      this.line(1, `${f.name}: ${t} = ${d.startsWith("to") ? "0" : d}`)
    }
    // A message field's presence is `!== null`, as protoc has it, so only a
    // scalar gets a `has_` flag.
    if (f.label === ProtoLabel.Optional && f.type !== ProtoScalar.Message) {
      this.line(1, `has_${f.name}: boolean = false`)
    }
  }

  /** The statements of `encode` for one field. */
  emitEncode(msg: ProtoMessage, f: ProtoField): void {
    const x = `this.${f.name}`
    const n = f.number
    if (f.label === ProtoLabel.Map) {
      this.line(2, `for (const k of ${x}.keys()) {`)
      this.line(3, `const v = ${x}.get(k)`)
      this.line(3, "if (v !== undefined) {")
      this.line(4, `w.beginMessage(${n})`)
      this.line(4, writeOf(f.keyType, 1, "k"))
      if (f.type === ProtoScalar.Message) {
        this.line(4, "w.beginMessage(2)")
        this.line(4, "v.encode(w)")
        this.line(4, "w.endMessage()")
      } else {
        this.line(4, writeOf(f.type, 2, "v"))
      }
      this.line(4, "w.endMessage()")
      this.line(3, "}")
      this.line(2, "}")
      return
    }
    if (f.label === ProtoLabel.Repeated) {
      if (isPackable(f.type)) {
        this.line(2, `if (${x}.length > 0) {`)
        this.line(3, `w.beginMessage(${n})`)
        this.line(3, `for (const v of ${x}) {`)
        this.line(4, packedOf(f.type, "v"))
        this.line(3, "}")
        this.line(3, "w.endMessage()")
        this.line(2, "}")
      } else if (f.type === ProtoScalar.Message) {
        this.line(2, `for (const v of ${x}) {`)
        this.line(3, `w.beginMessage(${n})`)
        this.line(3, "v.encode(w)")
        this.line(3, "w.endMessage()")
        this.line(2, "}")
      } else {
        this.line(2, `for (const v of ${x}) {`)
        this.line(3, writeOf(f.type, n, "v"))
        this.line(2, "}")
      }
      return
    }
    if (f.type === ProtoScalar.Message) {
      this.line(2, `const m${n} = ${x}`)
      const guard =
        f.oneof >= 0 ? `m${n} !== null && this.${msg.oneofs[f.oneof]}_case === ${n}` : `m${n} !== null`
      this.line(2, `if (${guard}) {`)
      this.line(3, `w.beginMessage(${n})`)
      this.line(3, `m${n}.encode(w)`)
      this.line(3, "w.endMessage()")
      this.line(2, "}")
      return
    }
    let guard = isSetOf(f.type, x)
    if (f.oneof >= 0) {
      guard = `this.${msg.oneofs[f.oneof]}_case === ${n}`
    } else if (f.label === ProtoLabel.Optional) {
      guard = `this.has_${f.name}`
    }
    this.line(2, `if (${guard}) {`)
    this.line(3, writeOf(f.type, n, x))
    this.line(2, "}")
  }

  /** The branches of `decode`'s loop for one field: one per wire type it accepts. */
  emitDecode(msg: ProtoMessage, f: ProtoField, first: boolean): void {
    const x = `this.${f.name}`
    const n = f.number
    const open = first ? "if" : "} else if"
    if (f.label === ProtoLabel.Map) {
      this.line(3, `${open} (r.field === ${n} && r.wireType === ${this.wire("PROTO_WIRE_LEN")}) {`)
      this.line(4, "if (!r.enter()) {")
      this.line(5, "return false")
      this.line(4, "}")
      const keyType = nishType(f.keyType, "")
      this.line(4, `let k: ${keyType} = ${defaultOf(f.keyType)}`)
      if (f.type === ProtoScalar.Message) {
        this.line(4, `const v: ${f.target} = new ${f.target}()`)
      } else {
        this.line(4, `let v: ${nishType(f.type, f.target)} = ${defaultOf(f.type)}`)
      }
      this.line(4, "while (r.next()) {")
      this.line(5, `if (r.field === 1 && r.wireType === ${this.wire(wireOf(f.keyType))}) {`)
      this.line(6, `k = ${this.read(f.keyType)}`)
      this.line(5, `} else if (r.field === 2 && r.wireType === ${this.wire(wireOf(f.type))}) {`)
      if (f.type === ProtoScalar.Message) {
        this.line(6, "if (!r.enter() || !v.decode(r) || !r.leave()) {")
        this.line(7, "return false")
        this.line(6, "}")
      } else {
        this.line(6, `v = ${this.read(f.type)}`)
      }
      this.line(5, "}")
      this.line(4, "}")
      this.line(4, "if (!r.leave()) {")
      this.line(5, "return false")
      this.line(4, "}")
      this.line(4, `${x}.set(k, v)`)
      return
    }
    if (f.label === ProtoLabel.Repeated) {
      if (isPackable(f.type)) {
        const wt = this.wire(wireOf(f.type))
        this.line(3, `${open} (r.field === ${n} && r.wireType === ${this.wire("PROTO_WIRE_LEN")}) {`)
        this.line(4, `if (!r.enterPacked(${wt})) {`)
        this.line(5, "return false")
        this.line(4, "}")
        this.line(4, "while (r.more()) {")
        this.line(5, `${x}.push(${this.read(f.type)})`)
        this.line(4, "}")
        this.line(4, "if (!r.leave()) {")
        this.line(5, "return false")
        this.line(4, "}")
        this.line(3, `} else if (r.field === ${n} && r.wireType === ${wt}) {`)
        this.line(4, `${x}.push(${this.read(f.type)})`)
      } else if (f.type === ProtoScalar.Message) {
        this.line(3, `${open} (r.field === ${n} && r.wireType === ${this.wire("PROTO_WIRE_LEN")}) {`)
        this.line(4, `const m = new ${f.target}()`)
        this.line(4, "if (!r.enter() || !m.decode(r) || !r.leave()) {")
        this.line(5, "return false")
        this.line(4, "}")
        this.line(4, `${x}.push(m)`)
      } else {
        this.line(3, `${open} (r.field === ${n} && r.wireType === ${this.wire("PROTO_WIRE_LEN")}) {`)
        this.line(4, `${x}.push(${this.read(f.type)})`)
      }
      return
    }
    this.line(3, `${open} (r.field === ${n} && r.wireType === ${this.wire(wireOf(f.type))}) {`)
    if (f.type === ProtoScalar.Message) {
      this.line(4, `const old = ${x}`)
      this.line(4, `const m: ${f.target} = old !== null ? old : new ${f.target}()`)
      this.clearOneof(msg, f)
      this.line(4, `${x} = m`)
      this.line(4, "if (!r.enter() || !m.decode(r) || !r.leave()) {")
      this.line(5, "return false")
      this.line(4, "}")
    } else {
      this.clearOneof(msg, f)
      this.line(4, `${x} = ${this.read(f.type)}`)
      if (f.label === ProtoLabel.Optional) {
        this.line(4, `this.has_${f.name} = true`)
      }
    }
  }

  /** For a oneof member: sets the case and resets the oneof's other members. */
  clearOneof(msg: ProtoMessage, f: ProtoField): void {
    if (f.oneof < 0 || f.oneof >= msg.oneofs.length) {
      return
    }
    for (let i = 0; i < msg.fields.length; i++) {
      const other = msg.fields[i]
      if (other.oneof === f.oneof && other !== f) {
        const reset = other.type === ProtoScalar.Message ? "null" : defaultOf(other.type)
        this.line(4, `this.${other.name} = ${reset}`)
      }
    }
    this.line(4, `this.${msg.oneofs[f.oneof]}_case = ${f.number}`)
  }
}

/** The indices of a message's fields in field-number order. */
const byNumber = (msg: ProtoMessage): i32[] => {
  const order: i32[] = []
  for (let i = 0; i < msg.fields.length; i++) {
    order.push(i)
    let at = order.length - 1
    while (at > 0 && at < order.length && msg.fields[order[at - 1]].number > msg.fields[i].number) {
      order[at] = order[at - 1]
      at--
    }
    if (at >= 0 && at < order.length) {
      order[at] = i
    }
  }
  return order
}

/**
 * The loop of the string and bytes helpers: each byte of the reader's span, a
 * byte at a time. `String.fromBytes` and `slice` keep a range check no proof
 * removes, and the module is held to no panic by default; this loop's index is
 * proven inside the buffer. `keep` is the statement that keeps one byte.
 */
const spanWalk = (keep: string): string =>
  `  let left: i32 = r.len()\n  let q: i32 = r.spanStart\n  while (left > 0 && q >= 0 && q < toI32(r.buf.length)) {\n    ${keep}\n    q = q + 1\n    left = left - 1\n  }\n`

/**
 * The module for `file`. `source` is the input's base name and `digest` the
 * SHA-256 of its bytes, for the header; `command` is the regenerate line.
 */
export const emitProto = (file: ProtoFile, source: string, digest: string, command: string): string => {
  const e = new ProtoEmitter(file)
  for (let d = 0; d < file.decls.length; d++) {
    const decl = file.decls[d]
    if (decl.isEnum) {
      e.emitEnum(decl.index)
    } else if (decl.index < file.messages.length) {
      e.emitMessage(file.messages[decl.index])
    }
  }
  const body = e.out.toText()
  const head = new StringBuilder()
  head.add(`// Generated by nish proto from ${source} (sha256 ${digest}). Do not edit; regenerate it.\n`)
  head.add(`// Regenerate: ${command}\n`)
  if (file.ignored.length > 0) {
    head.add(`// Ignored options: ${file.ignored.join(", ")}\n`)
  }
  if (file.messages.length > 0) {
    const names: string[] = ["PROTO_OK"]
    if (e.usesI64) {
      names.push("PROTO_WIRE_I64")
    }
    if (e.usesI32) {
      names.push("PROTO_WIRE_I32")
    }
    if (e.usesLen) {
      names.push("PROTO_WIRE_LEN")
    }
    if (e.usesVarint) {
      names.push("PROTO_WIRE_VARINT")
    }
    names.push("ProtoReader")
    names.push("ProtoWriter")
    head.add("\n")
    head.add(`import { ${names.join(", ")} } from "nish/net/protobuf"\n`)
  }
  if (file.services.length > 0) {
    head.add("\n")
    for (let i = 0; i < file.services.length; i++) {
      const s = file.services[i]
      const prefix = file.pkg.length > 0 ? `/${file.pkg}.${s.name}/` : `/${s.name}/`
      for (let k = 0; k < s.methods.length; k++) {
        head.add("export const ")
        addMethodConstant(head, s.name, s.methods[k])
        head.add(`: string = "${prefix}${s.methods[k]}"\n`)
      }
    }
  }
  if (e.usesString) {
    head.add("\n")
    head.add('/** A string field\'s value: its bytes, or "" on a fault. */\n')
    head.add("const protoString = (r: ProtoReader): string => {\n")
    head.add("  const parts: string[] = []\n")
    head.add(spanWalk("parts.push(String.fromCharCode(r.buf[q]))"))
    head.add('  return parts.join("")\n')
    head.add("}\n")
  }
  if (e.usesBytes) {
    head.add("\n")
    head.add("/** A bytes field's value: a copy of its bytes, or none on a fault. */\n")
    head.add("const protoBytes = (r: ProtoReader): u8[] => {\n")
    head.add("  const out: u8[] = []\n")
    head.add(spanWalk("out.push(r.buf[q])"))
    head.add("  return out\n")
    head.add("}\n")
  }
  return `${head.toText()}${body}`
}
