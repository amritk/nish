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
//     `static readonly json = { rename: { ... }, optional: [ ... ],
//     presence: { ... } }` once its fields are collected, and write what it
//     says into each field (`FieldInfo.wireName`, `jsonOptional`,
//     `jsonPresence`, `jsonOffWire`), which is all the emitter reads;
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
  JSON_DECODE_UNION,
  JSON_ENCODE,
  JSON_NONE,
  STRUCT_CLASS,
  StructInfo,
  StructInstantiation,
  TemplateInfo,
} from "./program"
import { StringMap, StringSet } from "./map"
import { CheckContext } from "./context"
import { jsonQuote } from "./strings"
import {
  FLAG_COMPUTED,
  FLAG_DEFINITE,
  FLAG_OPTIONAL,
  FLAG_READONLY,
  N_ARRAY,
  N_EMPTY,
  N_FALSE,
  N_NULL,
  N_NUMBER,
  N_OBJECT,
  N_PROPERTY,
  N_SPREAD,
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
/** A tagged union of classes: an object whose tag picks the variant. */
export const JSON_FIELD_UNION: i32 = 8
/** An array of a tagged union's values. */
export const JSON_FIELD_UNION_ARRAY: i32 = 9
/** A variant's tag, an enum member type: its string on the wire, and only its own. */
export const JSON_FIELD_TAG: i32 = 10

/**
 * One value as the written code reads and writes it: a field of a class, or
 * the value type of a `Map` field, which has no field of its own.
 */
export class JsonField {
  // Declared widest first, so no byte of a value is padding.
  /** The field, or `null` for a `Map`'s value. */
  field: FieldInfo | null
  /** The class of an object or of an array's element; `null` otherwise. */
  cls: StructInfo | null
  /** The `Map` instance of a map value; `null` otherwise. */
  map: StructInfo | null
  /** What a map holds; `null` for every other kind. */
  value: JsonField | null
  /** The union's variants, in `TypeTable.variantsOf`'s order; empty for every other kind. */
  variants: StructInfo[]
  /** The value's type, `| null` included. */
  type: i32
  /** One of the `JSON_FIELD_*` kinds. */
  kind: i32
  /** The scalar type of a scalar or of an array's element; `0` otherwise. */
  scalar: i32
  /** The enum of an enum value or of an array's element; `0` otherwise. */
  enumType: i32
  /** The union of a union value or of an array's element, `| null` stripped; `-1` otherwise. */
  union: i32
  /** Whether the type is `| null`. */
  nullable: boolean

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
    this.union = -1
    this.variants = []
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

/**
 * NL2492's sentence, for options written in a shape the compiler does not
 * read: shared by `checkJsonOptions` and the pass 1 sweep, which refuses
 * them on a generic class whether or not anything instantiates it.
 */
export const jsonOptionsShapeMessage = (shown: string): string =>
  // The words after the class's name are NL2492's.
  `\`static\` member \`${JSON_OPTIONS}\` of class \`${shown}\` is written \`static readonly json = { ... }\`, ` +
  "with no type annotation, in a class that is not generic: it holds the class's typed JSON options and is not a field"

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

/**
 * Whether the bytes of `s` are well-formed UTF-8, as the tokenizer holds every
 * key to: no stray continuation byte, no overlong form, no surrogate (a lone
 * `"\ud800"` in the source is stored as its three bytes) and nothing past
 * U+10FFFF.
 */
const jsonIsUtf8 = (s: string): boolean => {
  const n = s.length
  let i = 0
  while (i < n) {
    const b = toI32(s.charCodeAt(i))
    let more = 0
    let lo = 128
    let hi = 191
    if (b < 128) {
      more = 0
    } else if (b >= 194 && b <= 223) {
      more = 1
    } else if (b >= 224 && b <= 239) {
      more = 2
      if (b === 224) {
        lo = 160
      } else if (b === 237) {
        hi = 159
      }
    } else if (b >= 240 && b <= 244) {
      more = 3
      if (b === 240) {
        lo = 144
      } else if (b === 244) {
        hi = 143
      }
    } else {
      return false
    }
    i = i + 1
    while (more > 0) {
      if (i >= n) {
        return false
      }
      const c = toI32(s.charCodeAt(i))
      if (c < lo || c > hi) {
        return false
      }
      lo = 128
      hi = 191
      more = more - 1
      i = i + 1
    }
  }
  return true
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
      "so `json` is an object literal, `rename` an object literal of string literals and `optional` an array literal of string literals, " +
      "and `presence` an object literal of string literals"
  )
}

/** A `...x` among the options or inside `rename` or `presence`: the options are read from the text alone. */
const jsonSpread = (ctx: CheckContext, info: StructInfo, node: Node, where: string): void => {
  ctx.error(
    node,
    `\`${info.name}.${JSON_OPTIONS}\`${where} spreads another value into the typed JSON options: ` +
      "typed JSON reads a class's options from its text, where a spread names nothing it can see, " +
      "so write each option out by name"
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
    if (prop.kind === N_SPREAD) {
      jsonSpread(ctx, info, prop, "'s `rename`")
      return
    }
    // A computed key was refused by Phase 0 (NL1041).
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
    if (jsonIsStringLiteral(to) && !jsonIsUtf8(jsonStringLiteral(to))) {
      // The words after the field's name are NL2499's.
      ctx.error(
        to,
        `\`${info.name}.${JSON_OPTIONS}\` renames \`${field.name}\` to a key that is not valid UTF-8: ` +
          "the decoder reads every key as UTF-8 and refuses a lone surrogate, so no input could give it"
      )
    } else if (jsonIsStringLiteral(to)) {
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

/** A presence field misused: NL2592's words after the detail. */
const jsonPresenceMisuse = (ctx: CheckContext, info: StructInfo, node: Node, detail: string): void => {
  ctx.error(
    node,
    `\`${info.name}.${JSON_OPTIONS}\`'s \`presence\` ${detail}: a presence field is a \`boolean\` that is not \`readonly\` ` +
      "and records whether one other field's key was given; it is off the wire, so no option renames it, makes it optional or records it"
  )
}

/**
 * The presence misuse of a flag that is not a `boolean` field one may set:
 * `why` says what it is, and an empty one names its type. It is a function of
 * its own because it returns nothing, so the type's name it makes is released
 * when it returns rather than kept for every pass of the caller's loop.
 */
const jsonPresenceFlagIs = (
  ctx: CheckContext,
  info: StructInfo,
  to: Node,
  field: FieldInfo,
  flag: FieldInfo,
  why: string
): void => {
  const what = why.length > 0 ? why : `\`${ctx.table.typeName(flag.type)}\``
  jsonPresenceMisuse(ctx, info, to, `gives \`${field.name}\` the field \`${flag.name}\`, which is ${what}`)
}

/**
 * `presence: { field: "hasField", ... }`: for each field, the `boolean` field
 * a decoding sets to whether its key was given. The presence field leaves the
 * wire: neither route reads or writes it.
 */
const jsonReadPresence = (ctx: CheckContext, info: StructInfo, value: Node): void => {
  if (value.kind !== N_OBJECT) {
    jsonNotLiteral(ctx, info, value, "'s `presence`")
    return
  }
  for (const prop of value.children) {
    if (ctx.errored) {
      return
    }
    if (prop.kind === N_SPREAD) {
      jsonSpread(ctx, info, prop, "'s `presence`")
      return
    }
    // A computed key was refused by Phase 0 (NL1041).
    if (prop.kind !== N_PROPERTY || (prop.flags & FLAG_COMPUTED) !== 0 || prop.children.length === 0) {
      continue
    }
    const to = prop.children[0]
    if (!jsonIsStringLiteral(to)) {
      jsonNotLiteral(ctx, info, to, `'s \`presence.${prop.text}\``)
      return
    }
    const field = jsonOptionField(ctx, info, prop, "presence", prop.text)
    if (field === null) {
      return
    }
    const flag = jsonOptionField(ctx, info, to, "presence", jsonStringLiteral(to))
    if (flag === null) {
      return
    }
    if (field.jsonPresence !== null) {
      jsonPresenceMisuse(ctx, info, prop, `records \`${field.name}\` twice`)
      return
    }
    if (flag === field) {
      jsonPresenceMisuse(ctx, info, to, `gives \`${field.name}\` itself as its presence field`)
      return
    }
    if (flag.jsonOffWire) {
      jsonPresenceMisuse(ctx, info, to, `gives \`${flag.name}\` to two fields`)
      return
    }
    if (field.jsonOffWire) {
      jsonPresenceMisuse(ctx, info, prop, `records \`${field.name}\`, which is a presence field`)
      return
    }
    if (flag.jsonPresence !== null) {
      jsonPresenceFlagIs(ctx, info, to, field, flag, "recorded by a presence field of its own")
      return
    }
    if (flag.type !== T_BOOL) {
      jsonPresenceFlagIs(ctx, info, to, field, flag, "")
      return
    }
    if (flag.readonly) {
      jsonPresenceFlagIs(ctx, info, to, field, flag, "`readonly`")
      return
    }
    field.jsonPresence = flag
    flag.jsonOffWire = true
  }
}

/** Whether the enum member type `member` tags a variant of some union the program declares. */
const jsonIsUnionTag = (table: TypeTable, member: i32): boolean => {
  for (const tags of table.unionTags) {
    if (tags.indexOf(member) >= 0) {
      return true
    }
  }
  return false
}

/** Whether `info` has a field whose type is one enum member: a tag, which makes it a union's variant. */
const jsonHasTag = (table: TypeTable, info: StructInfo): boolean => {
  for (const field of info.fields) {
    if (table.isEnumMemberType(field.type)) {
      return true
    }
  }
  return false
}

/** `tag: "wire"`: the string a union's variant writes its tag as, in place of its enum member's name. */
const jsonReadTag = (ctx: CheckContext, info: StructInfo, value: Node): void => {
  if (!jsonIsStringLiteral(value)) {
    // The words after the class's name are NL2721's.
    ctx.error(
      value,
      `\`${info.name}.${JSON_OPTIONS}\`'s \`tag\` is not a string literal: ` +
        "a variant's tag is written on the wire as a string, and typed JSON reads which one from the class's text"
    )
    return
  }
  const wire = jsonStringLiteral(value)
  if (!jsonIsUtf8(wire)) {
    // The words after `tag` are NL2499's.
    ctx.error(
      value,
      `\`${info.name}.${JSON_OPTIONS}\` sets \`tag\` to a key that is not valid UTF-8: ` +
        "the decoder reads every key as UTF-8 and refuses a lone surrogate, so no input could give it"
    )
    return
  }
  if (!jsonHasTag(ctx.table, info)) {
    // The words after the class's name are NL2723's.
    ctx.error(
      value,
      `\`${info.name}.${JSON_OPTIONS}\` gives a \`tag\`, and \`${info.name}\` has no field whose type is one enum member: ` +
        "`tag` is the string a tagged union's variant writes its tag as, so only a variant gives one"
    )
    return
  }
  info.jsonTag = wire
}

/**
 * Read the class's `static readonly json`, now that its fields are known, and
 * write what it says into them: a renamed field's `wireName`, an optional
 * field's `jsonOptional`, and a recorded field's `jsonPresence`. Every misuse
 * is refused here, with the class, so a class that no call decodes is held to
 * the same rule as one that is.
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
  if (
    (decl.flags & FLAG_READONLY) === 0 ||
    (decl.flags & (FLAG_OPTIONAL | FLAG_DEFINITE)) !== 0 ||
    decl.children[1].kind !== N_EMPTY ||
    info.instance !== null
  ) {
    ctx.error(decl, jsonOptionsShapeMessage(ctx.table.typeName(info.type)))
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
    if (prop.kind === N_SPREAD) {
      jsonSpread(ctx, info, prop, "")
      return
    }
    if (prop.kind !== N_PROPERTY || (prop.flags & FLAG_COMPUTED) !== 0 || prop.children.length === 0) {
      continue
    }
    const option = prop.text
    if (option !== "rename" && option !== "optional" && option !== "presence" && option !== "tag") {
      // The words after the option's name are NL2494's.
      ctx.error(
        prop,
        `\`${info.name}.${JSON_OPTIONS}\` has no option \`${option}\`: typed JSON's options are \`rename\` and \`optional\`, and \`presence\` and \`tag\``
      )
      return
    }
    if (!given.add(option)) {
      jsonDuplicate(ctx, info, prop, `gives \`${option}\` twice`)
      return
    }
    if (option === "rename") {
      jsonReadRename(ctx, info, prop.children[0])
    } else if (option === "optional") {
      jsonReadOptional(ctx, info, prop.children[0])
    } else if (option === "tag") {
      jsonReadTag(ctx, info, prop.children[0])
    } else {
      jsonReadPresence(ctx, info, prop.children[0])
    }
  }
  if (ctx.errored) {
    return
  }
  // A presence field has no key, so the other options cannot name it; read
  // once every option is, whichever order the literal gives them in.
  for (const field of info.fields) {
    if (field.jsonOffWire && (field.jsonOptional || field.wireName !== field.name)) {
      const what = field.jsonOptional ? "make it optional" : "rename it"
      jsonPresenceMisuse(
        ctx,
        info,
        decl,
        `names \`${field.name}\` as a presence field, and the class's options also ${what}`
      )
      return
    }
  }
  // A key names one field: no two fields' keys may be equal, a renamed one's
  // and another's own name included.
  const keys = new StringSet()
  for (const field of info.fields) {
    if (!field.jsonOffWire && !keys.add(field.wireName)) {
      let other = ""
      for (const f of info.fields) {
        if (other.length === 0 && f !== field && !f.jsonOffWire && f.wireName === field.wireName) {
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
  if (template.sourceName === "jsonDecodeUnion") {
    return JSON_DECODE_UNION
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
const jsonClassOf = (program: CheckedProgram, table: TypeTable, type: i32): StructInfo | null => {
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

/**
 * The variants of the union `type` as classes the route can read and write,
 * or `null` when one is not: an interface, say, which `jsonBadVariant` names.
 */
const jsonVariantsOf = (program: CheckedProgram, table: TypeTable, type: i32): StructInfo[] | null => {
  const out: StructInfo[] = []
  for (const variant of table.variantsOf(type)) {
    const cls = jsonClassOf(program, table, variant)
    if (cls === null) {
      return null
    }
    out.push(cls)
  }
  return out
}

/** The first variant of the union `type` that is not a class the route can read and write, or `-1`. */
const jsonBadVariant = (program: CheckedProgram, table: TypeTable, type: i32): i32 => {
  for (const variant of table.variantsOf(type)) {
    if (jsonClassOf(program, table, variant) === null) {
      return variant
    }
  }
  return -1
}

/**
 * The classes a route over `type` starts from: the class itself, or every
 * variant of a union (`| null` stripped); empty when it is neither, or a
 * variant is not a class.
 */
export const jsonRootsOf = (program: CheckedProgram, table: TypeTable, type: i32): StructInfo[] => {
  const base = table.stripNull(type)
  if (table.isUnion(base)) {
    const variants = jsonVariantsOf(program, table, base)
    return variants === null ? [] : variants
  }
  const out: StructInfo[] = []
  const cls = jsonClassOf(program, table, type)
  if (cls !== null) {
    out.push(cls)
  }
  return out
}

/** Whether `field` holds the tag `info` is a variant of some union by: a union pairs the two. */
const jsonTagsVariant = (table: TypeTable, info: StructInfo, field: FieldInfo): boolean => {
  let u = 0
  while (u < table.unions.length && u < table.unionTags.length) {
    const variants = table.unions[u]
    const tags = table.unionTags[u]
    u = u + 1
    const k = variants.indexOf(info.type)
    if (k >= 0 && k < tags.length && tags[k] === field.type) {
      return true
    }
  }
  return false
}

/**
 * The string the variant `info` writes its tag, the field `field`, as: the
 * `tag` of its options, or else the name of the enum member the field's type
 * is. The `tag` names only the field a union tags `info` by, so another
 * enum-member field keeps its member's name.
 */
export const jsonWireTag = (table: TypeTable, info: StructInfo, field: FieldInfo): string =>
  info.jsonTag.length > 0 && jsonTagsVariant(table, info, field) ? info.jsonTag : table.nameOf(field.type)

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
  if (table.isEnumMemberType(base)) {
    // A tag holds its one member, and a member has no `null`; a member no
    // union tags a variant with is no tag, and stays refused
    // (tests/cases/json_reject_enum_member).
    if (nullable || !jsonIsUnionTag(table, base)) {
      return null
    }
    const f = new JsonField(field, type, JSON_FIELD_TAG, false)
    f.enumType = base
    return f
  }
  if (table.isUnion(base)) {
    const variants = jsonVariantsOf(program, table, base)
    if (variants === null) {
      return null
    }
    const f = new JsonField(field, type, JSON_FIELD_UNION, nullable)
    f.union = base
    f.variants = variants
    return f
  }
  if (table.isEnum(base)) {
    // The checker refuses `Level | null` where it is written (NL2010,
    // tests/cases/json_reject_enum_nullable); a number has no `null`.
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
    if (table.isUnion(elem)) {
      const variants = jsonVariantsOf(program, table, elem)
      if (variants === null) {
        return null
      }
      const f = new JsonField(field, type, JSON_FIELD_UNION_ARRAY, nullable)
      f.union = elem
      f.variants = variants
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
 * Every class a route from `roots` reaches, `roots` first and each once, in
 * the order the fields name them, through arrays, `Map` values and a union's
 * variants alike. A field the route cannot handle reaches nothing;
 * `jsonRefusal` has refused it.
 */
export const jsonClasses = (program: CheckedProgram, table: TypeTable, roots: StructInfo[]): StructInfo[] => {
  const out: StructInfo[] = []
  const seen = new StringSet()
  for (const root of roots) {
    if (seen.add(root.name)) {
      out.push(root)
    }
  }
  let at = 0
  while (at < out.length) {
    const info = out[at]
    at = at + 1
    // `JsonNumber` is read and written whole, as the number it holds.
    if (info.jsonNumber) {
      continue
    }
    for (const field of info.fields) {
      // A presence field is off the wire: set by a decoding, read by neither route.
      if (field.jsonOffWire) {
        continue
      }
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
        for (const variant of v.variants) {
          if (seen.add(variant.name)) {
            out.push(variant)
          }
        }
      }
    }
  }
  return out
}

/** Every value a route from `roots` reads or writes: each field of each class it reaches, and what each `Map` holds. */
const jsonValues = (program: CheckedProgram, table: TypeTable, roots: StructInfo[]): JsonField[] => {
  const out: JsonField[] = []
  for (const info of jsonClasses(program, table, roots)) {
    if (info.jsonNumber) {
      continue
    }
    for (const field of info.fields) {
      // A presence field is off the wire: set by a decoding, read by neither route.
      if (field.jsonOffWire) {
        continue
      }
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
 * The classes of a decode from `roots` that the decoder makes itself, with
 * `new C()`: each class an array of objects holds, which it makes past the
 * array's end, each class a `| null` field or a `Map` holds, and every
 * variant of a union, which it makes when the tag names another variant
 * than the one it holds — the roots' too when `union` says they are one. One
 * pass over the values `jsonValues` reaches.
 */
const jsonMadeClasses = (
  program: CheckedProgram,
  table: TypeTable,
  roots: StructInfo[],
  union: boolean
): StructInfo[] => {
  const out: StructInfo[] = []
  const made = new StringSet()
  if (union) {
    for (const root of roots) {
      if (made.add(root.name)) {
        out.push(root)
      }
    }
  }
  for (const f of jsonValues(program, table, roots)) {
    const cls = f.cls
    if (cls !== null && (f.kind === JSON_FIELD_CLASS_ARRAY || jsonMakes(f)) && made.add(cls.name)) {
      out.push(cls)
    }
    for (const variant of f.variants) {
      if (made.add(variant.name)) {
        out.push(variant)
      }
    }
  }
  return out
}

/** Every `Map` a route from `root` reaches, each once; `madeOnly` keeps the ones the decoder makes with `new`. */
const jsonMaps = (
  program: CheckedProgram,
  table: TypeTable,
  roots: StructInfo[],
  madeOnly: boolean
): StructInfo[] => {
  const out: StructInfo[] = []
  const seen = new StringSet()
  for (const f of jsonValues(program, table, roots)) {
    const map = f.map
    if (map !== null && (!madeOnly || jsonMakes(f)) && seen.add(map.name)) {
      out.push(map)
    }
  }
  return out
}

/**
 * The union a field of `type` holds, alone, with `| null`, as an array's
 * element or as what a `Map` holds, any of those, or `-1` when it holds none.
 */
const jsonUnionIn = (program: CheckedProgram, table: TypeTable, type: i32): i32 => {
  let at = type
  // Each pass goes one `Map` deeper, and a type is finite.
  while (true) {
    const base = table.stripNull(at)
    if (table.isUnion(base)) {
      return base
    }
    if (table.isArray(base) && table.isUnion(table.refOf(base))) {
      return table.refOf(base)
    }
    const map = jsonMapOf(program, table, base)
    const instance: StructInstantiation | null = map === null ? null : map.instance
    if (instance === null) {
      return -1
    }
    at = instance.typeArgs[1]
  }
}

/** NL2486's refusal of the union `union`'s variant `variant`, which is not a class, reached by the route `name`. */
const jsonNotClassVariant = (table: TypeTable, name: string, union: i32, variant: i32): string =>
  `\`${name}\` reaches \`${table.typeName(union)}\`'s variant \`${table.typeName(variant)}\`, which is not a class: ` +
  "typed JSON reads and writes an object through the fields of a declared class, and an interface, a generic class or any other type is not one in this version"

/** The field of the variant `info` that holds its tag in the union `union`. */
const jsonTagField = (table: TypeTable, info: StructInfo, union: i32): FieldInfo | null =>
  info.field(table.tagNameOf(union))

/**
 * Why the variants of `union` cannot share one wire: two that write their tag
 * as the same string, or two that write it under different keys. `""` when
 * they can.
 */
const jsonUnionRefusal = (program: CheckedProgram, table: TypeTable, union: i32): string => {
  const variants = jsonVariantsOf(program, table, union)
  if (variants === null) {
    return ""
  }
  const tags = new StringMap()
  let firstKey = ""
  let firstOwner = ""
  let at = 0
  for (const info of variants) {
    at = at + 1
    const field = jsonTagField(table, info, union)
    if (field === null) {
      continue
    }
    const wire = jsonWireTag(table, info, field)
    if (tags.has(wire)) {
      // The words after the tag are NL2719's in `src/codes.ts`.
      return (
        `\`${variants[tags.get(wire, 0)].name}\` and \`${info.name}\` both write their tag in \`${table.typeName(union)}\` as \`${jsonQuote(wire)}\`: ` +
        "a decoder picks a union's variant by the string its tag is written as, so each variant of a union writes a different one"
      )
    }
    tags.set(wire, at - 1)
    if (firstOwner.length === 0) {
      firstOwner = info.name
      firstKey = field.wireName
    } else if (field.wireName !== firstKey) {
      // The words after the keys are NL2720's in `src/codes.ts`.
      return (
        `\`${firstOwner}\` writes its tag \`${field.name}\` under the key \`${jsonQuote(firstKey)}\` and \`${info.name}\` under \`${jsonQuote(field.wireName)}\`: ` +
        "a decoder finds a union's tag before it knows which variant the object is, so every variant of a union writes its tag under the same key"
      )
    }
  }
  return ""
}

/**
 * Why a call of the route `name` (`jsonDecode`, `jsonDecodeUnion` or
 * `jsonEncode`) cannot bind its value to `type`, or `""` when it can. Every
 * class the route reaches is held to the same rule, so a nested class, an
 * array's element, a `Map`'s value, a `| null` field's class and a union's
 * variant are refused exactly as `T` is.
 */
export const jsonRefusal = (
  program: CheckedProgram,
  table: TypeTable,
  name: string,
  role: i32,
  type: i32
): string => {
  const base = table.stripNull(type)
  const union = table.isUnion(base)
  if (role === JSON_DECODE && union) {
    // The words after the type are NL2718's in `src/codes.ts`.
    return (
      `\`${name}\`'s value is \`${table.typeName(type)}\`, a tagged union: ` +
      "`jsonDecode` decodes into the object it is given, and which variant a document holds is known only once its tag is read, " +
      "so a union is decoded with `jsonDecodeUnion(d, prev)`, which answers the object it decoded into"
    )
  }
  if (role === JSON_DECODE_UNION && !union) {
    // The words after the type are NL2722's in `src/codes.ts`.
    return (
      `\`${name}\`'s value is \`${table.typeName(type)}\`, which is not a tagged union: ` +
      "`jsonDecodeUnion` picks a variant by the object's tag and answers it, so its value is a union of classes; " +
      "a class is decoded into with `jsonDecode(d, out)`"
    )
  }
  if (union) {
    const bad = jsonBadVariant(program, table, base)
    if (bad >= 0) {
      return jsonNotClassVariant(table, name, base, bad)
    }
  }
  // Only `jsonDecodeUnion`'s value may be `| null`: the object it decodes into when there is one.
  const none: StructInfo[] = []
  const roots = type !== base && role !== JSON_DECODE_UNION ? none : jsonRootsOf(program, table, type)
  if (roots.length === 0) {
    return (
      `\`${name}\`'s value is \`${table.typeName(type)}\`, which is not a class: ` +
      "typed JSON reads and writes an object through the fields of a declared class, and an interface, a generic class or any other type is not one in this version"
    )
  }
  if (union) {
    const why = jsonUnionRefusal(program, table, base)
    if (why.length > 0) {
      return why
    }
  }
  const decode = role !== JSON_ENCODE
  const classes = jsonClasses(program, table, roots)
  for (const info of classes) {
    if (info.jsonNumber) {
      continue
    }
    for (const field of info.fields) {
      // A presence field is off the wire: set by a decoding, read by neither route.
      if (field.jsonOffWire) {
        continue
      }
      const f = jsonFieldOf(program, table, field)
      if (f === null) {
        const inner = jsonUnionIn(program, table, field.type)
        if (inner >= 0) {
          const bad = jsonBadVariant(program, table, inner)
          if (bad >= 0) {
            return jsonNotClassVariant(table, name, inner, bad)
          }
        }
        // The words up to `| null` are NL2485's in `src/codes.ts`, and the
        // kinds added since follow them.
        return (
          `\`${name}\` cannot handle \`${info.name}.${field.name}\`, which is \`${table.typeName(field.type)}\`: ` +
          "a field read or written as JSON is an `i32`, `u32`, `i64`, `f64`, `boolean`, `string` or a declared class, " +
          "an array of one of those, or a `string`, a class or an array with `| null`; " +
          "a `u64` and a numeric enum are too, alone or in an array, and so is a `Map` whose keys are `string` " +
          "and whose values are any of these, with `| null` or not; " +
          "so are a union of classes, alone, with `| null` or in an array, and a variant's tag"
        )
      }
      // A union is checked wherever the field reaches it: in the field, or as what a `Map` holds.
      let v: JsonField | null = f
      while (v !== null) {
        if (v.union >= 0 && v.variants.length > 0) {
          const why = jsonUnionRefusal(program, table, v.union)
          if (why.length > 0) {
            return why
          }
        }
        v = v.value
      }
      if (decode && field.readonly && f.kind !== JSON_FIELD_TAG) {
        // The words after the field are NL2487's in `src/codes.ts`.
        return (
          `\`${info.name}.${field.name}\` is \`readonly\`, and \`jsonDecode\` assigns every field of the class it decodes into` +
          (role === JSON_DECODE_UNION ? ", as `jsonDecodeUnion` does every field but a variant's tag" : "")
        )
      }
    }
  }
  if (decode) {
    for (const info of jsonMadeClasses(program, table, roots, role === JSON_DECODE_UNION)) {
      const ctor = info.ctor
      // A constructor's first parameter is `this`.
      if (ctor !== null && ctor.paramTypes.length > 1) {
        return (
          `\`${name}\` makes a \`${info.name}\` with \`new ${info.name}()\`, and its constructor takes ${ctor.paramTypes.length - 1} parameter(s): ` +
          // The words up to `takes none` are NL2488's in `src/codes.ts`.
          "an array's element and a `| null` field's object are made by the decoder with no arguments, so their class's constructor takes none" +
          ", and so is a `Map`'s value, one for each key, and a union's variant"
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
  role === JSON_ENCODE ? ["walkNext", "keyAt", "valueAt"] : ["clear", "has", "set"]

/**
 * Adds to `names` the `JsonDecoder` methods the code written for a union's
 * object calls: to find its tag, and to read on past it. Added one by one, so
 * a loop that calls it leaves nothing behind.
 */
const jsonAddUnionMethods = (names: StringSet): void => {
  names.add("unionTag")
  names.add("unknownTag")
  names.add("enterUnion")
  names.add("keyLength")
  names.add("keyByte")
  names.add("keyIs")
}

/**
 * The names of every method of the receiver and every helper the code for a
 * route from `roots` calls. `union` says the roots are the variants of the
 * union the route's value is.
 */
const jsonRouteNames = (
  program: CheckedProgram,
  table: TypeTable,
  role: i32,
  roots: StructInfo[],
  union: boolean
): StringSet => {
  const names = new StringSet()
  const decode = role !== JSON_ENCODE
  if (decode && union) {
    jsonAddUnionMethods(names)
  }
  if (!decode && union) {
    // A union's encoding writes `null` for a tag no variant has.
    names.add("nullValue")
  }
  if (decode) {
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
  for (const root of roots) {
    if (root.jsonNumber) {
      names.add(decode ? "number" : "jsonEncodeNumber")
    }
  }
  for (const f of jsonValues(program, table, roots)) {
    const cls = f.cls
    if (cls !== null && cls.jsonNumber) {
      names.add(decode ? "number" : "jsonEncodeNumber")
    }
    for (const variant of f.variants) {
      if (variant.jsonNumber) {
        names.add(decode ? "number" : "jsonEncodeNumber")
      }
    }
    const isUnion = f.kind === JSON_FIELD_UNION || f.kind === JSON_FIELD_UNION_ARRAY
    const holdsObject =
      f.kind === JSON_FIELD_CLASS || f.kind === JSON_FIELD_CLASS_ARRAY || f.kind === JSON_FIELD_MAP || isUnion
    const isEnum = f.kind === JSON_FIELD_ENUM || f.kind === JSON_FIELD_ENUM_ARRAY
    const isArray =
      f.kind === JSON_FIELD_CLASS_ARRAY ||
      f.kind === JSON_FIELD_ENUM_ARRAY ||
      f.kind === JSON_FIELD_UNION_ARRAY
    if (f.kind === JSON_FIELD_TAG) {
      // A tag is checked against its wire string, and written as one.
      names.add(decode ? "tagValue" : "string")
      continue
    }
    if (decode) {
      if (isUnion) {
        jsonAddUnionMethods(names)
      }
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
        names.add("mapRoom")
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
    // A union's encoding writes `null` for a tag no variant has, so it calls
    // `nullValue` whether or not the field is nullable.
    if ((f.nullable && holdsObject) || isUnion) {
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
  const roots = jsonRootsOf(program, table, instance.typeArgs[0])
  if (receiver === null || roots.length === 0) {
    return out
  }
  const union = table.isUnion(table.stripNull(instance.typeArgs[0]))
  const names = jsonRouteNames(program, table, instance.jsonRoute, roots, union)
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
  const decode = instance.jsonRoute !== JSON_ENCODE
  const methods = jsonMapMethods(instance.jsonRoute)
  for (const map of jsonMaps(program, table, roots, false)) {
    for (const name of methods) {
      const method = map.method(name)
      if (method !== null) {
        out.push(method)
      }
    }
  }
  if (decode) {
    for (const info of jsonMadeClasses(program, table, roots, union)) {
      const ctor = info.ctor
      if (ctor !== null) {
        out.push(ctor)
      }
    }
    for (const map of jsonMaps(program, table, roots, true)) {
      const ctor = map.ctor
      if (ctor !== null) {
        out.push(ctor)
      }
    }
  }
  return out
}
