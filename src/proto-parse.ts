// The model of a `.proto` file for `nish proto`, and every refusal
// (docs/wp72-proto-classes.md §3). `parseProto` reads the tokens of one
// proto3 file into messages, enums and services, then resolves each field's
// type and checks numbers and names. The first construct outside the subset,
// or the first syntax error, stops it: `failure` names it and `failLine` is
// its line, and the caller writes nothing.

import { StringMap, StringSet } from "./map"
import { StringBuilder } from "./strings"
import { lexProto, ProtoTok, ProtoToken, protoIntValue } from "./proto-lex"

/** A field's scalar type, or `Named` for an enum or a message to resolve. */
export enum ProtoScalar {
  Double,
  Float,
  Int64,
  Uint64,
  Int32,
  Fixed64,
  Fixed32,
  Bool,
  Str,
  Bytes,
  Uint32,
  Sfixed32,
  Sfixed64,
  Sint32,
  Sint64,
  Enum,
  Message,
  Named,
}

/** How a field holds its values. */
export enum ProtoLabel {
  Single,
  Optional,
  Repeated,
  Map,
}

/** The deepest message nesting the parser accepts. */
const MAX_NESTING: i32 = 32

/** The largest field number. */
const MAX_FIELD: i32 = 536870911

/** One field of a message. For a map, `keyType` is the key and `type` the value. */
export class ProtoField {
  name: string
  /** The type name as written, for a `Named` type. */
  typeName: string = ""
  /** The resolved enum or message: its emitted name. */
  target: string = ""
  number: i32
  label: ProtoLabel
  type: ProtoScalar
  keyType: ProtoScalar = ProtoScalar.Int32
  /** The index of its oneof in the message's `oneofs`, or -1. */
  oneof: i32 = -1
  line: i32

  constructor(name: string, number: i32, label: ProtoLabel, type: ProtoScalar, line: i32) {
    this.name = name
    this.number = number
    this.label = label
    this.type = type
    this.line = line
  }
}

/** One message: its fields in declaration order and its oneofs. */
export class ProtoMessage {
  /** The emitted class name, `Outer_Inner`. */
  name: string
  /** The full proto name, `pkg.Outer.Inner`. */
  fullName: string
  fields: ProtoField[]
  oneofs: string[]
  reservedFrom: i32[]
  reservedTo: i32[]
  reservedNames: string[]
  line: i32

  constructor(name: string, fullName: string, line: i32) {
    this.fields = []
    this.oneofs = []
    this.reservedFrom = []
    this.reservedTo = []
    this.reservedNames = []
    this.name = name
    this.fullName = fullName
    this.line = line
  }
}

/** One enum: its values in declaration order. */
export class ProtoEnum {
  name: string
  fullName: string
  values: string[]
  numbers: i32[]
  line: i32

  constructor(name: string, fullName: string, line: i32) {
    this.values = []
    this.numbers = []
    this.name = name
    this.fullName = fullName
    this.line = line
  }
}

/** One service: each method's name. */
export class ProtoService {
  name: string
  methods: string[]
  line: i32

  constructor(name: string, line: i32) {
    this.methods = []
    this.name = name
    this.line = line
  }
}

/** One declaration in output order: a message (`isEnum` false) or an enum, by index. */
export class ProtoDecl {
  isEnum: boolean
  index: i32

  constructor(isEnum: boolean, index: i32) {
    this.isEnum = isEnum
    this.index = index
  }
}

/** A parsed file, or the refusal that stopped it. */
export class ProtoFile {
  pkg: string = ""
  messages: ProtoMessage[]
  enums: ProtoEnum[]
  services: ProtoService[]
  /** Messages and enums in declaration order, a nested one after its parent. */
  decls: ProtoDecl[]
  /** The file options read and ignored, in order, each once. */
  ignored: string[]
  failure: string = ""
  failLine: i32 = 0

  constructor() {
    this.messages = []
    this.enums = []
    this.services = []
    this.decls = []
    this.ignored = []
  }
}

/** The scalar a type word names, or `Named`. */
const scalarOf = (word: string): ProtoScalar => {
  if (word === "double") {
    return ProtoScalar.Double
  }
  if (word === "float") {
    return ProtoScalar.Float
  }
  if (word === "int64") {
    return ProtoScalar.Int64
  }
  if (word === "uint64") {
    return ProtoScalar.Uint64
  }
  if (word === "int32") {
    return ProtoScalar.Int32
  }
  if (word === "fixed64") {
    return ProtoScalar.Fixed64
  }
  if (word === "fixed32") {
    return ProtoScalar.Fixed32
  }
  if (word === "bool") {
    return ProtoScalar.Bool
  }
  if (word === "string") {
    return ProtoScalar.Str
  }
  if (word === "bytes") {
    return ProtoScalar.Bytes
  }
  if (word === "uint32") {
    return ProtoScalar.Uint32
  }
  if (word === "sfixed32") {
    return ProtoScalar.Sfixed32
  }
  if (word === "sfixed64") {
    return ProtoScalar.Sfixed64
  }
  if (word === "sint32") {
    return ProtoScalar.Sint32
  }
  if (word === "sint64") {
    return ProtoScalar.Sint64
  }
  return ProtoScalar.Named
}

/** Whether a file option is one `nish proto` reads and ignores. */
const isIgnoredOption = (name: string): boolean =>
  name.startsWith("java_") ||
  name.startsWith("go_") ||
  name.startsWith("php_") ||
  name === "csharp_namespace" ||
  name === "objc_class_prefix" ||
  name === "ruby_package" ||
  name === "swift_prefix" ||
  name === "optimize_for"

/** TypeScript's reserved and strict-mode words: no generated name may be one. */
const KEYWORDS: string =
  " break case catch class const continue debugger default delete do else enum export extends false finally for" +
  " function if import in instanceof new null return super switch this throw true try typeof var void while" +
  " with yield let static implements interface package private protected public await constructor" +
  " arguments eval undefined "

/**
 * The names a top-level declaration may not take: Nish's own types and the
 * globals a module sees, and the generated module's imports and helpers.
 */
const GLOBALS: string =
  " any unknown never object number string boolean bigint symbol i8 i16 i32 i64 u8 u16 u32 u64 f32 f64" +
  " Array Map Set String Number Boolean Object Symbol Error Math JSON Date Promise Secret console process" +
  " ProtoReader ProtoWriter protoString protoBytes "

/** Whether `name` is a word no generated name may be. */
const isProtoKeyword = (name: string): boolean => KEYWORDS.indexOf(` ${name} `) >= 0

/** Whether a top-level declaration may not be named `name`. */
const isProtoReserved = (name: string): boolean =>
  isProtoKeyword(name) || GLOBALS.indexOf(` ${name} `) >= 0 || name.startsWith("PROTO_")

/**
 * `name` in upper snake case, for a method path's constant: an `_` before an
 * upper-case letter that follows a lower-case letter or a digit, or that
 * starts a word after a run of capitals (`HTTPServer` is `HTTP_SERVER`).
 */
const upperSnake = (name: string): string => {
  const out = new StringBuilder()
  for (let i = 0; i < name.length; i++) {
    const c = name.charCodeAt(i)
    const upper = c >= 65 && c <= 90
    const prev = i > 0 ? name.charCodeAt(i - 1) : 95
    const next = i + 1 < name.length ? name.charCodeAt(i + 1) : 95
    const prevLower = (prev >= 97 && prev <= 122) || (prev >= 48 && prev <= 57)
    const prevUpper = prev >= 65 && prev <= 90
    const nextLower = next >= 97 && next <= 122
    if (upper && (prevLower || (prevUpper && nextLower))) {
      out.addChar(95)
    }
    out.addChar(c >= 97 && c <= 122 ? c - 32 : c)
  }
  return out.toText()
}

/** The constant a service method's path is emitted as. */
export const methodConstant = (service: string, method: string): string =>
  `${upperSnake(service)}_${upperSnake(method)}`

/** The parser's state: the tokens, the cursor and the file it fills. */
class ProtoParser {
  toks: ProtoToken[]
  pos: i32 = 0
  file: ProtoFile
  /** Each method's request and response type names, resolved after the parse. */
  methodTypes: string[]
  methodLines: i32[]

  constructor(toks: ProtoToken[]) {
    this.methodTypes = []
    this.methodLines = []
    this.toks = toks
    this.file = new ProtoFile()
  }

  /** The current token; the last one (`End` or `Bad`) once past it. */
  peek(): ProtoToken {
    let k = this.pos < this.toks.length ? this.pos : this.toks.length - 1
    if (k < 0) {
      k = 0
    }
    return this.toks[k]
  }

  /** The token after the current one, or the last. */
  peek2(): ProtoToken {
    let k = this.pos + 1 < this.toks.length ? this.pos + 1 : this.toks.length - 1
    if (k < 0) {
      k = 0
    }
    return this.toks[k]
  }

  /** Whether the parse has stopped. */
  failed(): boolean {
    return this.file.failure.length > 0
  }

  /** Stops the parse with `message` at `line`, unless it has already stopped. */
  fail(message: string, line: i32): boolean {
    if (!this.failed()) {
      this.file.failure = message
      this.file.failLine = line
    }
    return false
  }

  /** Stops the parse with a refusal of `what`. */
  refuse(what: string, line: i32): boolean {
    return this.fail(`refused: ${what}`, line)
  }

  /** Steps past the current token. */
  advance(): ProtoToken {
    const t = this.peek()
    if (this.pos < this.toks.length) {
      this.pos = this.pos + 1
    }
    return t
  }

  /** Whether the current token is the punctuation `p`. */
  isPunct(p: string): boolean {
    const t = this.peek()
    return t.kind === ProtoTok.Punct && t.text === p
  }

  /** Whether the current token is the identifier `word`. */
  isWord(word: string): boolean {
    const t = this.peek()
    return t.kind === ProtoTok.Ident && t.text === word
  }

  /** How a token reads in an error. */
  shown(t: ProtoToken): string {
    if (t.kind === ProtoTok.End) {
      return "the end of the file"
    }
    if (t.kind === ProtoTok.Str) {
      return "a string"
    }
    return `"${t.text}"`
  }

  /** Stops the parse with "expected `what`, found" the token `t`. */
  expected(what: string, t: ProtoToken): boolean {
    return this.fail(`expected ${what}, found ${this.shown(t)}`, t.line)
  }

  /** Steps past the punctuation `p`, or stops the parse. */
  expect(p: string, after: string): boolean {
    const t = this.peek()
    if (t.kind === ProtoTok.Bad) {
      return this.fail(t.text, t.line)
    }
    if (!this.isPunct(p)) {
      return this.expected(`"${p}" ${after}`, t)
    }
    this.advance()
    return true
  }

  /** An identifier, or "" with the parse stopped. */
  ident(what: string): string {
    const t = this.peek()
    if (t.kind === ProtoTok.Bad) {
      this.fail(t.text, t.line)
      return ""
    }
    if (t.kind !== ProtoTok.Ident) {
      this.expected(what, t)
      return ""
    }
    this.advance()
    return t.text
  }

  /** A dotted name, `a.b.c`, with an optional leading dot; "" with the parse stopped. */
  dotted(what: string): string {
    let lead = ""
    if (this.isPunct(".")) {
      this.advance()
      lead = "."
    }
    const parts: string[] = []
    const first = this.ident(what)
    if (first.length === 0) {
      return ""
    }
    parts.push(first)
    while (this.isPunct(".")) {
      this.advance()
      const part = this.ident(what)
      if (part.length === 0) {
        return ""
      }
      parts.push(part)
    }
    return `${lead}${parts.join(".")}`
  }

  /** A string token's value; `ok` false with the parse stopped. */
  str(what: string): string {
    const t = this.peek()
    if (t.kind !== ProtoTok.Str) {
      if (t.kind === ProtoTok.Bad) {
        this.fail(t.text, t.line)
      } else {
        this.expected(what, t)
      }
      return ""
    }
    this.advance()
    return t.text
  }

  /** An integer token's value, or -1 with the parse stopped. */
  int(what: string): i64 {
    const t = this.peek()
    if (t.kind !== ProtoTok.Int) {
      if (t.kind === ProtoTok.Bad) {
        this.fail(t.text, t.line)
      } else {
        this.expected(what, t)
      }
      return toI64(-1)
    }
    this.advance()
    const v = protoIntValue(t.text)
    if (v < toI64(0)) {
      this.fail(`${t.text} is not an integer protobuf allows here`, t.line)
    }
    return v
  }

  /** The file: `syntax = "proto3";`, then its top-level statements. */
  parseFile(): void {
    const first = this.peek()
    if (first.kind === ProtoTok.Bad) {
      this.fail(first.text, first.line)
      return
    }
    if (this.isWord("edition")) {
      this.refuse("editions (only proto3 is supported)", first.line)
      return
    }
    if (!this.isWord("syntax")) {
      this.refuse("a file with no syntax statement, which is proto2 (only proto3 is supported)", first.line)
      return
    }
    this.advance()
    if (!this.expect("=", "after syntax")) {
      return
    }
    const syntaxLine = this.peek().line
    const syntax = this.str("the syntax string")
    if (this.failed()) {
      return
    }
    if (syntax !== "proto3") {
      this.refuse(`${syntax} syntax (only proto3 is supported)`, syntaxLine)
      return
    }
    if (!this.expect(";", "after the syntax statement")) {
      return
    }
    while (!this.failed()) {
      const t = this.peek()
      if (t.kind === ProtoTok.End) {
        return
      }
      if (t.kind === ProtoTok.Bad) {
        this.fail(t.text, t.line)
        return
      }
      if (this.isPunct(";")) {
        this.advance()
      } else if (this.isWord("import")) {
        this.refuse("import (one file in, one module out)", t.line)
      } else if (this.isWord("package")) {
        this.advance()
        if (this.file.pkg.length > 0) {
          this.refuse("a second package statement", t.line)
          return
        }
        const name = this.dotted("a package name")
        if (this.failed()) {
          return
        }
        if (name.startsWith(".")) {
          this.fail("a package name may not start with a dot", t.line)
          return
        }
        this.file.pkg = name
        this.expect(";", "after the package name")
      } else if (this.isWord("option")) {
        this.parseFileOption()
      } else if (this.isWord("message")) {
        this.advance()
        this.parseMessage(this.file.pkg, "", 1)
      } else if (this.isWord("enum")) {
        this.advance()
        this.parseEnum(this.file.pkg, "")
      } else if (this.isWord("service")) {
        this.advance()
        this.parseService()
      } else if (this.isWord("extend")) {
        this.refuse("extend (proto2 only)", t.line)
      } else {
        this.expected("a message, enum, service, option or package", t)
      }
    }
  }

  /** `option name = value;` at the top: a listed one is ignored, any other refused. */
  parseFileOption(): void {
    const line = this.advance().line
    if (this.isPunct("(")) {
      this.refuse("a custom option (an option changes what the code means)", line)
      return
    }
    const name = this.dotted("an option name")
    if (this.failed()) {
      return
    }
    if (!isIgnoredOption(name)) {
      this.refuse(`option ${name} (an option changes what the code means)`, line)
      return
    }
    if (!this.expect("=", "after the option name")) {
      return
    }
    const v = this.peek()
    if (v.kind === ProtoTok.Bad) {
      this.fail(v.text, v.line)
      return
    }
    if (v.kind === ProtoTok.Punct || v.kind === ProtoTok.End) {
      this.expected("the option's value", v)
      return
    }
    this.advance()
    if (!this.expect(";", "after the option's value")) {
      return
    }
    for (let i = 0; i < this.file.ignored.length; i++) {
      if (this.file.ignored[i] === name) {
        return
      }
    }
    this.file.ignored.push(name)
  }

  /**
   * `message Name { ... }`, the keyword already read. `scope` is the full
   * name of what encloses it and `prefix` its emitted class name ("" at the top).
   */
  parseMessage(scope: string, prefix: string, depth: i32): void {
    const line = this.peek().line
    if (depth > MAX_NESTING) {
      this.refuse(`message nesting deeper than ${MAX_NESTING}`, line)
      return
    }
    const name = this.ident("a message name")
    if (this.failed()) {
      return
    }
    const emitted = prefix.length > 0 ? `${prefix}_${name}` : name
    const full = scope.length > 0 ? `${scope}.${name}` : name
    const msg = new ProtoMessage(emitted, full, line)
    this.file.decls.push(new ProtoDecl(false, this.file.messages.length))
    this.file.messages.push(msg)
    if (!this.expect("{", "after the message name")) {
      return
    }
    while (!this.failed()) {
      const t = this.peek()
      if (t.kind === ProtoTok.Bad) {
        this.fail(t.text, t.line)
        return
      }
      if (t.kind === ProtoTok.End) {
        this.fail(`message ${name} is not closed`, line)
        return
      }
      if (this.isPunct("}")) {
        this.advance()
        return
      }
      if (this.isPunct(";")) {
        this.advance()
      } else if (this.isWord("message") && this.peek2().kind === ProtoTok.Ident) {
        this.advance()
        this.parseMessage(full, emitted, depth + 1)
      } else if (this.isWord("enum") && this.peek2().kind === ProtoTok.Ident) {
        this.advance()
        this.parseEnum(full, emitted)
      } else if (this.isWord("oneof") && this.peek2().kind === ProtoTok.Ident) {
        this.advance()
        this.parseOneof(msg)
      } else if (this.isWord("reserved") && !this.isFieldStart()) {
        this.advance()
        this.parseReserved(msg)
      } else if (this.isWord("option") && !this.isFieldStart()) {
        this.refuse("a message option (an option changes what the code means)", t.line)
      } else if (this.isWord("extensions") && !this.isFieldStart()) {
        this.refuse("extensions (proto2 only)", t.line)
      } else if (this.isWord("extend") && !this.isFieldStart()) {
        this.refuse("extend (proto2 only)", t.line)
      } else {
        this.parseField(msg, -1)
      }
    }
  }

  /**
   * Whether the current word starts a field whose type is named like a
   * keyword (`reserved reserved = 1;` declares a field): a name, `=` and a
   * field number follow, where `option deprecated = true;` has a value.
   */
  isFieldStart(): boolean {
    const n = this.peek2()
    return (
      n.kind === ProtoTok.Ident &&
      this.pos + 3 < this.toks.length &&
      this.toks[this.pos + 2].text === "=" &&
      this.toks[this.pos + 3].kind === ProtoTok.Int
    )
  }

  /** One field, or a map field; `oneof` is its oneof's index or -1. */
  parseField(msg: ProtoMessage, oneof: i32): void {
    const line = this.peek().line
    let label = ProtoLabel.Single
    if (this.isWord("required")) {
      this.refuse("required (proto2 only)", line)
      return
    }
    if (this.isWord("group")) {
      this.refuse("group (proto2 only)", line)
      return
    }
    if ((this.isWord("repeated") || this.isWord("optional")) && !this.isFieldStart()) {
      if (oneof >= 0) {
        this.refuse(`${this.peek().text} inside a oneof`, line)
        return
      }
      label = this.isWord("repeated") ? ProtoLabel.Repeated : ProtoLabel.Optional
      this.advance()
      if (this.isWord("group")) {
        this.refuse("group (proto2 only)", line)
        return
      }
    }
    let keyType = ProtoScalar.Int32
    let typeName = ""
    if (this.isWord("map") && this.peek2().kind === ProtoTok.Punct && this.peek2().text === "<") {
      if (oneof >= 0) {
        this.refuse("map inside a oneof", line)
        return
      }
      if (label !== ProtoLabel.Single) {
        this.fail("a map field takes no label", line)
        return
      }
      this.advance()
      this.advance()
      const key = this.ident("a map key type")
      if (this.failed()) {
        return
      }
      keyType = scalarOf(key)
      if (
        keyType === ProtoScalar.Named ||
        keyType === ProtoScalar.Float ||
        keyType === ProtoScalar.Double ||
        keyType === ProtoScalar.Bytes
      ) {
        this.refuse(`a map key of ${key} (keys are integers, bool or string)`, line)
        return
      }
      if (!this.expect(",", "after the map key type")) {
        return
      }
      if (this.isWord("map")) {
        this.refuse("a map value that is a map", line)
        return
      }
      typeName = this.dotted("a map value type")
      if (this.failed()) {
        return
      }
      if (!this.expect(">", "after the map value type")) {
        return
      }
      label = ProtoLabel.Map
    } else {
      typeName = this.dotted("a field type")
      if (this.failed()) {
        return
      }
    }
    const name = this.ident("a field name")
    if (this.failed()) {
      return
    }
    if (!this.expect("=", `after field ${name}`)) {
      return
    }
    const numberLine = this.peek().line
    const n = this.int("a field number")
    if (this.failed()) {
      return
    }
    if (n < toI64(1) || n > toI64(MAX_FIELD)) {
      this.refuse(`field number ${n} (field numbers are 1 to ${MAX_FIELD})`, numberLine)
      return
    }
    const number = toI32(n)
    if (number >= 19000 && number <= 19999) {
      this.refuse(
        `field number ${number} (19000 to 19999 are reserved for the protobuf implementation)`,
        numberLine
      )
      return
    }
    if (this.isPunct("[")) {
      this.refuse(`a field option on ${name} (an option changes what the code means)`, this.peek().line)
      return
    }
    if (!this.expect(";", `after field ${name}`)) {
      return
    }
    const scalar = scalarOf(typeName)
    const field = new ProtoField(name, number, label, scalar, line)
    field.keyType = keyType
    field.oneof = oneof
    if (scalar === ProtoScalar.Named) {
      field.typeName = typeName
    }
    msg.fields.push(field)
  }

  /** `oneof name { ... }`, the keyword already read. */
  parseOneof(msg: ProtoMessage): void {
    const line = this.peek().line
    const name = this.ident("a oneof name")
    if (this.failed()) {
      return
    }
    const index = msg.oneofs.length
    msg.oneofs.push(name)
    if (!this.expect("{", "after the oneof name")) {
      return
    }
    while (!this.failed()) {
      const t = this.peek()
      if (t.kind === ProtoTok.Bad) {
        this.fail(t.text, t.line)
        return
      }
      if (t.kind === ProtoTok.End) {
        this.fail(`oneof ${name} is not closed`, line)
        return
      }
      if (this.isPunct("}")) {
        this.advance()
        return
      }
      if (this.isPunct(";")) {
        this.advance()
      } else if (this.isWord("option") && !this.isFieldStart()) {
        this.refuse("a oneof option (an option changes what the code means)", t.line)
      } else {
        this.parseField(msg, index)
      }
    }
  }

  /** `reserved 1, 2 to 5, 9 to max;` or `reserved "a", "b";`, the keyword already read. */
  parseReserved(msg: ProtoMessage): void {
    if (this.peek().kind === ProtoTok.Str) {
      while (!this.failed()) {
        msg.reservedNames.push(this.str("a reserved name"))
        if (!this.isPunct(",")) {
          break
        }
        this.advance()
      }
      this.expect(";", "after the reserved names")
      return
    }
    while (!this.failed()) {
      const from = this.int("a reserved field number")
      if (this.failed()) {
        return
      }
      let to = from
      if (this.isWord("to")) {
        this.advance()
        if (this.isWord("max")) {
          this.advance()
          to = toI64(MAX_FIELD)
        } else {
          to = this.int("the end of a reserved range")
          if (this.failed()) {
            return
          }
        }
      }
      msg.reservedFrom.push(from > toI64(MAX_FIELD) ? MAX_FIELD : toI32(from))
      msg.reservedTo.push(to > toI64(MAX_FIELD) ? MAX_FIELD : toI32(to))
      if (!this.isPunct(",")) {
        break
      }
      this.advance()
    }
    this.expect(";", "after the reserved numbers")
  }

  /** `enum Name { ... }`, the keyword already read. */
  parseEnum(scope: string, prefix: string): void {
    const line = this.peek().line
    const name = this.ident("an enum name")
    if (this.failed()) {
      return
    }
    const e = new ProtoEnum(
      prefix.length > 0 ? `${prefix}_${name}` : name,
      scope.length > 0 ? `${scope}.${name}` : name,
      line
    )
    this.file.decls.push(new ProtoDecl(true, this.file.enums.length))
    this.file.enums.push(e)
    if (!this.expect("{", "after the enum name")) {
      return
    }
    while (!this.failed()) {
      const t = this.peek()
      if (t.kind === ProtoTok.Bad) {
        this.fail(t.text, t.line)
        return
      }
      if (t.kind === ProtoTok.End) {
        this.fail(`enum ${name} is not closed`, line)
        return
      }
      if (this.isPunct("}")) {
        this.advance()
        if (e.values.length === 0) {
          this.fail(`enum ${name} has no values`, line)
        }
        return
      }
      if (this.isPunct(";")) {
        this.advance()
      } else if (
        this.isWord("option") &&
        !(this.peek2().kind === ProtoTok.Punct && this.peek2().text === "=")
      ) {
        this.refuse("an enum option (an option changes what the code means)", t.line)
      } else if (
        this.isWord("reserved") &&
        !(this.peek2().kind === ProtoTok.Punct && this.peek2().text === "=")
      ) {
        this.refuse("reserved in an enum", t.line)
      } else {
        this.parseEnumValue(e, name)
      }
    }
  }

  /** `NAME = [-]number;` */
  parseEnumValue(e: ProtoEnum, enumName: string): void {
    const line = this.peek().line
    const value = this.ident("an enum value name")
    if (this.failed()) {
      return
    }
    if (!this.expect("=", `after ${value}`)) {
      return
    }
    let negative = false
    if (this.isPunct("-")) {
      this.advance()
      negative = true
    }
    const n = this.int("an enum value")
    if (this.failed()) {
      return
    }
    const signed: i64 = negative ? toI64(0) - n : n
    if (signed < toI64(-2147483648) || signed > toI64(2147483647)) {
      this.fail(`enum value ${value} is out of the int32 range`, line)
      return
    }
    if (this.isPunct("[")) {
      this.refuse(
        `an enum value option on ${value} (an option changes what the code means)`,
        this.peek().line
      )
      return
    }
    if (!this.expect(";", `after ${value}`)) {
      return
    }
    const number = toI32(signed)
    if (e.values.length === 0 && number !== 0) {
      this.fail(`the first value of enum ${enumName} must be 0 in proto3`, line)
      return
    }
    for (let i = 0; i < e.values.length; i++) {
      if (e.values[i] === value) {
        this.refuse(`two values named ${value} in enum ${enumName}`, line)
        return
      }
      if (i < e.numbers.length && e.numbers[i] === number) {
        this.refuse(
          `two values numbered ${number} in enum ${enumName} (an alias needs allow_alias, an option)`,
          line
        )
        return
      }
    }
    e.values.push(value)
    e.numbers.push(number)
  }

  /** `service Name { rpc ... }`, the keyword already read. */
  parseService(): void {
    const line = this.peek().line
    const name = this.ident("a service name")
    if (this.failed()) {
      return
    }
    const s = new ProtoService(name, line)
    this.file.services.push(s)
    if (!this.expect("{", "after the service name")) {
      return
    }
    while (!this.failed()) {
      const t = this.peek()
      if (t.kind === ProtoTok.Bad) {
        this.fail(t.text, t.line)
        return
      }
      if (t.kind === ProtoTok.End) {
        this.fail(`service ${name} is not closed`, line)
        return
      }
      if (this.isPunct("}")) {
        this.advance()
        return
      }
      if (this.isPunct(";")) {
        this.advance()
      } else if (this.isWord("option")) {
        this.refuse("a service option (an option changes what the code means)", t.line)
      } else if (this.isWord("rpc")) {
        this.advance()
        this.parseMethod(s)
      } else {
        this.expected("rpc", t)
      }
    }
  }

  /** `Name (Req) returns (Res);` or with a `{ }` body, `rpc` already read. */
  parseMethod(s: ProtoService): void {
    const line = this.peek().line
    const name = this.ident("a method name")
    if (this.failed()) {
      return
    }
    const request = this.methodType(name)
    if (this.failed()) {
      return
    }
    if (!this.isWord("returns")) {
      this.expected(`returns after the request type of ${name}`, this.peek())
      return
    }
    this.advance()
    const response = this.methodType(name)
    if (this.failed()) {
      return
    }
    if (this.isPunct("{")) {
      this.advance()
      while (!this.failed() && this.isPunct(";")) {
        this.advance()
      }
      if (this.failed()) {
        return
      }
      if (this.isWord("option")) {
        this.refuse("a method option (an option changes what the code means)", this.peek().line)
        return
      }
      if (!this.expect("}", `to close method ${name}`)) {
        return
      }
    } else if (!this.expect(";", `after method ${name}`)) {
      return
    }
    for (let i = 0; i < s.methods.length; i++) {
      if (s.methods[i] === name) {
        this.refuse(`two methods named ${name} in service ${s.name}`, line)
        return
      }
    }
    s.methods.push(name)
    this.methodTypes.push(request)
    this.methodTypes.push(response)
    this.methodLines.push(line)
    this.methodLines.push(line)
  }

  /** `( [stream] Type )`: the type name, or "" with the parse stopped. */
  methodType(method: string): string {
    if (!this.expect("(", `after method ${method}`)) {
      return ""
    }
    if (this.isWord("stream") && this.peek2().kind !== ProtoTok.Punct) {
      this.refuse(`stream in method ${method} (only unary methods are supported)`, this.peek().line)
      return ""
    }
    const type = this.dotted("a message type")
    if (this.failed()) {
      return ""
    }
    this.expect(")", `after the type of method ${method}`)
    return type
  }
}

/**
 * The full name `name` names from `scope`, or "" when nothing the file
 * declares answers it: the innermost enclosing scope first, as protoc
 * resolves, and a leading dot for a name already full.
 */
const resolveName = (name: string, scope: string, known: StringMap): string => {
  if (name.startsWith(".")) {
    const full = name.substring(1, name.length)
    return known.has(full) ? full : ""
  }
  let s = scope
  while (true) {
    const full = s.length > 0 ? `${s}.${name}` : name
    if (known.has(full)) {
      return full
    }
    if (s.length === 0) {
      return ""
    }
    let dot = s.length - 1
    while (dot >= 0 && s.charCodeAt(dot) !== 46) {
      dot--
    }
    s = dot >= 0 ? s.substring(0, dot) : ""
  }
}

/**
 * The checks that need the whole file: names the module would not compile
 * with, numbers and names a message reserves or repeats, and each type name
 * resolved to the message or enum it names.
 */
const checkFile = (p: ProtoParser): void => {
  const file = p.file
  // Full name -> index: a message as its index, an enum as -1 - index.
  const known = new StringMap()
  for (let i = 0; i < file.messages.length; i++) {
    known.add(file.messages[i].fullName, i)
  }
  for (let i = 0; i < file.enums.length; i++) {
    known.add(file.enums[i].fullName, -1 - i)
  }
  // Every emitted top-level name, once.
  const names = new StringSet()
  for (let d = 0; d < file.decls.length; d++) {
    const decl = file.decls[d]
    const isEnum = decl.isEnum
    const name = isEnum ? file.enums[decl.index].name : file.messages[decl.index].name
    const line = isEnum ? file.enums[decl.index].line : file.messages[decl.index].line
    if (isProtoReserved(name)) {
      p.refuse(`the name ${name}, which the module would not compile with`, line)
      return
    }
    if (!names.add(name)) {
      p.refuse(`a second declaration named ${name}`, line)
      return
    }
  }
  for (let i = 0; i < file.services.length; i++) {
    const svc = file.services[i]
    for (let k = 0; k < svc.methods.length; k++) {
      const constant = methodConstant(svc.name, svc.methods[k])
      if (!names.add(constant)) {
        p.refuse(
          `method ${svc.methods[k]} of service ${svc.name}, whose constant ${constant} the module already has`,
          svc.line
        )
        return
      }
    }
  }
  for (let i = 0; i < file.enums.length; i++) {
    const e = file.enums[i]
    for (let k = 0; k < e.values.length; k++) {
      if (!names.add(`${e.name}_${e.values[k]}`)) {
        p.refuse(
          `the enum value ${e.values[k]}, whose constant ${e.name}_${e.values[k]} the module already has`,
          e.line
        )
        return
      }
    }
  }
  for (let m = 0; m < file.messages.length; m++) {
    const msg = file.messages[m]
    const members = new StringSet()
    members.add("encode")
    members.add("decode")
    for (let o = 0; o < msg.oneofs.length; o++) {
      if (!members.add(`${msg.oneofs[o]}_case`)) {
        p.refuse(`a second oneof named ${msg.oneofs[o]} in message ${msg.name}`, msg.line)
        return
      }
    }
    const numbers = new StringSet()
    for (let f = 0; f < msg.fields.length; f++) {
      const field = msg.fields[f]
      if (isProtoKeyword(field.name) || !members.add(field.name)) {
        p.refuse(
          `field ${field.name} in message ${msg.name}, a name the class already has or may not use`,
          field.line
        )
        return
      }
      if (field.label === ProtoLabel.Optional && !members.add(`has_${field.name}`)) {
        p.refuse(
          `field has_${field.name} in message ${msg.name}, the presence flag of ${field.name}`,
          field.line
        )
        return
      }
      if (!numbers.add(`${field.number}`)) {
        p.refuse(`two fields numbered ${field.number} in message ${msg.name}`, field.line)
        return
      }
      for (let r = 0; r < msg.reservedFrom.length && r < msg.reservedTo.length; r++) {
        if (field.number >= msg.reservedFrom[r] && field.number <= msg.reservedTo[r]) {
          p.refuse(
            `field ${field.name} uses number ${field.number}, which message ${msg.name} reserves`,
            field.line
          )
          return
        }
      }
      for (let r = 0; r < msg.reservedNames.length; r++) {
        if (msg.reservedNames[r] === field.name) {
          p.refuse(`field ${field.name}, a name message ${msg.name} reserves`, field.line)
          return
        }
      }
      if (field.type === ProtoScalar.Named) {
        if (field.typeName.startsWith("google.protobuf.") || field.typeName.startsWith(".google.protobuf.")) {
          p.refuse(`${field.typeName} (well-known types need an import)`, field.line)
          return
        }
        const full = resolveName(field.typeName, msg.fullName, known)
        if (full.length === 0) {
          p.refuse(`${field.typeName}, a type the file does not declare`, field.line)
          return
        }
        const index = known.get(full, 0)
        if (index >= 0) {
          field.type = ProtoScalar.Message
          field.target = index < file.messages.length ? file.messages[index].name : ""
        } else {
          const e = -1 - index
          field.type = ProtoScalar.Enum
          field.target = e < file.enums.length ? file.enums[e].name : ""
        }
      }
    }
  }
  for (let i = 0; i < p.methodTypes.length && i < p.methodLines.length; i++) {
    const t = p.methodTypes[i]
    if (t.startsWith("google.protobuf.") || t.startsWith(".google.protobuf.")) {
      p.refuse(`${t} (well-known types need an import)`, p.methodLines[i])
      return
    }
    const full = resolveName(t, file.pkg, known)
    if (full.length === 0 || known.get(full, 0) < 0) {
      p.refuse(`${t}, a message type the file does not declare`, p.methodLines[i])
      return
    }
  }
}

/** Parses and checks one `.proto` file's text. */
export const parseProto = (text: string): ProtoFile => {
  const p = new ProtoParser(lexProto(text))
  p.parseFile()
  if (!p.failed()) {
    checkFile(p)
  }
  return p.file
}
