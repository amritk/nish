// Typed JSON: which calls of `nish/json-typed` the compiler writes the code
// for, which classes it can write it for, and what that code calls.
//
// `jsonDecode<T>(d, out)` and `jsonEncode<T>(w, value)` are generic templates
// in `std/json-typed.ts` whose bodies are what Node runs. Natively every call
// is lowered in place, in the module that makes it, to code written from the
// fields of the class `T` is bound to (`src/emit-json.ts`). This module is the
// checker's half and the half the attribute pass shares:
//
//   - `jsonRouteRole` marks the two templates' instantiations, as
//     `mapIntrinsicRole` marks `nish/map`'s; an instantiation is never
//     defined or declared anywhere, because no call reaches it;
//   - `jsonRefusal` is the rule a call is checked against, over every class
//     the route reaches: `T` itself, a nested class, an array's element and a
//     `| null` field's class alike, so the rule covers each way in;
//   - `noteJsonOptions` and `checkJsonOptions` read a class's
//     `static readonly json = { rename: { ... }, optional: [ ... ] }` once its
//     fields are collected, and write what it says into each field
//     (`FieldInfo.wireName`, `jsonOptional`), which is all the emitter reads;
//   - `jsonRouteCallees` is everything the written code calls, which the
//     attribute pass counts as the instance's callees (`markJsonRoute`) and
//     the checker declares in the calling module (`noteJsonRoute` in
//     `src/generics.ts`).
//
// docs/LANGUAGE.md, "Typed JSON", is the rule in prose.

import {
  CheckedProgram,
  FieldInfo,
  FunctionSig,
  JSON_DECODE,
  JSON_ENCODE,
  JSON_NONE,
  STRUCT_CLASS,
  StructInfo,
  StructInstantiation,
  TemplateInfo,
} from "./program"
import { StringSet } from "./map"
import { CheckContext } from "./context"
import {
  FLAG_COMPUTED,
  FLAG_READONLY,
  N_ARRAY,
  N_EMPTY,
  N_FALSE,
  N_NULL,
  N_NUMBER,
  N_OBJECT,
  N_PROPERTY,
  N_STRING,
  N_TEMPLATE,
  N_TRUE,
  N_UNARY,
  Node,
} from "./nodes"
import { T_BOOL, T_F64, T_I32, T_I64, T_STRING, T_U32, T_U64, TypeTable } from "./types"

/** A value that is one scalar: an integer, an `f64`, a `boolean` or a `string`. */
export const JSON_FIELD_SCALAR: i32 = 1
/** An object of a class. */
export const JSON_FIELD_CLASS: i32 = 2
/** An array of scalars or strings. */
export const JSON_FIELD_ARRAY: i32 = 3
/** An array of objects of a class. */
export const JSON_FIELD_CLASS_ARRAY: i32 = 4
/** A value of a numeric `enum`: its number, and only a member's. */
export const JSON_FIELD_ENUM: i32 = 5
/** An array of values of a numeric `enum`. */
export const JSON_FIELD_ENUM_ARRAY: i32 = 6
/** A `Map<string, V>`: a JSON object whose keys are the map's and whose values are each a `V`. */
export const JSON_FIELD_MAP: i32 = 7

/**
 * One value as the written code reads and writes it: a field of a class, or
 * the value type of a `Map` field, which has no field of its own.
 */
export class JsonField {
  /** The field, or `null` for a `Map`'s value. */
  field: FieldInfo | null
  /** The value's type, `| null` included. */
  type: i32
  /** One of the `JSON_FIELD_*` kinds. */
  kind: i32
  /** Whether the type is `| null`. */
  nullable: boolean
  /** The scalar type of a scalar or of an array's element; `0` otherwise. */
  scalar: i32
  /** The class of an object or of an array's element; `null` otherwise. */
  cls: StructInfo | null
  /** The enum of an enum value or of an array's element; `0` otherwise. */
  enumType: i32
  /** The `Map` instance of a map value; `null` otherwise. */
  map: StructInfo | null
  /** What a map holds; `null` for every other kind. */
  value: JsonField | null

  constructor(field: FieldInfo | null, type: i32, kind: i32, nullable: boolean) {
    this.field = field
    this.type = type
    this.kind = kind
    this.nullable = nullable
    this.scalar = 0
    this.cls = null
    this.enumType = 0
    this.map = null
    this.value = null
  }
}

// ---- The class's options ------------------------------------------------------------------

/** The name of the `static readonly` member that holds a class's typed JSON options. */
export const JSON_OPTIONS: string = "json"

/**
 * The class's `static readonly json`, kept for `checkJsonOptions`, which
 * reads it once every field is collected. It is not a field and has no slot:
 * the class's layout is what it would be without it.
 */
export const noteJsonOptions = (ctx: CheckContext, owner: StructInfo, decl: Node): void => {
  if (owner.jsonOptions !== null) {
    ctx.error(decl.children[0], `Duplicate member \`${JSON_OPTIONS}\` in class \`${owner.name}\``)
    return
  }
  owner.jsonOptions = decl
}

/** A string written as a literal: `"a"`, or a template with no holes. */
const jsonIsStringLiteral = (node: Node): boolean =>
  node.kind === N_STRING || (node.kind === N_TEMPLATE && node.children.length <= 1)

/** The text of a string literal `jsonIsStringLiteral` accepted. */
const jsonStringLiteral = (node: Node): string => {
  if (node.kind === N_STRING) {
    return node.text
  }
  return node.children.length > 0 ? node.children[0].text : ""
}

/** Any other literal: a number, `true`, `false`, `null`, an object or an array. */
const jsonIsOtherLiteral = (node: Node): boolean =>
  node.kind === N_NUMBER ||
  node.kind === N_TRUE ||
  node.kind === N_FALSE ||
  node.kind === N_NULL ||
  node.kind === N_OBJECT ||
  node.kind === N_ARRAY ||
  (node.kind === N_UNARY && node.children.length > 0 && node.children[0].kind === N_NUMBER)

/** `where` in the class's options is not written as the literal it must be. */
const jsonNotLiteral = (ctx: CheckContext, info: StructInfo, node: Node, where: string): void => {
  // The words after `where` are NL2493's in `src/codes.ts`.
  ctx.error(
    node,
    `\`${info.name}.${JSON_OPTIONS}\`${where} is not written as a literal: typed JSON reads a class's options from its text when it writes the class's code, ` +
      "so `json` is an object literal, `rename` an object literal of string literals and `optional` an array literal of string literals"
  )
}

/** The field `name` of `info` that an option names, or `null`, reported as not one of its fields. */
const jsonOptionField = (
  ctx: CheckContext,
  info: StructInfo,
  node: Node,
  option: string,
  name: string
): FieldInfo | null => {
  const field = info.field(name)
  if (field === null) {
    // The words after the class's name are NL2495's.
    ctx.error(
      node,
      `\`${info.name}.${JSON_OPTIONS}\` names \`${name}\` in \`${option}\`, which is not a field of \`${info.name}\`: ` +
        "an option names one of the class's own fields, spelled as it is declared"
    )
  }
  return field
}

/** Two options name one field, or two fields would share a key: NL2497's words after the detail. */
const jsonDuplicate = (ctx: CheckContext, info: StructInfo, node: Node, detail: string): void => {
  ctx.error(
    node,
    `\`${info.name}.${JSON_OPTIONS}\` ${detail}: each field is renamed and made optional at most once, ` +
      "and no two fields share a key on the wire"
  )
}

/** `rename: { field: "key", ... }`: each field's key on the wire. */
const jsonReadRename = (ctx: CheckContext, info: StructInfo, value: Node): void => {
  if (value.kind !== N_OBJECT) {
    jsonNotLiteral(ctx, info, value, "'s `rename`")
    return
  }
  const renamed = new StringSet()
  for (const prop of value.children) {
    if (ctx.errored) {
      return
    }
    // A spread and a computed key were refused by Phase 0 (NL1061, NL1041).
    if (prop.kind !== N_PROPERTY || (prop.flags & FLAG_COMPUTED) !== 0 || prop.children.length === 0) {
      continue
    }
    const to = prop.children[0]
    const field = jsonOptionField(ctx, info, prop, "rename", prop.text)
    if (field === null) {
      return
    }
    if (!renamed.add(field.name)) {
      jsonDuplicate(ctx, info, prop, `renames \`${field.name}\` twice`)
      return
    }
    if (jsonIsStringLiteral(to)) {
      field.wireName = jsonStringLiteral(to)
    } else if (jsonIsOtherLiteral(to)) {
      // The words after the field's name are NL2496's.
      ctx.error(
        to,
        `\`${info.name}.${JSON_OPTIONS}\` renames \`${field.name}\` to a value that is not a string: ` +
          "a field's key on the wire is a string literal"
      )
    } else {
      jsonNotLiteral(ctx, info, to, `'s \`rename.${field.name}\``)
    }
  }
}

/** `optional: ["field", ...]`: the fields a missing key sets to their initializer. */
const jsonReadOptional = (ctx: CheckContext, info: StructInfo, value: Node): void => {
  if (value.kind !== N_ARRAY) {
    jsonNotLiteral(ctx, info, value, "'s `optional`")
    return
  }
  for (const element of value.children) {
    if (ctx.errored) {
      return
    }
    if (!jsonIsStringLiteral(element)) {
      jsonNotLiteral(ctx, info, element, "'s `optional`")
      return
    }
    const field = jsonOptionField(ctx, info, element, "optional", jsonStringLiteral(element))
    if (field === null) {
      return
    }
    if (field.jsonOptional) {
      jsonDuplicate(ctx, info, element, `makes \`${field.name}\` optional twice`)
      return
    }
    if (field.initializer === null) {
      // The words after the field's name are NL2498's.
      ctx.error(
        element,
        `\`${info.name}.${JSON_OPTIONS}\` makes \`${field.name}\` optional, and the field has no initializer: ` +
          "a missing optional key sets its field to the field's initializer, so an optional field declares one"
      )
      return
    }
    field.jsonOptional = true
  }
}

/**
 * Read the class's `static readonly json`, now that its fields are known, and
 * write what it says into them: a renamed field's `wireName`, and an optional
 * field's `jsonOptional`. Every misuse is refused here, with the class, so a
 * class that no call decodes is held to the same rule as one that is.
 * `nish/json-typed`'s own `JsonNumber` is marked here too.
 */
export const checkJsonOptions = (ctx: CheckContext, info: StructInfo): void => {
  if (info.kind === STRUCT_CLASS && info.name === "JsonNumber" && ctx.program.isJsonTyped()) {
    info.jsonNumber = true
  }
  const decl = info.jsonOptions
  if (decl === null || ctx.errored) {
    return
  }
  if ((decl.flags & FLAG_READONLY) === 0 || decl.children[1].kind !== N_EMPTY || info.instance !== null) {
    // The words after the class's name are NL2492's.
    ctx.error(
      decl,
      `\`static\` member \`${JSON_OPTIONS}\` of class \`${ctx.table.typeName(info.type)}\` is written \`static readonly json = { ... }\`, ` +
        "with no type annotation, in a class that is not generic: it holds the class's typed JSON options and is not a field"
    )
    return
  }
  const literal = decl.children[2]
  if (literal.kind !== N_OBJECT) {
    jsonNotLiteral(ctx, info, literal.kind === N_EMPTY ? decl : literal, "")
    return
  }
  const given = new StringSet()
  for (const prop of literal.children) {
    if (ctx.errored) {
      return
    }
    if (prop.kind !== N_PROPERTY || (prop.flags & FLAG_COMPUTED) !== 0 || prop.children.length === 0) {
      continue
    }
    const option = prop.text
    if (option !== "rename" && option !== "optional") {
      // The words after the option's name are NL2494's.
      ctx.error(
        prop,
        `\`${info.name}.${JSON_OPTIONS}\` has no option \`${option}\`: typed JSON's options are \`rename\` and \`optional\``
      )
      return
    }
    if (!given.add(option)) {
      jsonDuplicate(ctx, info, prop, `gives \`${option}\` twice`)
      return
    }
    if (option === "rename") {
      jsonReadRename(ctx, info, prop.children[0])
    } else {
      jsonReadOptional(ctx, info, prop.children[0])
    }
  }
  if (ctx.errored) {
    return
  }
  // A key names one field: no two fields' keys may be equal, a renamed one's
  // and another's own name included.
  const keys = new StringSet()
  for (const field of info.fields) {
    if (!keys.add(field.wireName)) {
      let other = ""
      for (const f of info.fields) {
        if (other.length === 0 && f !== field && f.wireName === field.wireName) {
          other = f.name
        }
      }
      jsonDuplicate(
        ctx,
        info,
        decl,
        `gives \`${other}\` and \`${field.name}\` one key, \`${field.wireName}\``
      )
      return
    }
  }
}

/** The `JSON_*` role of an instantiation of `template`. */
export const jsonRouteRole = (template: TemplateInfo): i32 => {
  if (template.owner !== null || !template.home.program.isJsonTyped()) {
    return JSON_NONE
  }
  if (template.sourceName === "jsonDecode") {
    return JSON_DECODE
  }
  return template.sourceName === "jsonEncode" ? JSON_ENCODE : JSON_NONE
}

/** The `JSON_*` role of `sig`, `JSON_NONE` for anything but an instantiation of the two. */
export const jsonRouteOf = (sig: FunctionSig | null): i32 => {
  if (sig === null) {
    return JSON_NONE
  }
  const instance = sig.instance
  return instance === null ? JSON_NONE : instance.jsonRoute
}

/** The type a value of the field is read as, when it is one: `i32`, `u32`, `i64`, `u64`, `f64`, `boolean` or `string`. */
const jsonScalar = (type: i32): i32 => {
  if (
    type === T_I32 ||
    type === T_U32 ||
    type === T_I64 ||
    type === T_U64 ||
    type === T_F64 ||
    type === T_BOOL ||
    type === T_STRING
  ) {
    return type
  }
  return 0
}

/** The class `type` is, when it is one the route can read and write: declared, not generic. */
export const jsonClassOf = (program: CheckedProgram, table: TypeTable, type: i32): StructInfo | null => {
  if (!table.isStruct(type)) {
    return null
  }
  const info = program.struct(table.nameOf(type))
  if (info === null || info.kind !== STRUCT_CLASS || info.instance !== null) {
    return null
  }
  return info
}

/**
 * The instance of the global `Map` that `type` is, when its keys are
 * `string`s, the keys a JSON object has; `null` for any other type, a `Map`
 * with other keys and a `Set` included.
 */
const jsonMapOf = (program: CheckedProgram, table: TypeTable, type: i32): StructInfo | null => {
  if (!table.isStruct(type)) {
    return null
  }
  const info = program.struct(table.nameOf(type))
  const instance: StructInstantiation | null = info === null ? null : info.instance
  if (
    info === null ||
    instance === null ||
    instance.template.sourceName !== "Map" ||
    !instance.template.home.program.isCollections() ||
    instance.typeArgs.length !== 2 ||
    instance.typeArgs[0] !== T_STRING
  ) {
    return null
  }
  return info
}

/** A value of `type` as the route reads and writes it, held in `field` (`null` for a `Map`'s value), or `null` when it cannot. */
const jsonValueOf = (
  program: CheckedProgram,
  table: TypeTable,
  field: FieldInfo | null,
  type: i32
): JsonField | null => {
  const nullable = table.isNullable(type)
  const base = table.stripNull(type)
  const scalar = jsonScalar(base)
  if (scalar !== 0) {
    // Of these only a `string` can be `| null`: a number has no `null` to hold.
    const f = new JsonField(field, type, JSON_FIELD_SCALAR, nullable)
    f.scalar = scalar
    return f
  }
  if (table.isEnum(base)) {
    if (nullable) {
      return null
    }
    const f = new JsonField(field, type, JSON_FIELD_ENUM, nullable)
    f.enumType = base
    return f
  }
  if (table.isArray(base)) {
    if (table.isReadonlyArray(base)) {
      return null
    }
    const elem = table.refOf(base)
    const inner = jsonScalar(elem)
    if (inner !== 0) {
      const f = new JsonField(field, type, JSON_FIELD_ARRAY, nullable)
      f.scalar = inner
      return f
    }
    if (table.isEnum(elem)) {
      const f = new JsonField(field, type, JSON_FIELD_ENUM_ARRAY, nullable)
      f.enumType = elem
      return f
    }
    const cls = jsonClassOf(program, table, elem)
    if (cls === null) {
      return null
    }
    const f = new JsonField(field, type, JSON_FIELD_CLASS_ARRAY, nullable)
    f.cls = cls
    return f
  }
  const map = jsonMapOf(program, table, base)
  if (map !== null) {
    const instance = map.instance
    const held: JsonField | null =
      instance === null ? null : jsonValueOf(program, table, null, instance.typeArgs[1])
    if (held === null) {
      return null
    }
    const f = new JsonField(field, type, JSON_FIELD_MAP, nullable)
    f.map = map
    f.value = held
    return f
  }
  const cls = jsonClassOf(program, table, base)
  if (cls === null) {
    return null
  }
  const f = new JsonField(field, type, JSON_FIELD_CLASS, nullable)
  f.cls = cls
  return f
}

/** `field` as the route reads and writes it, or `null` when its type is not one it can. */
export const jsonFieldOf = (program: CheckedProgram, table: TypeTable, field: FieldInfo): JsonField | null =>
  jsonValueOf(program, table, field, field.type)

/** `f` and, for a map, what it holds, and what that holds in turn: every value one field reaches. */
const jsonValuesOf = (f: JsonField, out: JsonField[]): void => {
  let at: JsonField | null = f
  while (at !== null) {
    out.push(at)
    at = at.value
  }
}

/**
 * The fields of `info` the route reads and writes one by one: every field,
 * but none of `JsonNumber`'s, which is read and written whole, as the number
 * it holds.
 */
const jsonFieldsRead = (info: StructInfo): FieldInfo[] => {
  const none: FieldInfo[] = []
  return info.jsonNumber ? none : info.fields
}

/**
 * Every class a route from `root` reaches, `root` first and each once, in the
 * order the fields name them, through arrays and `Map` values alike. A field
 * the route cannot handle reaches nothing; `jsonRefusal` has refused it.
 */
export const jsonClasses = (program: CheckedProgram, table: TypeTable, root: StructInfo): StructInfo[] => {
  const out: StructInfo[] = []
  const seen = new StringSet()
  seen.add(root.name)
  out.push(root)
  let at = 0
  while (at < out.length) {
    const info = out[at]
    at = at + 1
    for (const field of jsonFieldsRead(info)) {
      const f = jsonFieldOf(program, table, field)
      if (f === null) {
        continue
      }
      const values: JsonField[] = []
      jsonValuesOf(f, values)
      for (const v of values) {
        const cls = v.cls
        if (cls !== null && seen.add(cls.name)) {
          out.push(cls)
        }
      }
    }
  }
  return out
}

/** Every value a route from `root` reads or writes: each field of each class it reaches, and what each `Map` holds. */
const jsonValues = (program: CheckedProgram, table: TypeTable, root: StructInfo): JsonField[] => {
  const out: JsonField[] = []
  for (const info of jsonClasses(program, table, root)) {
    for (const field of jsonFieldsRead(info)) {
      const f = jsonFieldOf(program, table, field)
      if (f !== null) {
        jsonValuesOf(f, out)
      }
    }
  }
  return out
}

/**
 * Whether a decoding makes the object or the map `f` holds itself, with
 * `new`, rather than decoding into the one it finds: a `| null` field's, which
 * it makes when the field holds `null`, and a `Map`'s value, which is new for
 * each key. An array's elements past its end are made too; `jsonMadeClasses`
 * counts those.
 */
const jsonMakes = (f: JsonField): boolean => f.nullable || f.field === null

/**
 * The classes of a decode from `root` that the decoder makes itself, with
 * `new C()`: each class an array of objects holds, which it makes past the
 * array's end, and each class a `| null` field or a `Map` holds. One pass
 * over the values `jsonValues` reaches.
 */
const jsonMadeClasses = (program: CheckedProgram, table: TypeTable, root: StructInfo): StructInfo[] => {
  const out: StructInfo[] = []
  const made = new StringSet()
  for (const f of jsonValues(program, table, root)) {
    const cls = f.cls
    if (cls !== null && (f.kind === JSON_FIELD_CLASS_ARRAY || jsonMakes(f)) && made.add(cls.name)) {
      out.push(cls)
    }
  }
  return out
}

/** Every `Map` a route from `root` reaches, each once; `madeOnly` keeps the ones the decoder makes with `new`. */
const jsonMaps = (
  program: CheckedProgram,
  table: TypeTable,
  root: StructInfo,
  madeOnly: boolean
): StructInfo[] => {
  const out: StructInfo[] = []
  const seen = new StringSet()
  for (const f of jsonValues(program, table, root)) {
    const map = f.map
    if (map !== null && (!madeOnly || jsonMakes(f)) && seen.add(map.name)) {
      out.push(map)
    }
  }
  return out
}

/**
 * Why a call of the route `name` (`jsonDecode` or `jsonEncode`) cannot bind
 * its value to `type`, or `""` when it can. Every class the route reaches is
 * held to the same rule, so a nested class, an array's element, a `Map`'s
 * value and a `| null` field's class are refused exactly as `T` is.
 */
export const jsonRefusal = (
  program: CheckedProgram,
  table: TypeTable,
  name: string,
  role: i32,
  type: i32
): string => {
  const root = jsonClassOf(program, table, type)
  if (root === null) {
    return (
      `\`${name}\`'s value is \`${table.typeName(type)}\`, which is not a class: ` +
      "typed JSON reads and writes an object through the fields of a declared class, and an interface, a generic class or any other type is not one in this version"
    )
  }
  const classes = jsonClasses(program, table, root)
  for (const info of classes) {
    for (const field of jsonFieldsRead(info)) {
      if (jsonFieldOf(program, table, field) === null) {
        // The words up to `| null` are NL2485's in `src/codes.ts`, and the
        // kinds added since follow them.
        return (
          `\`${name}\` cannot handle \`${info.name}.${field.name}\`, which is \`${table.typeName(field.type)}\`: ` +
          "a field read or written as JSON is an `i32`, `u32`, `i64`, `f64`, `boolean`, `string` or a declared class, " +
          "an array of one of those, or a `string`, a class or an array with `| null`; " +
          "a `u64` and a numeric enum are too, alone or in an array, and so is a `Map` whose keys are `string` " +
          "and whose values are any of these, with `| null` or not"
        )
      }
      if (role === JSON_DECODE && field.readonly) {
        return `\`${info.name}.${field.name}\` is \`readonly\`, and \`jsonDecode\` assigns every field of the class it decodes into`
      }
    }
  }
  if (role === JSON_DECODE) {
    for (const info of jsonMadeClasses(program, table, root)) {
      const ctor = info.ctor
      // A constructor's first parameter is `this`.
      if (ctor !== null && ctor.paramTypes.length > 1) {
        return (
          `\`jsonDecode\` makes a \`${info.name}\` with \`new ${info.name}()\`, and its constructor takes ${ctor.paramTypes.length - 1} parameter(s): ` +
          // The words up to `takes none` are NL2488's in `src/codes.ts`.
          "an array's element and a `| null` field's object are made by the decoder with no arguments, so their class's constructor takes none" +
          ", and so is a `Map`'s value, one for each key"
        )
      }
    }
  }
  return ""
}

/** The method of `JsonDecoder` and of `JsonWriter` for a value of a scalar type: its name in the language. */
export const jsonScalarMethod = (type: i32): string => {
  if (type === T_I32) {
    return "i32"
  }
  if (type === T_U32) {
    return "u32"
  }
  if (type === T_I64) {
    return "i64"
  }
  if (type === T_U64) {
    return "u64"
  }
  if (type === T_F64) {
    return "f64"
  }
  return type === T_BOOL ? "boolean" : "string"
}

/** The `JsonDecoder` method a scalar or a scalar array is read with: `i32`, or `i32Array` / `i32ArrayOrNull`. */
export const jsonDecodeMethod = (f: JsonField): string => {
  const scalar = jsonScalarMethod(f.scalar)
  if (f.kind !== JSON_FIELD_ARRAY) {
    return scalar
  }
  return f.nullable ? `${scalar}ArrayOrNull` : `${scalar}Array`
}

/** The type's part of an encoding helper's name, as in `jsonEncodeI32Array`. */
const jsonHelperPart = (type: i32): string => {
  if (type === T_U32) {
    return "U32"
  }
  if (type === T_I64) {
    return "I64"
  }
  if (type === T_U64) {
    return "U64"
  }
  if (type === T_F64) {
    return "F64"
  }
  if (type === T_BOOL) {
    return "Boolean"
  }
  return type === T_STRING ? "String" : "I32"
}

/**
 * The `nish/json-typed` function a value is written with, when it is not one
 * call of the writer: a `u64`, a `string | null` and an array of scalars or
 * strings. `""` for every other value.
 */
export const jsonEncodeHelper = (f: JsonField): string => {
  if (f.kind === JSON_FIELD_SCALAR) {
    if (f.scalar === T_U64) {
      return "jsonEncodeU64"
    }
    return f.nullable ? "jsonEncodeStringOrNull" : ""
  }
  if (f.kind !== JSON_FIELD_ARRAY) {
    return ""
  }
  return f.nullable
    ? `jsonEncode${jsonHelperPart(f.scalar)}ArrayOrNull`
    : `jsonEncode${jsonHelperPart(f.scalar)}Array`
}

/** The `Map` methods the code written for a map calls: to fill one, and to walk one. */
const jsonMapMethods = (role: i32): string[] =>
  role === JSON_DECODE ? ["clear", "has", "set"] : ["walkNext", "keyAt", "valueAt"]

/** The names of every method of the receiver and every helper the code for a route from `root` calls. */
const jsonRouteNames = (
  program: CheckedProgram,
  table: TypeTable,
  role: i32,
  root: StructInfo
): StringSet => {
  const names = new StringSet()
  if (role === JSON_DECODE) {
    for (const name of [
      "beginObject",
      "nextField",
      "keyLength",
      "keyByte",
      "keyIs",
      "unknownField",
      "duplicateField",
      "missingField",
      "finish",
    ]) {
      names.add(name)
    }
  } else {
    for (const name of ["beginObject", "key", "endObject"]) {
      names.add(name)
    }
  }
  if (root.jsonNumber) {
    names.add(role === JSON_DECODE ? "number" : "jsonEncodeNumber")
  }
  for (const f of jsonValues(program, table, root)) {
    const cls = f.cls
    if (cls !== null && cls.jsonNumber) {
      names.add(role === JSON_DECODE ? "number" : "jsonEncodeNumber")
    }
    const holdsObject =
      f.kind === JSON_FIELD_CLASS || f.kind === JSON_FIELD_CLASS_ARRAY || f.kind === JSON_FIELD_MAP
    const isEnum = f.kind === JSON_FIELD_ENUM || f.kind === JSON_FIELD_ENUM_ARRAY
    const isArray = f.kind === JSON_FIELD_CLASS_ARRAY || f.kind === JSON_FIELD_ENUM_ARRAY
    if (role === JSON_DECODE) {
      if (isEnum) {
        names.add("i32")
        names.add("wrongType")
      } else if (!holdsObject) {
        names.add(jsonDecodeMethod(f))
      }
      if (f.nullable) {
        names.add("takeNull")
      }
      if (isArray) {
        names.add("beginArray")
        names.add("nextElement")
      }
      if (f.kind === JSON_FIELD_MAP) {
        names.add("key")
      }
      continue
    }
    const helper = jsonEncodeHelper(f)
    if (helper.length > 0) {
      names.add(helper)
    } else if (isEnum) {
      names.add("i32")
    } else if (!holdsObject) {
      names.add(jsonScalarMethod(f.scalar))
    }
    if (f.nullable && holdsObject) {
      names.add("nullValue")
    }
    if (isArray) {
      names.add("beginArray")
      names.add("endArray")
    }
  }
  return names
}

/**
 * Everything the code written for `sig` calls, besides its own functions and
 * the runtime's: the receiver's methods (`JsonDecoder`'s or `JsonWriter`'s)
 * and `nish/json-typed`'s helpers that it names, the methods of each `Map` it
 * fills or walks, and the constructor of each class and map a decoding makes.
 * `program` is the module the template is in, which has every layout the
 * instantiation reaches.
 */
export const jsonRouteCallees = (
  program: CheckedProgram,
  table: TypeTable,
  sig: FunctionSig
): FunctionSig[] => {
  const out: FunctionSig[] = []
  const instance = sig.instance
  if (instance === null || instance.typeArgs.length !== 1 || sig.paramTypes.length !== 2) {
    return out
  }
  const receiver = program.struct(table.nameOf(sig.paramTypes[0]))
  const root = jsonClassOf(program, table, instance.typeArgs[0])
  if (receiver === null || root === null) {
    return out
  }
  const names = jsonRouteNames(program, table, instance.jsonRoute, root)
  let i = 0
  while (i < names.size()) {
    const method = receiver.method(names.at(i))
    if (method !== null) {
      out.push(method)
    }
    i = i + 1
  }
  for (const fn of program.functions) {
    if (fn.instance === null && fn.definedIn(program.source) && names.has(fn.sourceName)) {
      out.push(fn)
    }
  }
  const decode = instance.jsonRoute === JSON_DECODE
  const methods = jsonMapMethods(instance.jsonRoute)
  for (const map of jsonMaps(program, table, root, false)) {
    for (const name of methods) {
      const method = map.method(name)
      if (method !== null) {
        out.push(method)
      }
    }
  }
  if (decode) {
    for (const info of jsonMadeClasses(program, table, root)) {
      const ctor = info.ctor
      if (ctor !== null) {
        out.push(ctor)
      }
    }
    for (const map of jsonMaps(program, table, root, true)) {
      const ctor = map.ctor
      if (ctor !== null) {
        out.push(ctor)
      }
    }
  }
  return out
}
