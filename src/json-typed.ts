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
  TemplateInfo,
} from "./program"
import { StringSet } from "./map"
import { T_BOOL, T_F64, T_I32, T_I64, T_STRING, T_U32, TypeTable } from "./types"

/** A field that is one value: an integer, an `f64`, a `boolean` or a `string`. */
export const JSON_FIELD_SCALAR: i32 = 1
/** A field that holds an object of a class. */
export const JSON_FIELD_CLASS: i32 = 2
/** An array of scalars or strings. */
export const JSON_FIELD_ARRAY: i32 = 3
/** An array of objects of a class. */
export const JSON_FIELD_CLASS_ARRAY: i32 = 4

/** One field as the written code reads and writes it. */
export class JsonField {
  field: FieldInfo
  /** One of the `JSON_FIELD_*` kinds. */
  kind: i32
  /** Whether the field's type is `| null`. */
  nullable: boolean
  /** The scalar type of a scalar field or of an array's element; `0` for a class. */
  scalar: i32
  /** The class of a class field or of an array's element; `null` for a scalar. */
  cls: StructInfo | null

  constructor(field: FieldInfo, kind: i32, nullable: boolean, scalar: i32, cls: StructInfo | null) {
    this.field = field
    this.kind = kind
    this.nullable = nullable
    this.scalar = scalar
    this.cls = cls
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

/** The type a value of the field is read as, when it is one: `i32`, `u32`, `i64`, `f64`, `boolean` or `string`. */
const jsonScalar = (type: i32): i32 => {
  if (
    type === T_I32 ||
    type === T_U32 ||
    type === T_I64 ||
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

/** `field` as the route reads and writes it, or `null` when its type is not one it can. */
export const jsonFieldOf = (
  program: CheckedProgram,
  table: TypeTable,
  field: FieldInfo
): JsonField | null => {
  const nullable = table.isNullable(field.type)
  const base = table.stripNull(field.type)
  const scalar = jsonScalar(base)
  if (scalar !== 0) {
    // Of these only a `string` can be `| null`: a number has no `null` to hold.
    return new JsonField(field, JSON_FIELD_SCALAR, nullable, scalar, null)
  }
  if (table.isArray(base) && !table.isReadonlyArray(base)) {
    const elem = table.refOf(base)
    const inner = jsonScalar(elem)
    if (inner !== 0) {
      return new JsonField(field, JSON_FIELD_ARRAY, nullable, inner, null)
    }
    const cls = jsonClassOf(program, table, elem)
    return cls === null ? null : new JsonField(field, JSON_FIELD_CLASS_ARRAY, nullable, 0, cls)
  }
  const cls = jsonClassOf(program, table, base)
  return cls === null ? null : new JsonField(field, JSON_FIELD_CLASS, nullable, 0, cls)
}

/**
 * Every class a route from `root` reaches, `root` first and each once, in the
 * order the fields name them. A field the route cannot handle reaches nothing;
 * `jsonRefusal` has refused it.
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
    for (const field of info.fields) {
      const f = jsonFieldOf(program, table, field)
      const cls: StructInfo | null = f === null ? null : f.cls
      if (cls !== null && seen.add(cls.name)) {
        out.push(cls)
      }
    }
  }
  return out
}

/**
 * Whether decoding has to make an object of `info` itself: it is an array's
 * element, which the decoder makes past the array's end, or a `| null`
 * field's class, which it makes when the field holds `null`.
 */
const jsonMadeByDecoder = (
  program: CheckedProgram,
  table: TypeTable,
  classes: StructInfo[],
  info: StructInfo
): boolean => {
  for (const owner of classes) {
    for (const field of owner.fields) {
      const f = jsonFieldOf(program, table, field)
      const cls: StructInfo | null = f === null ? null : f.cls
      if (f !== null && cls !== null && cls === info && (f.kind === JSON_FIELD_CLASS_ARRAY || f.nullable)) {
        return true
      }
    }
  }
  return false
}

/** The classes of a decode from `root` that the decoder makes with `new C()`. */
export const jsonMadeClasses = (
  program: CheckedProgram,
  table: TypeTable,
  root: StructInfo
): StructInfo[] => {
  const classes = jsonClasses(program, table, root)
  const out: StructInfo[] = []
  for (const info of classes) {
    if (jsonMadeByDecoder(program, table, classes, info)) {
      out.push(info)
    }
  }
  return out
}

/**
 * Why a call of the route `name` (`jsonDecode` or `jsonEncode`) cannot bind
 * its value to `type`, or `""` when it can. Every class the route reaches is
 * held to the same rule, so a nested class, an array's element and a
 * `| null` field's class are refused exactly as `T` is.
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
    for (const field of info.fields) {
      if (jsonFieldOf(program, table, field) === null) {
        return (
          `\`${name}\` cannot handle \`${info.name}.${field.name}\`, which is \`${table.typeName(field.type)}\`: ` +
          "a field read or written as JSON is an `i32`, `u32`, `i64`, `f64`, `boolean`, `string` or a declared class, " +
          "an array of one of those, or a `string`, a class or an array with `| null`"
        )
      }
      if (role === JSON_DECODE && field.readonly) {
        return `\`${info.name}.${field.name}\` is \`readonly\`, and \`jsonDecode\` assigns every field of the class it decodes into`
      }
    }
  }
  if (role === JSON_DECODE) {
    for (const info of classes) {
      const ctor = info.ctor
      // A constructor's first parameter is `this`.
      if (ctor !== null && ctor.paramTypes.length > 1 && jsonMadeByDecoder(program, table, classes, info)) {
        return (
          `\`jsonDecode\` makes a \`${info.name}\` with \`new ${info.name}()\`, and its constructor takes ${ctor.paramTypes.length - 1} parameter(s): ` +
          "an array's element and a `| null` field's object are made by the decoder with no arguments, so their class's constructor takes none"
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
  if (type === T_F64) {
    return "f64"
  }
  return type === T_BOOL ? "boolean" : "string"
}

/** The `JsonDecoder` method a scalar or a scalar array field is read with: `i32`, or `i32Array` / `i32ArrayOrNull`. */
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
  if (type === T_F64) {
    return "F64"
  }
  if (type === T_BOOL) {
    return "Boolean"
  }
  return type === T_STRING ? "String" : "I32"
}

/**
 * The `nish/json-typed` function a field is written with, when it is not one
 * call of the writer: a `string | null` and an array of scalars or strings.
 * `""` for every other field.
 */
export const jsonEncodeHelper = (f: JsonField): string => {
  if (f.kind === JSON_FIELD_SCALAR) {
    return f.nullable ? "jsonEncodeStringOrNull" : ""
  }
  if (f.kind !== JSON_FIELD_ARRAY) {
    return ""
  }
  return f.nullable
    ? `jsonEncode${jsonHelperPart(f.scalar)}ArrayOrNull`
    : `jsonEncode${jsonHelperPart(f.scalar)}Array`
}

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
  for (const info of jsonClasses(program, table, root)) {
    for (const field of info.fields) {
      const f = jsonFieldOf(program, table, field)
      if (f === null) {
        continue
      }
      const holdsClass = f.kind === JSON_FIELD_CLASS || f.kind === JSON_FIELD_CLASS_ARRAY
      if (role === JSON_DECODE) {
        if (!holdsClass) {
          names.add(jsonDecodeMethod(f))
        }
        if (f.nullable) {
          names.add("takeNull")
        }
        if (f.kind === JSON_FIELD_CLASS_ARRAY) {
          names.add("beginArray")
          names.add("nextElement")
        }
        continue
      }
      const helper = jsonEncodeHelper(f)
      if (helper.length > 0) {
        names.add(helper)
      } else if (!holdsClass) {
        names.add(jsonScalarMethod(f.scalar))
      }
      if (f.nullable && holdsClass) {
        names.add("nullValue")
      }
      if (f.kind === JSON_FIELD_CLASS_ARRAY) {
        names.add("beginArray")
        names.add("endArray")
      }
    }
  }
  return names
}

/**
 * Everything the code written for `sig` calls, besides its own functions and
 * the runtime's: the receiver's methods (`JsonDecoder`'s or `JsonWriter`'s)
 * and `nish/json-typed`'s helpers that it names, and the constructor of each
 * class a decoding makes. `program` is the module the template is in, which
 * has every layout the instantiation reaches.
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
  if (instance.jsonRoute === JSON_DECODE) {
    for (const info of jsonMadeClasses(program, table, root)) {
      const ctor = info.ctor
      if (ctor !== null) {
        out.push(ctor)
      }
    }
  }
  return out
}
