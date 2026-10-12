// Typed JSON, the emitter's half: every call of `jsonDecode` or `jsonEncode`
// from `nish/json-typed` is lowered in place, to a call of a function written
// here from the fields of the class the call binds `T` to.
//
// The functions are this module's own, `internal`, and written once per
// module for each class, array and `Map` a call reaches, after every function
// of the module (`emitJsonParts`): a nested class, an array's element class, a
// `| null` field's class and a map's values each get theirs, so the code
// recurses as the data does and the tokenizer's depth limit bounds the
// recursion. They have no node behind them, so nothing here reads a side
// table: the layout is the `StructInfo` the checker built, the fields' types
// are the ones it resolved, and which types can be written at all was its
// rule (`src/json-typed.ts`), so a value that is none of them here is an
// internal error.
//
// What one class's decoding is, written out for fields `id`, `name` and `age`:
//
//     if (d.beginObject()) {
//       while (d.nextField()) {
//         switch (d.keyLength()) {
//           case 2: if (d.keyIs("id")) goto id; else goto unknown
//           case 4: if (d.keyIs("name")) goto name; else goto unknown
//           case 3: if (d.keyIs("age")) goto age; else goto unknown
//           default: goto unknown
//         }
//         id:   if (seen.id) d.duplicateField() else { seen.id = true; out.id = d.i32() }
//         name: ... out.name = d.string(out.name)
//         age:  ...
//         unknown: d.unknownField()
//       }
//       if (!seen.id) d.missingField() else if (!seen.name) ... else if (!seen.age) ...
//     }
//
// The key's length picks the fields it can be, so a key is compared with the
// name of a field of its own length and no other. When three or more fields
// share a length, one byte of the key (`d.keyByte(at)`, at the position where
// their names differ most) narrows them further before `keyIs` compares the
// whole key: a byte no name has there is an unknown key at once, and a key
// with an escape answers `-1`, and is compared with every name of its length
// instead (`emitJsonDispatch`). A class of one or two fields, and one or two
// names of one length, are compared in turn with `keyIs` and no switch, which
// is no more calls: `if (d.keyIs("x")) goto x; else if (d.keyIs("y")) goto y;
// else goto unknown`.
//
// The encoding is `w.beginObject()`, `w.key("id")` and `w.i32(v.id)` per field
// in declaration order, then `w.endObject()`. Every call into the decoder and
// the writer is a call of one of their methods, and every error is theirs and
// sticky, so this code has no error path of its own.
//
// The facts the attribute pass gives the instantiation are what this code may
// do (`markJsonRoute` in `src/attributes.ts`), and the functions themselves
// carry no attributes: LLVM infers what it can.

import { Emitter } from "./emit"
import { emitElementAt, emitEmptyArray, emitPushValue, loadLength, storeHeaderField } from "./emit-arrays"
import { emitNewWithoutArguments, loadField, storeField, structInfoOf } from "./emit-classes"
import { emitLibraryCopies, libraryReach, mapIntrinsicOf } from "./emit-map"
import { privateAbi } from "./emit-result"
import { internalErrorFor } from "./ice"
import { IRBlock, IRFunction, IRParam } from "./ir"
import {
  JSON_FIELD_ARRAY,
  JSON_FIELD_CLASS,
  JSON_FIELD_CLASS_ARRAY,
  JSON_FIELD_ENUM,
  JSON_FIELD_ENUM_ARRAY,
  JSON_FIELD_MAP,
  JSON_FIELD_SCALAR,
  JsonField,
  jsonDecodeMethod,
  jsonEncodeHelper,
  jsonFieldOf,
  jsonScalarMethod,
} from "./json-typed"
import {
  CheckedProgram,
  FieldInfo,
  FunctionSig,
  JSON_DECODE,
  MAP_NONE,
  StructInfo,
  TemplateInfo,
} from "./program"
import { StringSet } from "./map"
import { ARRAY_TYPE } from "./runtime"
import { T_I32, T_STRING, T_VOID } from "./types"

/** What one written function is for. */
const PART_DECODE: i32 = 1
const PART_DECODE_ARRAY: i32 = 2
const PART_NEW: i32 = 3
const PART_ENCODE: i32 = 4
const PART_ENCODE_ARRAY: i32 = 5
const PART_DECODE_MAP: i32 = 6
const PART_ENCODE_MAP: i32 = 7

/** The array header's LLVM type, as a value. */
const ARRAY_PTR: string = "%struct.nish_array*"

/** One function this module writes, queued until the module's own are emitted. */
export class JsonPart {
  kind: i32
  /** The class an object part reads or writes, or the `Map` a map part does; `null` for an array of enums. */
  info: StructInfo | null
  /** The value an array part's elements are, or a map part's values; `null` for an object part. */
  value: JsonField | null
  /** `JsonDecoder` for a decoding, `JsonWriter` for an encoding. */
  receiver: StructInfo
  /** `nish/json-typed`, whose encoding helpers an encoding calls by name. */
  home: CheckedProgram
  /** The symbol it is written under (`jsonPartName`). */
  name: string

  constructor(
    kind: i32,
    info: StructInfo | null,
    value: JsonField | null,
    receiver: StructInfo,
    home: CheckedProgram,
    name: string
  ) {
    this.kind = kind
    this.info = info
    this.value = value
    this.receiver = receiver
    this.home = home
    this.name = name
  }
}

/**
 * The symbol of a written function: a leading `.` no declared name can spell,
 * as the string constants have, then what it is for and the class, enum or map
 * it is for. `subject` is that name: a class's, `enum.` and an enum's symbol,
 * or a `Map` instance's.
 */
const jsonPartName = (kind: i32, subject: string): string => {
  if (kind === PART_DECODE) {
    return `.json.decode.${subject}`
  }
  if (kind === PART_DECODE_ARRAY) {
    return `.json.decode.array.${subject}`
  }
  if (kind === PART_NEW) {
    return `.json.new.${subject}`
  }
  if (kind === PART_DECODE_MAP) {
    return `.json.decode.map.${subject}`
  }
  if (kind === PART_ENCODE_MAP) {
    return `.json.encode.map.${subject}`
  }
  return kind === PART_ENCODE ? `.json.encode.${subject}` : `.json.encode.array.${subject}`
}

/** The symbol of the function for `kind` and `info` or `value`, queued the first time it is asked for. */
const jsonRequestPart = (
  emitter: Emitter,
  kind: i32,
  info: StructInfo | null,
  value: JsonField | null,
  from: JsonPart
): string => {
  // An enum's symbol may be a class's name too, in another module, and no
  // name can spell the `.` that keeps the two apart.
  let subject = ""
  if (info !== null) {
    subject = info.name
  } else if (value !== null) {
    subject = `enum.${emitter.table.nameOf(value.enumType)}`
  }
  const name = jsonPartName(kind, subject)
  if (emitter.jsonPartNames.add(name)) {
    emitter.jsonParts.push(new JsonPart(kind, info, value, from.receiver, from.home, name))
  }
  return name
}

const jsonFail = (emitter: Emitter, message: string): void => {
  process.exit(internalErrorFor(`emitter: typed JSON: ${message}`, emitter.opts.json))
}

/** `%struct.<name>*`, the type an object of `info` is passed as. */
const jsonObjectType = (info: StructInfo): string => `%struct.${info.name}*`

/**
 * A call of the method `name` of `receiver` on `self` with `args` already
 * typed (`<type> <value>`), answering its value, or `"void"`. A method that
 * returns a string the call may keep is bracketed by the reclaim, so the bytes
 * the decoder made the string from are given back (`Emitter.beginReclaim`).
 */
const jsonCallMethod = (
  emitter: Emitter,
  receiver: StructInfo,
  name: string,
  self: string,
  args: string[]
): string => {
  const sig = receiver.method(name)
  if (sig === null) {
    jsonFail(emitter, `\`${receiver.name}\` has no method \`${name}\``)
    return "void"
  }
  const operands: string[] = [`${jsonObjectType(receiver)} ${self}`]
  for (const arg of args) {
    operands.push(arg)
  }
  return jsonCallSig(emitter, sig, operands)
}

/** `call <ret> @sig(<operands>)`, answering its value or `"void"`. */
const jsonCallSig = (emitter: Emitter, sig: FunctionSig, operands: string[]): string => {
  const isPrivate = privateAbi(emitter.opts, sig.visibleOutside())
  const call = `call ${emitter.llvmAbi(sig.returnType, isPrivate)} @${sig.name}(${operands.join(", ")})`
  if (sig.returnType === T_VOID) {
    emitter.fn.emit(call)
    return "void"
  }
  const mark = emitter.beginReclaim(sig)
  return emitter.endReclaim(mark, emitter.fn.emitValue(call))
}

/** `nish/json-typed`'s function `name`. */
const jsonHelper = (emitter: Emitter, part: JsonPart, name: string): FunctionSig => {
  const home = part.home
  for (const sig of home.functions) {
    if (sig.sourceName === name && sig.instance === null && sig.definedIn(home.source)) {
      return sig
    }
  }
  jsonFail(emitter, `\`nish/json-typed\` has no \`${name}\``)
  return home.functions[0]
}

/** Every field of `info` as the checker's rule classifies it. */
const jsonFieldsOf = (emitter: Emitter, info: StructInfo): JsonField[] => {
  const out: JsonField[] = []
  for (const field of info.fields) {
    const f = jsonFieldOf(emitter.program, emitter.table, field)
    if (f === null || field.inline()) {
      jsonFail(emitter, `\`${info.name}.${field.name}\` is not a field the route can handle`)
    } else {
      out.push(f)
    }
  }
  return out
}

/** The class of an object, or of an array's element. */
const jsonValueClass = (emitter: Emitter, f: JsonField): StructInfo => {
  const cls = f.cls
  if (cls === null) {
    jsonFail(emitter, `\`${emitter.table.typeName(f.type)}\` holds no class`)
    return structInfoOf(emitter, f.type)
  }
  return cls
}

/** The `Map` instance of a map value. */
const jsonValueMap = (emitter: Emitter, f: JsonField): StructInfo => {
  const map = f.map
  if (map === null) {
    jsonFail(emitter, `\`${emitter.table.typeName(f.type)}\` is not a map`)
    return structInfoOf(emitter, f.type)
  }
  return map
}

/** What a map value holds. */
const jsonMapValue = (emitter: Emitter, f: JsonField): JsonField => {
  const value = f.value
  if (value === null) {
    jsonFail(emitter, `\`${emitter.table.typeName(f.type)}\` holds nothing`)
    return f
  }
  return value
}

/**
 * The integers an enum's members stand for, each once: the labels of the
 * switch that tells a member from any other number. Two members may share a
 * value, and a switch may not repeat a label.
 */
const jsonEnumValues = (emitter: Emitter, f: JsonField): i32[] => {
  const info = emitter.program.enumNamed(emitter.table.nameOf(f.enumType))
  const out: i32[] = []
  if (info === null) {
    jsonFail(emitter, `\`${emitter.table.typeName(f.enumType)}\` is not an enum this module can see`)
    return out
  }
  for (const v of info.memberValues) {
    if (!jsonHas(out, v)) {
      out.push(v)
    }
  }
  return out
}

/** Whether the decoder has not failed: one load of its `failed`, compared with `0`. */
const jsonDecoderOk = (emitter: Emitter, part: JsonPart): string => {
  const code = part.receiver.field("failed")
  if (code === null) {
    jsonFail(emitter, `\`${part.receiver.name}\` has no \`failed\``)
    return "true"
  }
  const failed = loadField(emitter, part.receiver, "%r", code)
  return emitter.fn.emitValue(`icmp eq ${emitter.llvm(code.type)} ${failed}, 0`)
}

/** `br i1 cond, label %yes, label %no`. */
const jsonBranch = (emitter: Emitter, cond: string, yes: string, no: string): void => {
  emitter.fn.emit(`br i1 ${cond}, label %${yes}, label %${no}`)
}

/**
 * Where one value is read from and written to: a field of the object
 * `object`, or a stack slot of its own (`slot`), which a map's value is
 * decoded into before it is `set`.
 */
class JsonPlace {
  info: StructInfo | null
  object: string
  field: FieldInfo | null
  slot: string
  /** The value's type, `| null` included. */
  type: i32

  constructor(info: StructInfo | null, object: string, field: FieldInfo | null, slot: string, type: i32) {
    this.info = info
    this.object = object
    this.field = field
    this.slot = slot
    this.type = type
  }
}

const jsonLoad = (emitter: Emitter, place: JsonPlace): string => {
  const info = place.info
  const field = place.field
  if (info !== null && field !== null) {
    return loadField(emitter, info, place.object, field)
  }
  const ty = emitter.llvm(place.type)
  return emitter.fn.emitValue(`load ${ty}, ${ty}* ${place.slot}${emitter.alignSuffix(place.type)}`)
}

const jsonStore = (emitter: Emitter, place: JsonPlace, value: string): void => {
  const info = place.info
  const field = place.field
  if (info !== null && field !== null) {
    storeField(emitter, info, place.object, field, value)
    return
  }
  const ty = emitter.llvm(place.type)
  emitter.fn.emit(`store ${ty} ${value}, ${ty}* ${place.slot}${emitter.alignSuffix(place.type)}`)
}

// ---- The call ---------------------------------------------------------------------------

/**
 * A call of the instantiation `sig` with its arguments lowered: `jsonDecode`
 * is the class's decoding, then `d.finish()`, whose answer is the call's;
 * `jsonEncode` is the class's encoding.
 */
export const emitJsonRoute = (emitter: Emitter, sig: FunctionSig, values: string[]): string => {
  const instance = sig.instance
  const template: TemplateInfo | null = instance === null ? null : instance.template
  if (instance === null || template === null || instance.typeArgs.length !== 1 || values.length !== 2) {
    jsonFail(emitter, `\`${sig.name}\` is not a call of \`jsonDecode\` or \`jsonEncode\``)
    return "void"
  }
  const info = structInfoOf(emitter, instance.typeArgs[0])
  const receiver = structInfoOf(emitter, sig.paramTypes[0])
  const root = new JsonPart(0, info, null, receiver, template.home.program, "")
  const self = `${jsonObjectType(receiver)} ${values[0]}`
  const object = `${jsonObjectType(info)} ${values[1]}`
  if (instance.jsonRoute === JSON_DECODE) {
    emitter.fn.emit(
      `call void @${jsonRequestPart(emitter, PART_DECODE, info, null, root)}(${self}, ${object})`
    )
    return jsonCallMethod(emitter, receiver, "finish", values[0], [])
  }
  emitter.fn.emit(`call void @${jsonRequestPart(emitter, PART_ENCODE, info, null, root)}(${self}, ${object})`)
  return "void"
}

/**
 * Write every function the module's calls asked for, and every one those ask
 * for in turn. Called once the module's own functions are emitted, and before
 * its declarations, so a string constant or a runtime function this code uses
 * is in the module like any other.
 */
export const emitJsonParts = (emitter: Emitter): void => {
  const saved = emitter.fn
  let at = 0
  while (at < emitter.jsonParts.length) {
    const part = emitter.jsonParts[at]
    at = at + 1
    emitter.module.addFunction(emitJsonPart(emitter, part))
  }
  emitter.fn = saved
  for (const library of emitter.libraries) {
    emitLibraryCopies(emitter, library, jsonLibraryReach(emitter, library))
  }
}

/**
 * The `Map` methods and constructors the written functions call: `clear`,
 * `has` and `set` to fill a map, `walkNext`, `keyAt` and `valueAt` to walk
 * one, and the constructor of each map a decoding makes.
 */
const jsonMapCallees = (emitter: Emitter): FunctionSig[] => {
  const out: FunctionSig[] = []
  for (const part of emitter.jsonParts) {
    const info = part.info
    if (info === null || info.instance === null) {
      continue
    }
    let names: string[] = []
    if (part.kind === PART_DECODE_MAP) {
      names = ["clear", "has", "set"]
    } else if (part.kind === PART_ENCODE_MAP) {
      names = ["walkNext", "keyAt", "valueAt"]
    }
    for (const name of names) {
      const sig = info.method(name)
      if (sig !== null) {
        out.push(sig)
      }
    }
    const ctor = info.ctor
    if (part.kind === PART_NEW && ctor !== null) {
      out.push(ctor)
    }
  }
  return out
}

/**
 * What of `library` (`std/collections.ts`) the written functions reach and
 * the module does not have yet. A library writes no `.ll` and each module
 * holds a copy of what its own functions reach (`libraryReach`), and the
 * written functions are not among those: they call a `Map`'s methods on the
 * instantiation's behalf, so the methods, and what they call in turn, are
 * copied here, less the ones `libraryReach` copied already.
 */
const jsonLibraryReach = (emitter: Emitter, library: CheckedProgram): FunctionSig[] => {
  const bySymbol = new StringSet()
  for (const sig of library.functions) {
    if (sig.definedIn(library.source)) {
      bySymbol.add(sig.name)
    }
  }
  const reached = new StringSet()
  const pending: string[] = []
  for (const sig of jsonMapCallees(emitter)) {
    if (bySymbol.has(sig.name) && reached.add(sig.name)) {
      pending.push(sig.name)
    }
  }
  let at = 0
  while (at < pending.length) {
    const facts = emitter.facts.get(pending[at])
    at = at + 1
    const callees: StringSet = facts === null ? new StringSet() : facts.callees
    let i = 0
    while (i < callees.size()) {
      const callee = callees.at(i)
      if (bySymbol.has(callee) && reached.add(callee)) {
        pending.push(callee)
      }
      i = i + 1
    }
  }
  const copied = new StringSet()
  for (const sig of libraryReach(emitter, library)) {
    copied.add(sig.name)
  }
  const out: FunctionSig[] = []
  for (const sig of library.functions) {
    if (reached.has(sig.name) && !copied.has(sig.name) && mapIntrinsicOf(sig) === MAP_NONE) {
      out.push(sig)
    }
  }
  return out
}

/** The class or `Map` a part is for. */
const jsonPartInfo = (emitter: Emitter, part: JsonPart): StructInfo => {
  const info = part.info
  if (info === null) {
    jsonFail(emitter, `\`${part.name}\` is for no class`)
    return part.receiver
  }
  return info
}

/** The value an array part's elements are, or a map part's values. */
const jsonPartValue = (emitter: Emitter, part: JsonPart): JsonField => {
  const value = part.value
  if (value === null) {
    jsonFail(emitter, `\`${part.name}\` is for no value`)
    return new JsonField(null, T_I32, JSON_FIELD_SCALAR, false)
  }
  return value
}

const emitJsonPart = (emitter: Emitter, part: JsonPart): IRFunction => {
  const params: IRParam[] = []
  const isArray = part.kind === PART_DECODE_ARRAY || part.kind === PART_ENCODE_ARRAY
  let ret = "void"
  if (part.kind === PART_NEW) {
    ret = jsonObjectType(jsonPartInfo(emitter, part))
  } else {
    params.push(new IRParam("r", jsonObjectType(part.receiver), []))
    params.push(new IRParam("v", isArray ? ARRAY_PTR : jsonObjectType(jsonPartInfo(emitter, part)), []))
    if (part.kind === PART_DECODE_ARRAY) {
      ret = ARRAY_PTR
    }
  }
  emitter.fn = new IRFunction(part.name, params, ret)
  emitter.fn.linkage = "internal"
  if (isArray) {
    emitter.declareType(ARRAY_TYPE)
  }
  if (part.kind === PART_DECODE) {
    emitJsonDecodeBody(emitter, part)
  } else if (part.kind === PART_DECODE_ARRAY) {
    emitJsonDecodeArrayBody(emitter, part)
  } else if (part.kind === PART_DECODE_MAP) {
    emitJsonDecodeMapBody(emitter, part)
  } else if (part.kind === PART_NEW) {
    const info = jsonPartInfo(emitter, part)
    emitter.fn.emit(`ret ${ret} ${emitNewWithoutArguments(emitter, info, info.decl)}`)
  } else if (part.kind === PART_ENCODE) {
    emitJsonEncodeBody(emitter, part)
  } else if (part.kind === PART_ENCODE_MAP) {
    emitJsonEncodeMapBody(emitter, part)
  } else {
    emitJsonEncodeArrayBody(emitter, part)
  }
  return emitter.fn
}

// ---- Decoding -----------------------------------------------------------------------------

/**
 * The fields among `candidates` (indices into `fields`) whose names have one
 * length, and the blocks a key of that length goes to: where the field with
 * its name is decoded (`targets`, by field), or `unknown`.
 */
class JsonDispatch {
  fields: JsonField[]
  /** The label of the block each field is decoded in, by field. */
  targets: string[]
  unknown: string

  constructor(fields: JsonField[], targets: string[], unknown: string) {
    this.fields = fields
    this.targets = targets
    this.unknown = unknown
  }
}

/** The name of field `k`, which is its key. */
const jsonKeyOf = (d: JsonDispatch, k: i32): string => {
  const field: FieldInfo | null = k >= 0 && k < d.fields.length ? d.fields[k].field : null
  return field === null ? "" : field.name
}

/** Whether `x` is one of `xs`. */
const jsonHas = (xs: i32[], x: i32): boolean => {
  for (const y of xs) {
    if (y === x) {
      return true
    }
  }
  return false
}

/**
 * `keyIs` against each candidate's name in turn, going to the first that
 * matches and to `unknown` when none does: the comparison that decides,
 * whatever the length or the byte has narrowed the candidates to.
 */
const emitJsonCompareEach = (emitter: Emitter, part: JsonPart, d: JsonDispatch, candidates: i32[]): void => {
  const fn = emitter.fn
  let i = 0
  while (i < candidates.length) {
    const k = candidates[i]
    i = i + 1
    const key = `i8* ${emitter.stringConstant(jsonKeyOf(d, k))}`
    const match = jsonCallMethod(emitter, part.receiver, "keyIs", "%r", [key])
    if (i === candidates.length) {
      jsonBranch(emitter, match, d.targets[k], d.unknown)
      return
    }
    const next = fn.newBlock("json.next")
    jsonBranch(emitter, match, d.targets[k], next.label)
    fn.placeBlock(next)
  }
  fn.emit(`br label %${d.unknown}`)
}

/**
 * The byte position where the names of `candidates`, all of one length `n`,
 * differ most: the one with the most distinct bytes, the first of those on a
 * tie. Every name is ASCII or UTF-8 and all have `n` bytes, so each position
 * is a byte of each.
 */
const jsonSplitAt = (d: JsonDispatch, candidates: i32[], n: i32): i32 => {
  let best = 0
  let bestCount = 0
  let at = 0
  while (at < n) {
    const bytes: i32[] = []
    for (const k of candidates) {
      const name = jsonKeyOf(d, k)
      const b = at < name.length ? toI32(name.charCodeAt(at)) : -1
      if (!jsonHas(bytes, b)) {
        bytes.push(b)
      }
    }
    if (bytes.length > bestCount) {
      best = at
      bestCount = bytes.length
    }
    at = at + 1
  }
  return best
}

/**
 * Below this many candidates of one length, a key is compared with each in
 * turn: with two, `keyIs` against the first and then the second is no more
 * calls than `keyByte` and then `keyIs`.
 */
const JSON_SPLIT_FROM: i32 = 3

/**
 * Below this many fields, a class's keys are compared with its names in
 * turn, as before the dispatch: one or two `keyIs` per key is no more than
 * `keyLength` and then `keyIs`.
 */
const JSON_DISPATCH_FROM: i32 = 3

/**
 * Dispatch a key among `candidates`, whose names all have `n` bytes. One or
 * two candidates are compared in turn. More are split by the byte where their
 * names differ most: each byte value goes to the candidates with that byte, a
 * key whose byte is none of theirs is unknown at once, and a key with an
 * escape, whose byte reads `-1`, is compared with every one of them.
 */
const emitJsonDispatchLength = (
  emitter: Emitter,
  part: JsonPart,
  d: JsonDispatch,
  candidates: i32[],
  n: i32
): void => {
  const fn = emitter.fn
  if (candidates.length < JSON_SPLIT_FROM) {
    emitJsonCompareEach(emitter, part, d, candidates)
    return
  }
  const at = jsonSplitAt(d, candidates, n)
  const byte = jsonCallMethod(emitter, part.receiver, "keyByte", "%r", [`i32 ${at}`])
  const slow = fn.newBlock("json.escaped")
  const values: i32[] = []
  for (const k of candidates) {
    const name = jsonKeyOf(d, k)
    const b = at >= 0 && at < name.length ? toI32(name.charCodeAt(at)) : -1
    if (!jsonHas(values, b)) {
      values.push(b)
    }
  }
  const blocks: IRBlock[] = []
  const labels: string[] = []
  for (const b of values) {
    const block = fn.newBlock("json.byte")
    blocks.push(block)
    labels.push(`i32 ${b}, label %${block.label}`)
  }
  labels.push(`i32 -1, label %${slow.label}`)
  fn.emit(`switch i32 ${byte}, label %${d.unknown} [ ${labels.join(" ")} ]`)
  let i = 0
  while (i < values.length && i < blocks.length) {
    // Both read before any call, which ends what the loop's test proved.
    const b = values[i]
    const block = blocks[i]
    const subset: i32[] = []
    for (const k of candidates) {
      const name = jsonKeyOf(d, k)
      if (at >= 0 && at < name.length && toI32(name.charCodeAt(at)) === b) {
        subset.push(k)
      }
    }
    fn.placeBlock(block)
    emitJsonCompareEach(emitter, part, d, subset)
    i = i + 1
  }
  fn.placeBlock(slow)
  emitJsonCompareEach(emitter, part, d, candidates)
}

/**
 * The key just read, sent to the block of the field it names or to
 * `unknown`: a `switch` on its length in bytes, then `emitJsonDispatchLength`
 * for the fields of that length.
 */
const emitJsonDispatch = (emitter: Emitter, part: JsonPart, d: JsonDispatch): void => {
  const fn = emitter.fn
  if (d.fields.length < JSON_DISPATCH_FROM) {
    const all: i32[] = []
    while (all.length < d.fields.length) {
      all.push(all.length)
    }
    emitJsonCompareEach(emitter, part, d, all)
    return
  }
  const lengths: i32[] = []
  let k = 0
  while (k < d.fields.length) {
    const n = jsonKeyOf(d, k).length
    if (!jsonHas(lengths, n)) {
      lengths.push(n)
    }
    k = k + 1
  }
  const length = jsonCallMethod(emitter, part.receiver, "keyLength", "%r", [])
  const blocks: IRBlock[] = []
  const labels: string[] = []
  for (const n of lengths) {
    const block = fn.newBlock("json.length")
    blocks.push(block)
    labels.push(`i32 ${n}, label %${block.label}`)
  }
  fn.emit(`switch i32 ${length}, label %${d.unknown} [ ${labels.join(" ")} ]`)
  let i = 0
  while (i < lengths.length && i < blocks.length) {
    // Both read before any call, which ends what the loop's test proved.
    const n = lengths[i]
    const block = blocks[i]
    const candidates: i32[] = []
    k = 0
    while (k < d.fields.length) {
      if (jsonKeyOf(d, k).length === n) {
        candidates.push(k)
      }
      k = k + 1
    }
    fn.placeBlock(block)
    emitJsonDispatchLength(emitter, part, d, candidates, n)
    i = i + 1
  }
}

const emitJsonDecodeBody = (emitter: Emitter, part: JsonPart): void => {
  const fn = emitter.fn
  const info = jsonPartInfo(emitter, part)
  const fields = jsonFieldsOf(emitter, info)
  const seen: string[] = []
  while (seen.length < fields.length) {
    const slot = fn.emitAlloca("seen", "i1", 1)
    fn.emit(`store i1 false, i1* ${slot}, align 1`)
    seen.push(slot)
  }
  const loop = fn.newBlock("json.loop")
  const keys = fn.newBlock("json.key")
  const unknown = fn.newBlock("json.unknown")
  const check = fn.newBlock("json.check")
  const duplicate = fn.newBlock("json.duplicate")
  const done = fn.newBlock("json.done")
  const open = jsonCallMethod(emitter, part.receiver, "beginObject", "%r", [])
  jsonBranch(emitter, open, loop.label, done.label)

  fn.placeBlock(loop)
  const more = jsonCallMethod(emitter, part.receiver, "nextField", "%r", [])
  jsonBranch(emitter, more, keys.label, check.label)

  fn.placeBlock(keys)
  const blocks: IRBlock[] = []
  const targets: string[] = []
  while (blocks.length < fields.length) {
    const block = fn.newBlock("json.field")
    blocks.push(block)
    targets.push(block.label)
  }
  emitJsonDispatch(emitter, part, new JsonDispatch(fields, targets, unknown.label))

  // One place, moved to each field in turn, rather than one made per field.
  const place = new JsonPlace(info, "%v", null, "", T_I32)
  let k = 0
  while (k < fields.length && k < seen.length && k < blocks.length) {
    // All three read before any call, which ends what the loop's test proved.
    const f = fields[k]
    const slot = seen[k]
    const target = blocks[k]
    const field = f.field
    fn.placeBlock(target)
    const given = fn.emitValue(`load i1, i1* ${slot}, align 1`)
    const take = fn.newBlock("json.take")
    jsonBranch(emitter, given, duplicate.label, take.label)
    fn.placeBlock(take)
    fn.emit(`store i1 true, i1* ${slot}, align 1`)
    if (field !== null) {
      place.field = field
      place.type = field.type
      emitJsonDecodeValue(emitter, part, f, place)
    }
    fn.emit(`br label %${loop.label}`)
    k = k + 1
  }

  fn.placeBlock(unknown)
  jsonCallMethod(emitter, part.receiver, "unknownField", "%r", [])
  fn.emit(`br label %${loop.label}`)

  fn.placeBlock(duplicate)
  jsonCallMethod(emitter, part.receiver, "duplicateField", "%r", [])
  fn.emit(`br label %${loop.label}`)

  // The object has closed, or the decoding failed and the calls below do nothing.
  fn.placeBlock(check)
  const missing = fn.newBlock("json.missing")
  k = 0
  while (k < seen.length) {
    const given = fn.emitValue(`load i1, i1* ${seen[k]}, align 1`)
    const next = fn.newBlock("json.given")
    jsonBranch(emitter, given, next.label, missing.label)
    fn.placeBlock(next)
    k = k + 1
  }
  fn.emit(`br label %${done.label}`)
  fn.placeBlock(missing)
  jsonCallMethod(emitter, part.receiver, "missingField", "%r", [])
  fn.emit(`br label %${done.label}`)

  fn.placeBlock(done)
  fn.emit("ret void")
}

/**
 * A number read for an enum, sent to `failed` when the read failed (its `0`
 * is no reading at all, though it may be a member's value), to `member` when
 * it is the value of one of the enum's members and to `other` when not: one
 * load of the decoder's `failed`, then one `switch`, whose labels are the
 * members' values.
 */
const emitJsonEnumCheck = (
  emitter: Emitter,
  part: JsonPart,
  f: JsonField,
  read: string,
  member: string,
  other: string,
  failed: string
): void => {
  const fn = emitter.fn
  const check = fn.newBlock("json.read")
  jsonBranch(emitter, jsonDecoderOk(emitter, part), check.label, failed)
  fn.placeBlock(check)
  const labels: string[] = []
  for (const v of jsonEnumValues(emitter, f)) {
    labels.push(`i32 ${v}, label %${member}`)
  }
  fn.emit(`switch i32 ${read}, label %${other} [ ${labels.join(" ")} ]`)
}

/**
 * Read one value from the decoder and store it into `place`. An enum's
 * number is stored only when it is a member's; any other is
 * `JSON_DECODE_TYPE`, and the place keeps the member it held.
 */
const emitJsonDecodeValue = (emitter: Emitter, part: JsonPart, f: JsonField, place: JsonPlace): void => {
  const fn = emitter.fn
  if (f.kind === JSON_FIELD_SCALAR && f.scalar !== T_STRING) {
    jsonStore(emitter, place, jsonCallMethod(emitter, part.receiver, jsonScalarMethod(f.scalar), "%r", []))
    return
  }
  if (f.kind === JSON_FIELD_ENUM) {
    const read = jsonCallMethod(emitter, part.receiver, "i32", "%r", [])
    const member = fn.newBlock("json.member")
    const other = fn.newBlock("json.other")
    const join = fn.newBlock("json.stored")
    emitJsonEnumCheck(emitter, part, f, read, member.label, other.label, join.label)
    fn.placeBlock(member)
    jsonStore(emitter, place, read)
    fn.emit(`br label %${join.label}`)
    fn.placeBlock(other)
    jsonCallMethod(emitter, part.receiver, "wrongType", "%r", [])
    fn.emit(`br label %${join.label}`)
    fn.placeBlock(join)
    return
  }
  let cur = jsonLoad(emitter, place)
  if (f.kind === JSON_FIELD_ARRAY) {
    const read = jsonCallMethod(emitter, part.receiver, jsonDecodeMethod(f), "%r", [
      `${emitter.llvm(f.type)} ${cur}`,
    ])
    jsonStore(emitter, place, read)
    return
  }
  // A string, an object, an array of objects or enums and a map are decoded
  // into what the place holds. A `| null` one is `null`, or what it holds once
  // it holds something.
  if (!f.nullable) {
    emitJsonDecodeInto(emitter, part, f, cur, place)
    return
  }
  const isNull = jsonCallMethod(emitter, part.receiver, "takeNull", "%r", [])
  const empty = fn.newBlock("json.null")
  const value = fn.newBlock("json.value")
  const join = fn.newBlock("json.stored")
  jsonBranch(emitter, isNull, empty.label, value.label)
  fn.placeBlock(empty)
  jsonStore(emitter, place, "null")
  fn.emit(`br label %${join.label}`)
  fn.placeBlock(value)
  cur = emitJsonSomething(emitter, part, f, cur, value.label)
  emitJsonDecodeInto(emitter, part, f, cur, place)
  // The object or map decoded into may be the one just made, which the place does not hold yet.
  if (f.kind === JSON_FIELD_CLASS || f.kind === JSON_FIELD_MAP) {
    jsonStore(emitter, place, cur)
  }
  fn.emit(`br label %${join.label}`)
  fn.placeBlock(join)
}

/**
 * A new object of the class or map `f` holds, made with no arguments: the
 * part that runs its constructor, as `new C()` does.
 */
const emitJsonNew = (emitter: Emitter, part: JsonPart, f: JsonField): string => {
  const info = f.kind === JSON_FIELD_MAP ? jsonValueMap(emitter, f) : jsonValueClass(emitter, f)
  return emitter.fn.emitValue(
    `call ${jsonObjectType(info)} @${jsonRequestPart(emitter, PART_NEW, info, null, part)}()`
  )
}

/**
 * What a `| null` value that holds `null` is decoded into: `""` for a string,
 * which no input string equals unless it is empty, and a new object, map or
 * array for the others. `cur` is the value, loaded in `from`.
 */
const emitJsonSomething = (
  emitter: Emitter,
  part: JsonPart,
  f: JsonField,
  cur: string,
  from: string
): string => {
  const fn = emitter.fn
  const valueType = emitter.llvm(f.type)
  const absent = fn.emitValue(`icmp eq ${valueType} ${cur}, null`)
  if (f.kind === JSON_FIELD_SCALAR) {
    return fn.emitValue(`select i1 ${absent}, i8* ${emitter.stringConstant("")}, i8* ${cur}`)
  }
  const make = fn.newBlock("json.make")
  const into = fn.newBlock("json.into")
  jsonBranch(emitter, absent, make.label, into.label)
  fn.placeBlock(make)
  let made = ""
  if (f.kind === JSON_FIELD_CLASS || f.kind === JSON_FIELD_MAP) {
    made = emitJsonNew(emitter, part, f)
  } else {
    made = emitEmptyArray(emitter)
  }
  const madeEdge = fn.currentBlock().label
  fn.emit(`br label %${into.label}`)
  fn.placeBlock(into)
  return fn.emitValue(`phi ${valueType} [ ${cur}, %${from} ], [ ${made}, %${madeEdge} ]`)
}

/**
 * Decode a string, an object, an array of objects or enums or a map into
 * `target`, and store what comes back into `place`: the string, or the array.
 * An object and a map are decoded where they are, so storing them is the
 * caller's.
 */
const emitJsonDecodeInto = (
  emitter: Emitter,
  part: JsonPart,
  f: JsonField,
  target: string,
  place: JsonPlace
): void => {
  const valueType = emitter.llvm(f.type)
  const self = `${jsonObjectType(part.receiver)} %r`
  if (f.kind === JSON_FIELD_SCALAR) {
    jsonStore(emitter, place, jsonCallMethod(emitter, part.receiver, "string", "%r", [`i8* ${target}`]))
    return
  }
  if (f.kind === JSON_FIELD_CLASS) {
    const callee = jsonRequestPart(emitter, PART_DECODE, jsonValueClass(emitter, f), null, part)
    emitter.fn.emit(`call void @${callee}(${self}, ${valueType} ${target})`)
    return
  }
  if (f.kind === JSON_FIELD_MAP) {
    const callee = jsonRequestPart(
      emitter,
      PART_DECODE_MAP,
      jsonValueMap(emitter, f),
      jsonMapValue(emitter, f),
      part
    )
    emitter.fn.emit(`call void @${callee}(${self}, ${valueType} ${target})`)
    return
  }
  const elem: StructInfo | null = f.kind === JSON_FIELD_CLASS_ARRAY ? jsonValueClass(emitter, f) : null
  const callee = jsonRequestPart(emitter, PART_DECODE_ARRAY, elem, f, part)
  const got = emitter.fn.emitValue(`call ${ARRAY_PTR} @${callee}(${self}, ${ARRAY_PTR} ${target})`)
  jsonStore(emitter, place, got)
}

/**
 * An array of objects or of enums, decoded into the array `%v` and answered.
 * An object goes into the object the array already has at its index, or into
 * a new one pushed past its end, and whatever is left over is dropped. An
 * enum's elements are numbers, with nothing to reuse, so the array is emptied
 * and each member pushed, into the room it already has.
 */
const emitJsonDecodeArrayBody = (emitter: Emitter, part: JsonPart): void => {
  if (part.info === null) {
    emitJsonDecodeEnumArrayBody(emitter, part, jsonPartValue(emitter, part))
    return
  }
  const fn = emitter.fn
  const info = jsonPartInfo(emitter, part)
  const elem = info.type
  const counter = fn.emitAlloca("at", "i64", 8)
  fn.emit(`store i64 0, i64* ${counter}, align 8`)
  const loop = fn.newBlock("json.loop")
  const element = fn.newBlock("json.element")
  const reuse = fn.newBlock("json.reuse")
  const grow = fn.newBlock("json.grow")
  const decode = fn.newBlock("json.decode")
  const end = fn.newBlock("json.end")
  const cut = fn.newBlock("json.cut")
  const done = fn.newBlock("json.done")
  const open = jsonCallMethod(emitter, part.receiver, "beginArray", "%r", [])
  jsonBranch(emitter, open, loop.label, done.label)

  fn.placeBlock(loop)
  const more = jsonCallMethod(emitter, part.receiver, "nextElement", "%r", [])
  jsonBranch(emitter, more, element.label, end.label)

  fn.placeBlock(element)
  const at = fn.emitValue(`load i64, i64* ${counter}, align 8`)
  const has = fn.emitValue(`icmp ult i64 ${at}, ${loadLength(emitter, "%v")}`)
  jsonBranch(emitter, has, reuse.label, grow.label)
  fn.placeBlock(reuse)
  const old = emitElementAt(emitter, "%v", elem, at)
  const reuseEdge = fn.currentBlock().label
  fn.emit(`br label %${decode.label}`)
  fn.placeBlock(grow)
  const made = fn.emitValue(
    `call ${jsonObjectType(info)} @${jsonRequestPart(emitter, PART_NEW, info, null, part)}()`
  )
  emitPushValue(emitter, "%v", elem, made)
  const growEdge = fn.currentBlock().label
  fn.emit(`br label %${decode.label}`)
  fn.placeBlock(decode)
  const target = fn.emitValue(
    `phi ${jsonObjectType(info)} [ ${old}, %${reuseEdge} ], [ ${made}, %${growEdge} ]`
  )
  const callee = jsonRequestPart(emitter, PART_DECODE, info, null, part)
  fn.emit(`call void @${callee}(${jsonObjectType(part.receiver)} %r, ${jsonObjectType(info)} ${target})`)
  const next = fn.emitValue(`add i64 ${at}, 1`)
  fn.emit(`store i64 ${next}, i64* ${counter}, align 8`)
  fn.emit(`br label %${loop.label}`)

  fn.placeBlock(end)
  const count = fn.emitValue(`load i64, i64* ${counter}, align 8`)
  const over = fn.emitValue(`icmp ult i64 ${count}, ${loadLength(emitter, "%v")}`)
  jsonBranch(emitter, over, cut.label, done.label)
  fn.placeBlock(cut)
  storeHeaderField(emitter, "%v", 0, count, "i64")
  fn.emit(`br label %${done.label}`)

  fn.placeBlock(done)
  fn.emit(`ret ${ARRAY_PTR} %v`)
}

/**
 * An array of enums: emptied once the input's array opens, then each element
 * read with `i32` and pushed when it is a member's value. Any other number is
 * `JSON_DECODE_TYPE`, and nothing is pushed for it, so every element the
 * array holds is a member, after an error too.
 */
const emitJsonDecodeEnumArrayBody = (emitter: Emitter, part: JsonPart, f: JsonField): void => {
  const fn = emitter.fn
  const loop = fn.newBlock("json.loop")
  const element = fn.newBlock("json.element")
  const member = fn.newBlock("json.member")
  const other = fn.newBlock("json.other")
  const done = fn.newBlock("json.done")
  const open = jsonCallMethod(emitter, part.receiver, "beginArray", "%r", [])
  const empty = fn.newBlock("json.empty")
  jsonBranch(emitter, open, empty.label, done.label)
  fn.placeBlock(empty)
  storeHeaderField(emitter, "%v", 0, "0", "i64")
  fn.emit(`br label %${loop.label}`)

  fn.placeBlock(loop)
  const more = jsonCallMethod(emitter, part.receiver, "nextElement", "%r", [])
  jsonBranch(emitter, more, element.label, done.label)

  fn.placeBlock(element)
  const read = jsonCallMethod(emitter, part.receiver, "i32", "%r", [])
  emitJsonEnumCheck(emitter, part, f, read, member.label, other.label, loop.label)
  fn.placeBlock(member)
  emitPushValue(emitter, "%v", f.enumType, read)
  fn.emit(`br label %${loop.label}`)
  fn.placeBlock(other)
  jsonCallMethod(emitter, part.receiver, "wrongType", "%r", [])
  fn.emit(`br label %${loop.label}`)

  fn.placeBlock(done)
  fn.emit(`ret ${ARRAY_PTR} %v`)
}

/**
 * The value a map's next entry starts from, before it is decoded: `null` for
 * a `| null` value, and otherwise what decoding reads into or over — a zero,
 * `false`, `""`, the enum's first member, or a new object, map or array.
 */
const emitJsonFresh = (emitter: Emitter, part: JsonPart, f: JsonField): string => {
  if (f.nullable) {
    return "null"
  }
  if (f.kind === JSON_FIELD_CLASS || f.kind === JSON_FIELD_MAP) {
    return emitJsonNew(emitter, part, f)
  }
  if (f.kind === JSON_FIELD_ARRAY || f.kind === JSON_FIELD_CLASS_ARRAY || f.kind === JSON_FIELD_ENUM_ARRAY) {
    return emitEmptyArray(emitter)
  }
  if (f.kind === JSON_FIELD_ENUM) {
    const values = jsonEnumValues(emitter, f)
    return values.length > 0 ? `${values[0]}` : "0"
  }
  if (f.scalar === T_STRING) {
    return emitter.stringConstant("")
  }
  const ty = emitter.llvm(f.type)
  if (ty === "double") {
    return "0.0"
  }
  return ty === "i1" ? "false" : "0"
}

/**
 * A map, decoded into the map `%v`: emptied once the input's object opens,
 * then each key read as a string and its value decoded into a slot of its
 * own and `set`, so the map's entries are in the input's order, unless its
 * read failed, when nothing is set. A key past the decoder's `maxMapKeys`,
 * counted over every map of the decoding, is `JSON_DECODE_MAP_LIMIT` before it
 * is read, which bounds what a body of colliding keys costs all the maps'
 * probes together. A key the
 * object gave already is `JSON_DECODE_DUPLICATE` before its value is read,
 * as a field's is (docs/security/json.md, JSON-3).
 */
const emitJsonDecodeMapBody = (emitter: Emitter, part: JsonPart): void => {
  const fn = emitter.fn
  const map = jsonPartInfo(emitter, part)
  const value = jsonPartValue(emitter, part)
  const valueType = emitter.llvm(value.type)
  const slot = fn.emitAlloca("value", valueType, emitter.align(value.type))
  const loop = fn.newBlock("json.loop")
  const room = fn.newBlock("json.room")
  const entry = fn.newBlock("json.entry")
  const fresh = fn.newBlock("json.fresh")
  const keep = fn.newBlock("json.keep")
  const duplicate = fn.newBlock("json.duplicate")
  const done = fn.newBlock("json.done")
  const open = jsonCallMethod(emitter, part.receiver, "beginObject", "%r", [])
  const empty = fn.newBlock("json.empty")
  jsonBranch(emitter, open, empty.label, done.label)
  fn.placeBlock(empty)
  jsonCallMethod(emitter, map, "clear", "%v", [])
  fn.emit(`br label %${loop.label}`)

  fn.placeBlock(loop)
  const more = jsonCallMethod(emitter, part.receiver, "nextField", "%r", [])
  jsonBranch(emitter, more, room.label, done.label)

  // The limit is asked before the key is made: a refused key costs nothing.
  fn.placeBlock(room)
  const allowed = jsonCallMethod(emitter, part.receiver, "mapRoom", "%r", [])
  jsonBranch(emitter, allowed, entry.label, loop.label)

  fn.placeBlock(entry)
  const key = jsonCallMethod(emitter, part.receiver, "key", "%r", [])
  const given = jsonCallMethod(emitter, map, "has", "%v", [`i8* ${key}`])
  jsonBranch(emitter, given, duplicate.label, fresh.label)

  fn.placeBlock(fresh)
  const place = new JsonPlace(null, "", null, slot, value.type)
  jsonStore(emitter, place, emitJsonFresh(emitter, part, value))
  emitJsonDecodeValue(emitter, part, value, place)
  // A value whose read failed is no value the input gave, and the map takes
  // nothing for it; the decoding is over, and its count of keys with it.
  jsonBranch(emitter, jsonDecoderOk(emitter, part), keep.label, loop.label)
  fn.placeBlock(keep)
  const decoded = jsonLoad(emitter, place)
  jsonCallMethod(emitter, map, "set", "%v", [`i8* ${key}`, `${valueType} ${decoded}`])
  fn.emit(`br label %${loop.label}`)

  fn.placeBlock(duplicate)
  jsonCallMethod(emitter, part.receiver, "duplicateField", "%r", [])
  fn.emit(`br label %${loop.label}`)

  fn.placeBlock(done)
  fn.emit("ret void")
}

// ---- Encoding -----------------------------------------------------------------------------

const emitJsonEncodeBody = (emitter: Emitter, part: JsonPart): void => {
  const info = jsonPartInfo(emitter, part)
  const fields = jsonFieldsOf(emitter, info)
  emitJsonStopIfFailed(emitter, part)
  jsonCallMethod(emitter, part.receiver, "beginObject", "%r", [])
  for (const f of fields) {
    const field = f.field
    if (field !== null) {
      jsonCallMethod(emitter, part.receiver, "key", "%r", [`i8* ${emitter.stringConstant(field.name)}`])
      emitJsonEncodeValue(emitter, part, f, loadField(emitter, info, "%v", field))
    }
  }
  jsonCallMethod(emitter, part.receiver, "endObject", "%r", [])
  emitter.fn.emit("ret void")
}

/**
 * Return at once when the writer has failed. An object that holds itself,
 * through a `| null` field, an array or a map, is a graph with no end, and
 * this is what ends its encoding: the writer refuses the 65th open container
 * (`JSON_WRITE_TOO_DEEP`), and the recursion stops there instead of running
 * off the stack. It is one load and a branch per object.
 */
const emitJsonStopIfFailed = (emitter: Emitter, part: JsonPart): void => {
  const fn = emitter.fn
  const failed = part.receiver.field("failed")
  if (failed === null) {
    jsonFail(emitter, `\`${part.receiver.name}\` has no \`failed\``)
    return
  }
  const code = loadField(emitter, part.receiver, "%r", failed)
  const ok = fn.emitValue(`icmp eq ${emitter.llvm(failed.type)} ${code}, 0`)
  const stop = fn.newBlock("json.stop")
  const write = fn.newBlock("json.write")
  jsonBranch(emitter, ok, write.label, stop.label)
  fn.placeBlock(stop)
  fn.emit("ret void")
  fn.placeBlock(write)
}

/** Write one value, `value`, of the shape `f`. */
const emitJsonEncodeValue = (emitter: Emitter, part: JsonPart, f: JsonField, value: string): void => {
  const fn = emitter.fn
  const valueType = emitter.llvm(f.type)
  const self = `${jsonObjectType(part.receiver)} %r`
  const helper = jsonEncodeHelper(f)
  if (helper.length > 0) {
    jsonCallSig(emitter, jsonHelper(emitter, part, helper), [self, `${valueType} ${value}`])
    return
  }
  if (f.kind === JSON_FIELD_SCALAR) {
    jsonCallMethod(emitter, part.receiver, jsonScalarMethod(f.scalar), "%r", [`${valueType} ${value}`])
    return
  }
  if (f.kind === JSON_FIELD_ENUM) {
    jsonCallMethod(emitter, part.receiver, "i32", "%r", [`i32 ${value}`])
    return
  }
  let write = ""
  if (f.kind === JSON_FIELD_CLASS) {
    write = `call void @${jsonRequestPart(emitter, PART_ENCODE, jsonValueClass(emitter, f), null, part)}(${self}, ${valueType} ${value})`
  } else if (f.kind === JSON_FIELD_MAP) {
    const callee = jsonRequestPart(
      emitter,
      PART_ENCODE_MAP,
      jsonValueMap(emitter, f),
      jsonMapValue(emitter, f),
      part
    )
    write = `call void @${callee}(${self}, ${valueType} ${value})`
  } else {
    const elem: StructInfo | null = f.kind === JSON_FIELD_CLASS_ARRAY ? jsonValueClass(emitter, f) : null
    write = `call void @${jsonRequestPart(emitter, PART_ENCODE_ARRAY, elem, f, part)}(${self}, ${valueType} ${value})`
  }
  if (!f.nullable) {
    fn.emit(write)
    return
  }
  const absent = fn.emitValue(`icmp eq ${valueType} ${value}, null`)
  const empty = fn.newBlock("json.null")
  const some = fn.newBlock("json.value")
  const join = fn.newBlock("json.written")
  jsonBranch(emitter, absent, empty.label, some.label)
  fn.placeBlock(empty)
  jsonCallMethod(emitter, part.receiver, "nullValue", "%r", [])
  fn.emit(`br label %${join.label}`)
  fn.placeBlock(some)
  fn.emit(write)
  fn.emit(`br label %${join.label}`)
  fn.placeBlock(join)
}

/** An array of objects or of enums: `[`, each element's encoding, `]`. */
const emitJsonEncodeArrayBody = (emitter: Emitter, part: JsonPart): void => {
  const fn = emitter.fn
  const info = part.info
  const counter = fn.emitAlloca("at", "i64", 8)
  fn.emit(`store i64 0, i64* ${counter}, align 8`)
  const loop = fn.newBlock("json.loop")
  const body = fn.newBlock("json.element")
  const end = fn.newBlock("json.end")
  jsonCallMethod(emitter, part.receiver, "beginArray", "%r", [])
  fn.emit(`br label %${loop.label}`)
  fn.placeBlock(loop)
  const at = fn.emitValue(`load i64, i64* ${counter}, align 8`)
  const more = fn.emitValue(`icmp ult i64 ${at}, ${loadLength(emitter, "%v")}`)
  jsonBranch(emitter, more, body.label, end.label)
  fn.placeBlock(body)
  if (info === null) {
    const f = jsonPartValue(emitter, part)
    const element = emitElementAt(emitter, "%v", f.enumType, at)
    jsonCallMethod(emitter, part.receiver, "i32", "%r", [`i32 ${element}`])
  } else {
    const element = emitElementAt(emitter, "%v", info.type, at)
    const callee = jsonRequestPart(emitter, PART_ENCODE, info, null, part)
    fn.emit(`call void @${callee}(${jsonObjectType(part.receiver)} %r, ${jsonObjectType(info)} ${element})`)
  }
  fn.emit(`store i64 ${fn.emitValue(`add i64 ${at}, 1`)}, i64* ${counter}, align 8`)
  fn.emit(`br label %${loop.label}`)
  fn.placeBlock(end)
  jsonCallMethod(emitter, part.receiver, "endArray", "%r", [])
  fn.emit("ret void")
}

/**
 * A map: `{`, then each live entry in the map's order, its key and its
 * value's encoding, then `}`. The entries are walked as a `for...of` over
 * `keys()` walks them (`walkNext`, `keyAt`, `valueAt`); nothing an encoding
 * calls changes a map, so no entry moves under the walk.
 */
const emitJsonEncodeMapBody = (emitter: Emitter, part: JsonPart): void => {
  const fn = emitter.fn
  const map = jsonPartInfo(emitter, part)
  const value = jsonPartValue(emitter, part)
  emitJsonStopIfFailed(emitter, part)
  const cursor = fn.emitAlloca("at", "i32", 4)
  const loop = fn.newBlock("json.loop")
  const body = fn.newBlock("json.entry")
  const end = fn.newBlock("json.end")
  jsonCallMethod(emitter, part.receiver, "beginObject", "%r", [])
  const first = jsonCallMethod(emitter, map, "walkNext", "%v", ["i32 0"])
  fn.emit(`store i32 ${first}, i32* ${cursor}, align 4`)
  fn.emit(`br label %${loop.label}`)
  fn.placeBlock(loop)
  const at = fn.emitValue(`load i32, i32* ${cursor}, align 4`)
  const live = fn.emitValue(`icmp sge i32 ${at}, 0`)
  jsonBranch(emitter, live, body.label, end.label)
  fn.placeBlock(body)
  const key = jsonCallMethod(emitter, map, "keyAt", "%v", [`i32 ${at}`])
  jsonCallMethod(emitter, part.receiver, "key", "%r", [`i8* ${key}`])
  emitJsonEncodeValue(emitter, part, value, jsonCallMethod(emitter, map, "valueAt", "%v", [`i32 ${at}`]))
  const after = fn.emitValue(`add i32 ${at}, 1`)
  const next = jsonCallMethod(emitter, map, "walkNext", "%v", [`i32 ${after}`])
  fn.emit(`store i32 ${next}, i32* ${cursor}, align 4`)
  fn.emit(`br label %${loop.label}`)
  fn.placeBlock(end)
  jsonCallMethod(emitter, part.receiver, "endObject", "%r", [])
  fn.emit("ret void")
}
