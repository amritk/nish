// Root storage on a page module (docs/wp55-persistent-root.md §4): what the
// runtime needs to keep the graph a root reaches between export calls.
//
// A page module's loader releases the arena after every export call
// (docs/wp50-wasm-host.md §6). For a program with root storage it calls
// `nish_root_keep(mark)` instead, and the runtime (`nish_runtime_root_keep`,
// runtime/runtime-wasm.c) traces from every root slot and slides what they
// reach down over what they do not. To trace, it needs every type the roots
// can reach described as data: a **trace descriptor** per type,
//
//   %nish.trace = type { i32 kind, i32 size, i32 count, i32* at, i8** to }
//
// | kind       | size                | count, at, to                                  |
// | ---------- | ------------------- | ---------------------------------------------- |
// | 0 struct   | `sizeof` the struct | its pointer fields: offsets, their descriptors |
// | 1 string   | 0                   | none                                           |
// | 2 array    | one slot's stride   | 0 pointer-free, 1 pointer slots, 2 records in place; `to[0]` the element's |
// | 3 union    | 0                   | its variants: tags, their struct descriptors   |
//
// Sizes and offsets are `ptrtoint` of a `getelementptr` from `null`, so the
// IR describes whatever target it is compiled for: an `--emit-dts` build
// writes host IR that clang compiles for wasm32.
//
// Each root storage gets a table, `@<symbol>.root = { i8* slots, i32 count,
// i8* descriptor }`, and the module that declares the program's first root
// storage writes `nish_root_keep`, which hands every table to the runtime.

import { Emitter } from "./emit"
import { internalErrorFor } from "./ice"
import { ConstInfo, StructInfo, elementLLVMType, inlineElementStruct } from "./program"
import { T_STRING } from "./types"

const TRACE_TYPE: string = "%nish.trace = type { i32, i32, i32, i32*, i8** }"
const ROOT_TYPE: string = "%nish.root = type { i8*, i32, i8* }"

const KIND_STRUCT: i32 = 0
const KIND_STRING: i32 = 1
const KIND_ARRAY: i32 = 2
const KIND_UNION: i32 = 3

/** An array's elements: no pointers, a pointer each, or records held in place. */
const ELEMS_PLAIN: i32 = 0
const ELEMS_POINTER: i32 = 1
const ELEMS_INLINE: i32 = 2

/** The descriptors one module has written, by the type each describes. */
export class RootTraces {
  types: i32[]
  inline: boolean[]
  names: string[]

  constructor() {
    this.types = []
    this.inline = []
    this.names = []
  }
}

/** `sizeof(T)` for the LLVM type `ty`, as a constant on any target. */
const sizeOf = (ty: string): string =>
  `i32 ptrtoint (${ty}* getelementptr (${ty}, ${ty}* null, i32 1) to i32)`

const traceFail = (emitter: Emitter, message: string): void => {
  process.exit(internalErrorFor(`emitter: root storage: ${message}`, emitter.opts.json))
}

/** Whether a value of `type` is a pointer the tracer follows: a string, an array, a union or an object. */
const holdsPointer = (emitter: Emitter, type: i32): boolean => {
  const table = emitter.table
  const t = table.isNullable(type) ? table.stripNull(type) : type
  return t === T_STRING || table.isArray(t) || table.isUnion(t) || table.isStruct(t)
}

/** The struct `type` names, from the module's scope. */
const rootStructOf = (emitter: Emitter, type: i32): StructInfo => {
  const info = emitter.program.struct(emitter.table.nameOf(type))
  if (info !== null) {
    return info
  }
  process.exit(
    internalErrorFor(
      `emitter: root storage: unknown struct \`${emitter.table.typeName(type)}\``,
      emitter.opts.json
    )
  )
}

/**
 * Every struct a root of this module can reach, so `structTypeDeclarations`
 * gives each a body: a descriptor measures it, which an opaque type cannot be.
 */
export const rootClosureStructs = (emitter: Emitter): StructInfo[] => {
  const out: StructInfo[] = []
  const seen: boolean[] = []
  for (const info of emitter.program.constantList) {
    if (info.root && info.origin === emitter.program.source && emitter.opts.rootSymbols.length > 0) {
      noteClosure(emitter, out, seen, info.storageElem)
    }
  }
  return out
}

const noteClosure = (emitter: Emitter, out: StructInfo[], seen: boolean[], type: i32): void => {
  const table = emitter.table
  if (type < 0) {
    return
  }
  while (seen.length <= type) {
    seen.push(false)
  }
  if (seen[type]) {
    return
  }
  seen[type] = true
  if (table.isNullable(type)) {
    noteClosure(emitter, out, seen, table.stripNull(type))
  } else if (table.isArray(type)) {
    noteClosure(emitter, out, seen, table.refOf(type))
  } else if (table.isUnion(type)) {
    for (const variant of table.variantsOf(type)) {
      noteClosure(emitter, out, seen, variant)
    }
  } else if (table.isStruct(type)) {
    const info = rootStructOf(emitter, type)
    out.push(info)
    for (const field of info.fields) {
      noteClosure(emitter, out, seen, field.type)
    }
  }
}

/**
 * The descriptor of `type` (`null` already stripped), as an `i8*` constant:
 * written on first use and named `@nish.trace.N`, the name recorded before the
 * body is written so a class that reaches itself refers back to it.
 * `inline` asks for a record held in place, which only an array's element is.
 */
const traceOf = (emitter: Emitter, traces: RootTraces, type: i32, inline: boolean): string => {
  let k = 0
  while (k < traces.types.length) {
    if (traces.types[k] === type && traces.inline[k] === inline) {
      return `i8* bitcast (%nish.trace* ${traces.names[k]} to i8*)`
    }
    k = k + 1
  }
  const name = `@nish.trace.${traces.names.length}`
  traces.types.push(type)
  traces.inline.push(inline)
  traces.names.push(name)
  writeTrace(emitter, traces, type, name)
  return `i8* bitcast (%nish.trace* ${name} to i8*)`
}

/** The `i32* at` and `i8** to` of a descriptor with `count` entries. */
const traceArrays = (emitter: Emitter, name: string, at: string[], to: string[]): string => {
  const n = to.length
  if (n === 0) {
    return "i32* null, i8** null"
  }
  let atRef = "i32* null"
  if (at.length > 0) {
    emitter.declareGlobal(`${name}.at = internal constant [${n} x i32] [${at.join(", ")}]`)
    atRef = `i32* getelementptr inbounds ([${n} x i32], [${n} x i32]* ${name}.at, i32 0, i32 0)`
  }
  emitter.declareGlobal(`${name}.to = internal constant [${n} x i8*] [${to.join(", ")}]`)
  return `${atRef}, i8** getelementptr inbounds ([${n} x i8*], [${n} x i8*]* ${name}.to, i32 0, i32 0)`
}

const writeTrace = (emitter: Emitter, traces: RootTraces, type: i32, name: string): void => {
  const table = emitter.table
  let kind = KIND_STRING
  let size = "i32 0"
  let count = 0
  const at: string[] = []
  const to: string[] = []
  if (table.isArray(type)) {
    kind = KIND_ARRAY
    const elem = table.refOf(type)
    size = sizeOf(elementLLVMType(emitter.program, emitter.table, elem))
    const record = inlineElementStruct(emitter.program, emitter.table, elem)
    if (record !== null) {
      count = ELEMS_INLINE
      to.push(traceOf(emitter, traces, elem, true))
    } else if (holdsPointer(emitter, elem)) {
      count = ELEMS_POINTER
      to.push(traceOf(emitter, traces, table.stripNull(elem), false))
    } else {
      count = ELEMS_PLAIN
    }
  } else if (table.isUnion(type)) {
    kind = KIND_UNION
    const variants = table.variantsOf(type)
    const tags = table.tagsOf(type)
    let k = 0
    while (k < variants.length && k < tags.length) {
      const variant = variants[k]
      const tag = tags[k]
      at.push(`i32 ${table.memberValue(tag)}`)
      to.push(traceOf(emitter, traces, variant, false))
      k = k + 1
    }
    count = variants.length
  } else if (table.isStruct(type)) {
    kind = KIND_STRUCT
    const info = rootStructOf(emitter, type)
    const ty = `%struct.${info.name}`
    size = sizeOf(ty)
    for (const field of info.fields) {
      if (field.boxed || field.nested !== null || field.inline()) {
        traceFail(emitter, `field \`${info.name}.${field.name}\` is not laid out as a pointer`)
      }
      if (holdsPointer(emitter, field.type)) {
        const fieldTy = emitter.llvm(field.type)
        at.push(
          `i32 ptrtoint (${fieldTy}* getelementptr (${ty}, ${ty}* null, i32 0, i32 ${field.index}) to i32)`
        )
        to.push(traceOf(emitter, traces, table.stripNull(field.type), false))
      }
    }
    count = to.length
  } else if (type !== T_STRING) {
    traceFail(emitter, `\`${table.typeName(type)}\` has no trace`)
  }
  emitter.declareType(TRACE_TYPE)
  const arrays = traceArrays(emitter, name, at, to)
  emitter.declareGlobal(
    `${name} = internal constant %nish.trace { i32 ${kind}, ${size}, i32 ${count}, ${arrays} }`
  )
}

/**
 * The root table of root storage `info`: its slots, how many, and the
 * descriptor of the class each slot holds. External, so the module that
 * writes `nish_root_keep` can name it.
 */
export const rootTable = (emitter: Emitter, traces: RootTraces, info: ConstInfo, data: string): void => {
  const desc = traceOf(emitter, traces, emitter.table.stripNull(info.storageElem), false)
  emitter.declareType(ROOT_TYPE)
  emitter.declareGlobal(
    `@${info.storageSymbol}.root = constant %nish.root { i8* bitcast (${data}* @${info.storageSymbol}.data to i8*), i32 ${info.intValue}, ${desc} }`
  )
  const symbols = emitter.opts.rootSymbols
  if (symbols.length === 0 || symbols[0] !== info.storageSymbol) {
    return
  }
  // The first root's module hands every table to the runtime.
  const refs: string[] = []
  for (const symbol of symbols) {
    if (symbol !== info.storageSymbol) {
      emitter.declareGlobal(`@${symbol}.root = external constant %nish.root`)
    }
    refs.push(`%nish.root* @${symbol}.root`)
  }
  const n = symbols.length
  emitter.declareGlobal(`@nish.roots = internal constant [${n} x %nish.root*] [${refs.join(", ")}]`)
  const keep = emitter.useRuntime("nish_runtime_root_keep")
  emitter.module.addRawDefinition(`define void @nish_root_keep(i64 %mark) {
  call void ${keep}(i64 %mark, i8* bitcast ([${n} x %nish.root*]* @nish.roots to i8*), i32 ${n})
  ret void
}`)
}
