// Typed JSON, the emitter's half: every call of `jsonDecode` or `jsonEncode`
// from `nish/json-typed` is lowered in place, to a call of a function written
// here from the fields of the class the call binds `T` to.
//
// The functions are this module's own, `internal`, and written once per
// module for each class a call reaches, after every function of the module
// (`emitJsonParts`): a nested class, an array's element class and a `| null`
// field's class each get theirs, so the code recurses as the data does and
// the tokenizer's depth limit bounds the recursion. They have no node behind
// them, so nothing here reads a side table: the layout is the `StructInfo`
// the checker built, the fields' types are the ones it resolved, and which
// field types can be written at all was its rule (`src/json-typed.ts`), so a
// field that is none of them here is an internal error.
//
// What one class's decoding is, written out:
//
//     if (d.beginObject()) {
//       while (d.nextField()) {
//         if (d.keyIs("id")) { if (seen.id) d.duplicateField() else { seen.id = true; out.id = d.i32() } }
//         else if (d.keyIs("name")) { ... out.name = d.string(out.name) }
//         else d.unknownField()
//       }
//       if (!seen.id) d.missingField() else if (!seen.name) d.missingField()
//     }
//
// and its encoding is `w.beginObject()`, `w.key("id")` and `w.i32(v.id)` per
// field in declaration order, then `w.endObject()`. Every call into the
// decoder and the writer is a call of one of their methods, and every error is
// theirs and sticky, so this code has no error path of its own.
//
// The facts the attribute pass gives the instantiation are what this code may
// do (`markJsonRoute` in `src/attributes.ts`), and the functions themselves
// carry no attributes: LLVM infers what it can.

import { Emitter } from "./emit"
import { emitElementAt, emitEmptyArray, emitLengthOf, emitPushValue, emitShorten } from "./emit-arrays"
import { emitNewWithoutArguments, loadField, storeField, structInfoOf } from "./emit-classes"
import { privateAbi } from "./emit-result"
import { internalErrorFor } from "./ice"
import { IRFunction, IRParam } from "./ir"
import {
  JSON_FIELD_ARRAY,
  JSON_FIELD_CLASS,
  JSON_FIELD_CLASS_ARRAY,
  JSON_FIELD_SCALAR,
  JsonField,
  jsonDecodeMethod,
  jsonEncodeHelper,
  jsonFieldOf,
  jsonScalarMethod,
} from "./json-typed"
import { FunctionSig, JSON_DECODE, StructInfo, TemplateInfo } from "./program"
import { ARRAY_TYPE } from "./runtime"
import { T_STRING, T_VOID } from "./types"

/** What one written function is for. */
const PART_DECODE: i32 = 1
const PART_DECODE_ARRAY: i32 = 2
const PART_NEW: i32 = 3
const PART_ENCODE: i32 = 4
const PART_ENCODE_ARRAY: i32 = 5

/** The array header's LLVM type, as a value. */
const ARRAY_PTR: string = "%struct.nish_array*"

/** One function this module writes, queued until the module's own are emitted. */
export class JsonPart {
  kind: i32
  info: StructInfo
  /** `JsonDecoder` for a decoding, `JsonWriter` for an encoding. */
  receiver: StructInfo
  /** `nish/json-typed`'s own functions: the encoding helpers are found among them by name. */
  helpers: FunctionSig[]

  constructor(kind: i32, info: StructInfo, receiver: StructInfo, helpers: FunctionSig[]) {
    this.kind = kind
    this.info = info
    this.receiver = receiver
    this.helpers = helpers
  }
}

/** The symbol of a written function: a leading `.` no declared name can spell, as the string constants have. */
const jsonPartName = (kind: i32, info: StructInfo): string => {
  if (kind === PART_DECODE) {
    return `.json.decode.${info.name}`
  }
  if (kind === PART_DECODE_ARRAY) {
    return `.json.decode.array.${info.name}`
  }
  if (kind === PART_NEW) {
    return `.json.new.${info.name}`
  }
  return kind === PART_ENCODE ? `.json.encode.${info.name}` : `.json.encode.array.${info.name}`
}

/** The symbol of the function for `kind` and `info`, queued the first time it is asked for. */
const jsonRequestPart = (emitter: Emitter, kind: i32, info: StructInfo, from: JsonPart): string => {
  const name = jsonPartName(kind, info)
  if (emitter.jsonPartNames.add(name)) {
    emitter.jsonParts.push(new JsonPart(kind, info, from.receiver, from.helpers))
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
  for (const sig of part.helpers) {
    if (sig.sourceName === name) {
      return sig
    }
  }
  jsonFail(emitter, `\`nish/json-typed\` has no \`${name}\``)
  return part.helpers[0]
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

/** The class of a class field, or of an array's element. */
const jsonFieldClass = (emitter: Emitter, f: JsonField): StructInfo => {
  const cls = f.cls
  if (cls === null) {
    jsonFail(emitter, `\`${f.field.name}\` holds no class`)
    return structInfoOf(emitter, f.field.type)
  }
  return cls
}

/** `br i1 cond, label %yes, label %no`. */
const jsonBranch = (emitter: Emitter, cond: string, yes: string, no: string): void => {
  emitter.fn.emit(`br i1 ${cond}, label %${yes}, label %${no}`)
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
  const helpers: FunctionSig[] = []
  const home = template.home.program
  for (const fn of home.functions) {
    if (fn.instance === null && fn.definedIn(home.source)) {
      helpers.push(fn)
    }
  }
  const root = new JsonPart(0, info, receiver, helpers)
  const self = `${jsonObjectType(receiver)} ${values[0]}`
  const object = `${jsonObjectType(info)} ${values[1]}`
  if (instance.jsonRoute === JSON_DECODE) {
    emitter.fn.emit(`call void @${jsonRequestPart(emitter, PART_DECODE, info, root)}(${self}, ${object})`)
    return jsonCallMethod(emitter, receiver, "finish", values[0], [])
  }
  emitter.fn.emit(`call void @${jsonRequestPart(emitter, PART_ENCODE, info, root)}(${self}, ${object})`)
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
}

const emitJsonPart = (emitter: Emitter, part: JsonPart): IRFunction => {
  const name = jsonPartName(part.kind, part.info)
  const params: IRParam[] = []
  let ret = "void"
  if (part.kind === PART_NEW) {
    ret = jsonObjectType(part.info)
  } else {
    const object =
      part.kind === PART_DECODE_ARRAY || part.kind === PART_ENCODE_ARRAY
        ? ARRAY_PTR
        : jsonObjectType(part.info)
    params.push(new IRParam("r", jsonObjectType(part.receiver), []))
    params.push(new IRParam("v", object, []))
    if (part.kind === PART_DECODE_ARRAY) {
      ret = ARRAY_PTR
    }
  }
  emitter.fn = new IRFunction(name, params, ret)
  emitter.fn.linkage = "internal"
  if (part.kind === PART_DECODE_ARRAY || part.kind === PART_ENCODE_ARRAY) {
    emitter.declareType(ARRAY_TYPE)
  }
  if (part.kind === PART_DECODE) {
    emitJsonDecodeBody(emitter, part)
  } else if (part.kind === PART_DECODE_ARRAY) {
    emitJsonDecodeArrayBody(emitter, part)
  } else if (part.kind === PART_NEW) {
    emitter.fn.emit(`ret ${ret} ${emitNewWithoutArguments(emitter, part.info, part.info.decl)}`)
  } else if (part.kind === PART_ENCODE) {
    emitJsonEncodeBody(emitter, part)
  } else {
    emitJsonEncodeArrayBody(emitter, part)
  }
  return emitter.fn
}

// ---- Decoding -----------------------------------------------------------------------------

const emitJsonDecodeBody = (emitter: Emitter, part: JsonPart): void => {
  const fn = emitter.fn
  const fields = jsonFieldsOf(emitter, part.info)
  const seen: string[] = []
  while (seen.length < fields.length) {
    const slot = fn.emitAlloca("seen", "i1", 1)
    fn.emit(`store i1 false, i1* ${slot}, align 1`)
    seen.push(slot)
  }
  const loop = fn.newBlock("json.loop")
  const keys = fn.newBlock("json.key")
  const check = fn.newBlock("json.check")
  const duplicate = fn.newBlock("json.duplicate")
  const done = fn.newBlock("json.done")
  const open = jsonCallMethod(emitter, part.receiver, "beginObject", "%r", [])
  jsonBranch(emitter, open, loop.label, done.label)

  fn.placeBlock(loop)
  const more = jsonCallMethod(emitter, part.receiver, "nextField", "%r", [])
  jsonBranch(emitter, more, keys.label, check.label)

  fn.placeBlock(keys)
  let k = 0
  while (k < fields.length) {
    const f = fields[k]
    const key = `i8* ${emitter.stringConstant(f.field.name)}`
    const match = jsonCallMethod(emitter, part.receiver, "keyIs", "%r", [key])
    const field = fn.newBlock("json.field")
    const next = fn.newBlock("json.next")
    jsonBranch(emitter, match, field.label, next.label)
    fn.placeBlock(field)
    const given = fn.emitValue(`load i1, i1* ${seen[k]}, align 1`)
    const take = fn.newBlock("json.take")
    jsonBranch(emitter, given, duplicate.label, take.label)
    fn.placeBlock(take)
    fn.emit(`store i1 true, i1* ${seen[k]}, align 1`)
    emitJsonDecodeField(emitter, part, f)
    fn.emit(`br label %${loop.label}`)
    fn.placeBlock(next)
    k = k + 1
  }
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

/** Read one field's value from the decoder and store it into `%v`. */
const emitJsonDecodeField = (emitter: Emitter, part: JsonPart, f: JsonField): void => {
  const fn = emitter.fn
  const info = part.info
  const field = f.field
  const fieldType = emitter.llvm(field.type)
  if (f.kind === JSON_FIELD_SCALAR && f.scalar === T_STRING) {
    // A string field keeps its string when the input's is equal; a `null`
    // one is compared with `""`, which no input string it could keep is.
    let cur = loadField(emitter, info, "%v", field)
    if (f.nullable) {
      const isNull = jsonCallMethod(emitter, part.receiver, "takeNull", "%r", [])
      const empty = fn.newBlock("json.null")
      const text = fn.newBlock("json.text")
      const join = fn.newBlock("json.stored")
      jsonBranch(emitter, isNull, empty.label, text.label)
      fn.placeBlock(empty)
      storeField(emitter, info, "%v", field, "null")
      fn.emit(`br label %${join.label}`)
      fn.placeBlock(text)
      const absent = fn.emitValue(`icmp eq i8* ${cur}, null`)
      cur = fn.emitValue(`select i1 ${absent}, i8* ${emitter.stringConstant("")}, i8* ${cur}`)
      storeField(
        emitter,
        info,
        "%v",
        field,
        jsonCallMethod(emitter, part.receiver, "string", "%r", [`i8* ${cur}`])
      )
      fn.emit(`br label %${join.label}`)
      fn.placeBlock(join)
      return
    }
    storeField(
      emitter,
      info,
      "%v",
      field,
      jsonCallMethod(emitter, part.receiver, "string", "%r", [`i8* ${cur}`])
    )
    return
  }
  if (f.kind === JSON_FIELD_SCALAR) {
    storeField(
      emitter,
      info,
      "%v",
      field,
      jsonCallMethod(emitter, part.receiver, jsonScalarMethod(f.scalar), "%r", [])
    )
    return
  }
  if (f.kind === JSON_FIELD_ARRAY) {
    const cur = loadField(emitter, info, "%v", field)
    const read = jsonCallMethod(emitter, part.receiver, jsonDecodeMethod(f), "%r", [`${fieldType} ${cur}`])
    storeField(emitter, info, "%v", field, read)
    return
  }
  const cls = jsonFieldClass(emitter, f)
  if (f.kind === JSON_FIELD_CLASS && !f.nullable) {
    // Into the object the field holds, which is never `null`.
    const cur = loadField(emitter, info, "%v", field)
    fn.emit(
      `call void @${jsonRequestPart(emitter, PART_DECODE, cls, part)}(${jsonObjectType(part.receiver)} %r, ${fieldType} ${cur})`
    )
    return
  }
  if (f.kind === JSON_FIELD_CLASS_ARRAY && !f.nullable) {
    const cur = loadField(emitter, info, "%v", field)
    const callee = jsonRequestPart(emitter, PART_DECODE_ARRAY, cls, part)
    const got = fn.emitValue(
      `call ${ARRAY_PTR} @${callee}(${jsonObjectType(part.receiver)} %r, ${ARRAY_PTR} ${cur})`
    )
    storeField(emitter, info, "%v", field, got)
    return
  }
  if (f.kind !== JSON_FIELD_CLASS && f.kind !== JSON_FIELD_CLASS_ARRAY) {
    jsonFail(emitter, `\`${field.name}\` is of no kind`)
  }
  // A `| null` object or array of objects: `null`, or what the field holds
  // decoded into, made first when the field holds `null`.
  const isNull = jsonCallMethod(emitter, part.receiver, "takeNull", "%r", [])
  const empty = fn.newBlock("json.null")
  const value = fn.newBlock("json.value")
  const make = fn.newBlock("json.make")
  const into = fn.newBlock("json.into")
  const join = fn.newBlock("json.stored")
  jsonBranch(emitter, isNull, empty.label, value.label)
  fn.placeBlock(empty)
  storeField(emitter, info, "%v", field, "null")
  fn.emit(`br label %${join.label}`)
  fn.placeBlock(value)
  const cur = loadField(emitter, info, "%v", field)
  const absent = fn.emitValue(`icmp eq ${fieldType} ${cur}, null`)
  jsonBranch(emitter, absent, make.label, into.label)
  fn.placeBlock(make)
  let made = ""
  if (f.kind === JSON_FIELD_CLASS) {
    made = fn.emitValue(`call ${fieldType} @${jsonRequestPart(emitter, PART_NEW, cls, part)}()`)
  } else {
    made = emitEmptyArray(emitter)
  }
  const madeEdge = fn.currentBlock().label
  fn.emit(`br label %${into.label}`)
  fn.placeBlock(into)
  const target = fn.emitValue(`phi ${fieldType} [ ${cur}, %${value.label} ], [ ${made}, %${madeEdge} ]`)
  const self = `${jsonObjectType(part.receiver)} %r`
  if (f.kind === JSON_FIELD_CLASS) {
    fn.emit(`call void @${jsonRequestPart(emitter, PART_DECODE, cls, part)}(${self}, ${fieldType} ${target})`)
    storeField(emitter, info, "%v", field, target)
  } else {
    const callee = jsonRequestPart(emitter, PART_DECODE_ARRAY, cls, part)
    storeField(
      emitter,
      info,
      "%v",
      field,
      fn.emitValue(`call ${ARRAY_PTR} @${callee}(${self}, ${ARRAY_PTR} ${target})`)
    )
  }
  fn.emit(`br label %${join.label}`)
  fn.placeBlock(join)
}

/**
 * An array of objects, decoded into the array `%v` and answered: each element
 * into the object the array already has at its index, or into a new one
 * pushed past its end, and whatever is left over dropped.
 */
const emitJsonDecodeArrayBody = (emitter: Emitter, part: JsonPart): void => {
  const fn = emitter.fn
  const elem = part.info.type
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
  const has = fn.emitValue(`icmp ult i64 ${at}, ${emitLengthOf(emitter, "%v")}`)
  jsonBranch(emitter, has, reuse.label, grow.label)
  fn.placeBlock(reuse)
  const old = emitElementAt(emitter, "%v", elem, at)
  const reuseEdge = fn.currentBlock().label
  fn.emit(`br label %${decode.label}`)
  fn.placeBlock(grow)
  const made = fn.emitValue(
    `call ${jsonObjectType(part.info)} @${jsonRequestPart(emitter, PART_NEW, part.info, part)}()`
  )
  emitPushValue(emitter, "%v", elem, made)
  const growEdge = fn.currentBlock().label
  fn.emit(`br label %${decode.label}`)
  fn.placeBlock(decode)
  const target = fn.emitValue(
    `phi ${jsonObjectType(part.info)} [ ${old}, %${reuseEdge} ], [ ${made}, %${growEdge} ]`
  )
  const callee = jsonRequestPart(emitter, PART_DECODE, part.info, part)
  fn.emit(`call void @${callee}(${jsonObjectType(part.receiver)} %r, ${jsonObjectType(part.info)} ${target})`)
  const next = fn.emitValue(`add i64 ${at}, 1`)
  fn.emit(`store i64 ${next}, i64* ${counter}, align 8`)
  fn.emit(`br label %${loop.label}`)

  fn.placeBlock(end)
  const count = fn.emitValue(`load i64, i64* ${counter}, align 8`)
  const over = fn.emitValue(`icmp ult i64 ${count}, ${emitLengthOf(emitter, "%v")}`)
  jsonBranch(emitter, over, cut.label, done.label)
  fn.placeBlock(cut)
  emitShorten(emitter, "%v", count)
  fn.emit(`br label %${done.label}`)

  fn.placeBlock(done)
  fn.emit(`ret ${ARRAY_PTR} %v`)
}

// ---- Encoding -----------------------------------------------------------------------------

const emitJsonEncodeBody = (emitter: Emitter, part: JsonPart): void => {
  const fields = jsonFieldsOf(emitter, part.info)
  emitJsonStopIfFailed(emitter, part)
  jsonCallMethod(emitter, part.receiver, "beginObject", "%r", [])
  for (const f of fields) {
    jsonCallMethod(emitter, part.receiver, "key", "%r", [`i8* ${emitter.stringConstant(f.field.name)}`])
    emitJsonEncodeField(emitter, part, f)
  }
  jsonCallMethod(emitter, part.receiver, "endObject", "%r", [])
  emitter.fn.emit("ret void")
}

/**
 * Return at once when the writer has failed. An object that holds itself,
 * through a `| null` field or an array, is a graph with no end, and this is
 * what ends its encoding: the writer refuses the 65th open container
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

/** Write one field's value. */
const emitJsonEncodeField = (emitter: Emitter, part: JsonPart, f: JsonField): void => {
  const fn = emitter.fn
  const field = f.field
  const fieldType = emitter.llvm(field.type)
  const value = loadField(emitter, part.info, "%v", field)
  const self = `${jsonObjectType(part.receiver)} %r`
  const helper = jsonEncodeHelper(f)
  if (helper.length > 0) {
    jsonCallSig(emitter, jsonHelper(emitter, part, helper), [self, `${fieldType} ${value}`])
    return
  }
  if (f.kind === JSON_FIELD_SCALAR) {
    jsonCallMethod(emitter, part.receiver, jsonScalarMethod(f.scalar), "%r", [`${fieldType} ${value}`])
    return
  }
  const cls = jsonFieldClass(emitter, f)
  const kind = f.kind === JSON_FIELD_CLASS ? PART_ENCODE : PART_ENCODE_ARRAY
  const write = `call void @${jsonRequestPart(emitter, kind, cls, part)}(${self}, ${fieldType} ${value})`
  if (!f.nullable) {
    fn.emit(write)
    return
  }
  const absent = fn.emitValue(`icmp eq ${fieldType} ${value}, null`)
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

/** An array of objects: `[`, each element's encoding, `]`. */
const emitJsonEncodeArrayBody = (emitter: Emitter, part: JsonPart): void => {
  const fn = emitter.fn
  const counter = fn.emitAlloca("at", "i64", 8)
  fn.emit(`store i64 0, i64* ${counter}, align 8`)
  const loop = fn.newBlock("json.loop")
  const body = fn.newBlock("json.element")
  const end = fn.newBlock("json.end")
  jsonCallMethod(emitter, part.receiver, "beginArray", "%r", [])
  fn.emit(`br label %${loop.label}`)
  fn.placeBlock(loop)
  const at = fn.emitValue(`load i64, i64* ${counter}, align 8`)
  const more = fn.emitValue(`icmp ult i64 ${at}, ${emitLengthOf(emitter, "%v")}`)
  jsonBranch(emitter, more, body.label, end.label)
  fn.placeBlock(body)
  const element = emitElementAt(emitter, "%v", part.info.type, at)
  const callee = jsonRequestPart(emitter, PART_ENCODE, part.info, part)
  fn.emit(
    `call void @${callee}(${jsonObjectType(part.receiver)} %r, ${jsonObjectType(part.info)} ${element})`
  )
  fn.emit(`store i64 ${fn.emitValue(`add i64 ${at}, 1`)}, i64* ${counter}, align 8`)
  fn.emit(`br label %${loop.label}`)
  fn.placeBlock(end)
  jsonCallMethod(emitter, part.receiver, "endArray", "%r", [])
  fn.emit("ret void")
}
