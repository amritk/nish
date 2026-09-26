// WP18: generics by monomorphisation, for stage1 (`src/checker/generics.ts`).
//
// A generic function is a *template*: its body is never checked and never
// emitted. Every call the checker resolves picks a tuple of concrete type
// arguments, and the pair (template, tuple) names one ordinary function —
// `identity$i32` — whose signature, body, side tables, attribute facts and IR
// are indistinguishable from the monomorphic twin somebody would have written
// by hand.
//
// Three things here are worth reading before the code, and they are the same
// three stage0's header names, because the two are one compiler:
//
//   - **A type parameter is never a type.** The template's annotations stay as
//     syntax and are resolved once per instantiation with `T` bound in
//     `ctx.typeBindings`, which `resolveReference` consults — so the
//     `TypeTable` never holds a type variable and no pass below the signature
//     level has one to handle.
//   - **One AST, N type assignments.** `identity`'s `return x;` is one node
//     with two types, so each instantiation owns a copy of the node-keyed side
//     tables and every pass that walks a body installs them first
//     (`CheckedProgram.enterInstance`).
//   - **Termination is a rule, not a number.** An instantiation that asks for
//     one of the same template whose type argument strictly *contains* its own
//     is the shape that cannot terminate (`grow<T>` asking for `grow<T[]>`),
//     and it is refused by name. The caps are the backstop for anything the
//     rule does not see, and they say they are a limit rather than a rule.

import { resolveType } from "./annotations";
import { LANGUAGE } from "./branding";
import { rejectForeignPointer } from "./annotations";
import { CheckContext } from "./context";
import { checkSignatureBody } from "./checker";
import { collectFunctionSignature } from "./declarations";
import { internalErrorFor } from "./ice";
import { checkExpression } from "./expressions";
import { StringMap, StringSet } from "./map";
import { parallelRole, recordParallelCall } from "./parallel";
import { collectMethodSignature, collectStructMembers, noteStructNames, referencedStructNames } from "./structs";
import {
  FLAG_FOREIGN,
  N_ARRAY,
  N_ARROW,
  N_BIGINT,
  N_BINARY,
  N_BLOCK,
  N_CALL,
  N_CLASS,
  N_CONDITIONAL,
  N_CONSTRUCTOR,
  N_EMPTY,
  N_FALSE,
  N_FIELD,
  N_IDENT,
  N_INDEX,
  N_INTERFACE,
  N_LIST,
  N_MEMBER,
  N_METHOD,
  N_NEW,
  N_NULL,
  N_NUMBER,
  N_OBJECT,
  N_PARAM,
  N_PAREN,
  N_STRING,
  N_SUPER,
  N_TEMPLATE,
  N_THIS,
  N_TRUE,
  N_TYPE_ARRAY,
  N_TYPE_FUNCTION,
  N_TYPE_NULL,
  N_TYPE_PAREN,
  N_TYPE_READONLY,
  N_TYPE_REF,
  N_TYPE_UNION,
  N_UNARY,
  Node,
} from "./nodes";
import {
  ConstraintList,
  DeferredConstraint,
  DeferredInstance,
  FunctionBindings,
  FunctionSig,
  ImportBinding,
  Instantiation,
  MAP_GET_OR_INSERT,
  MAP_HASH_KEY,
  MAP_NONE,
  MAP_RESERVE,
  MAP_SAME_KEY,
  MAP_STORED_KEY,
  ROLE_FUNCTION,
  STRUCT_CLASS,
  StructInfo,
  StructInstantiation,
  StructTemplateInfo,
  TemplateInfo,
} from "./program";
import { Local, STORAGE_PARAM, Scope, TypeOrigin, unknownOrigin } from "./symbols";
import {
  intBits,
  K_ARRAY,
  K_NULLABLE,
  K_RESULT,
  K_STRUCT,
  R_UNKNOWN,
  T_BOOL,
  T_ERROR,
  T_F32,
  T_F64,
  T_STRING,
  T_VOID,
  TypeTable,
} from "./types";

/**
 * WP32: whether `template` is the global `Map` or `Set`, the two classes
 * `std/collections.ts` declares (docs/wp32-map.md §4.2). A program's own `Map`
 * is an ordinary class and none of the rules about the global apply to it.
 */
export const isCollectionTemplate = (template: StructTemplateInfo): boolean =>
  template.home.program.isCollections() && (template.sourceName === "Map" || template.sourceName === "Set");

/**
 * WP32: why `args` cannot instantiate the global `Map` or `Set`, or `""`
 * (docs/wp32-map.md §5.1). A key is hashed and compared by value, or by
 * identity for a class instance, so it is a string, a number of any width, a
 * boolean, an enum or a class; an interface is stored inline and has no
 * identity, and an array, a nullable type and a `Result` wait for a program
 * that needs one. A value is stored as it is, so it is anything but `void` and
 * an interface, whose record would be copied in rather than shared.
 */
export const collectionArgumentRefusal = (ctx: CheckContext, template: StructTemplateInfo, args: i32[]): string => {
  if (args.length !== template.typeParams.length || args.length === 0) {
    return "";
  }
  const table = ctx.table;
  const shown = instanceDisplayName(table, template.sourceName, args);
  const key = args[0];
  if (key !== T_ERROR && !isCollectionKey(ctx, key)) {
    return (
      `\`${table.typeName(key)}\` cannot be the key type of \`${shown}\`: a key is hashed and compared by value, or by identity for a class instance, ` +
      "so it is a string, a number of any width, a boolean, an enum or a class, and not an interface, an array, a nullable type or a `Result`"
    );
  }
  if (args.length < 2) {
    return "";
  }
  const value = args[1];
  if (value === T_VOID || isInterfaceType(ctx, value)) {
    return (
      `\`${table.typeName(value)}\` cannot be the value type of \`${shown}\`: a value is stored in the table as it is, ` +
      "so it may not be `void`, nor an interface, whose record would be copied in rather than shared (use a class)"
    );
  }
  return "";
};

/** A key type of §5.1: a string, a scalar, an enum, or a class held by identity. */
const isCollectionKey = (ctx: CheckContext, type: i32): boolean => {
  const table = ctx.table;
  if (type === T_STRING || type === T_BOOL || type === T_F32 || type === T_F64 || intBits(type) > 0 || table.isEnum(type)) {
    return true;
  }
  if (!table.isStruct(type)) {
    return false;
  }
  const info = ctx.program.struct(table.nameOf(type));
  return info !== null && info.kind === STRUCT_CLASS;
};

/** Whether `type` is an interface: a record stored inline wherever it is held. */
const isInterfaceType = (ctx: CheckContext, type: i32): boolean => {
  if (!ctx.table.isStruct(type)) {
    return false;
  }
  const info = ctx.program.struct(ctx.table.nameOf(type));
  return info !== null && info.kind !== STRUCT_CLASS;
};

/**
 * WP32: the `MAP_*` role of an instantiation of `template`: `hashKey`,
 * `sameKey` and `storedKey` in `std/collections.ts`, and `reserve` and
 * `getOrInsert` in `std/map.ts`, are lowered in place by the emitter
 * (`self/emit_map.ts`), and every other template is what it says.
 */
export const mapIntrinsicRole = (template: TemplateInfo): i32 => {
  if (template.owner === null && template.home.program.isMapExtras()) {
    // WP32 S5: `nish/map`'s two, whose bodies are what Node runs (§9.2).
    if (template.sourceName === "reserve") {
      return MAP_RESERVE;
    }
    return template.sourceName === "getOrInsert" ? MAP_GET_OR_INSERT : MAP_NONE;
  }
  if (template.owner !== null || !template.home.program.isCollections()) {
    return MAP_NONE;
  }
  if (template.sourceName === "hashKey") {
    return MAP_HASH_KEY;
  }
  if (template.sourceName === "storedKey") {
    return MAP_STORED_KEY;
  }
  return template.sourceName === "sameKey" ? MAP_SAME_KEY : MAP_NONE;
};

/** Whether an instantiated struct is an instance of the global `Map`, rather than of `Set` or of anything else. */
export const isMapOwner = (info: StructInfo): boolean => {
  const instance = info.instance;
  return instance !== null && instance.template.sourceName === "Map";
};

/** The same question about an instantiated struct: `Map$str$i32` is one, and so is `Set$i32`. */
export const isCollectionStruct = (info: StructInfo): boolean => {
  const instance = info.instance;
  return instance !== null && isCollectionTemplate(instance.template);
};

/**
 * This compiler's instantiation limits. They are a backstop for a program that
 * asks for an absurd number of specialisations without tripping the termination
 * rule, not a statement about the language, and the diagnostic says so.
 */
export const MAX_INSTANTIATIONS_PER_TEMPLATE: i32 = 256;
export const MAX_INSTANTIATIONS: i32 = 4096;

/** The ancestor a request grows out of, and which of its type arguments grew. */
export class Expansion {
  ancestor: Instantiation;
  index: i32;

  constructor(ancestor: Instantiation, index: i32) {
    this.ancestor = ancestor;
    this.index = index;
  }
}

/** The same pair for the struct half of the rule (WP18 G5). */
export class StructExpansion {
  ancestor: StructInstantiation;
  index: i32;

  constructor(ancestor: StructInstantiation, index: i32) {
    this.ancestor = ancestor;
    this.index = index;
  }
}

/** The type parameter list of an `N_FUNCTION`: its fifth child (WP18). */
export const typeParameterList = (decl: Node): Node => decl.children.length > 4 ? decl.children[4] : decl.children[0];

/**
 * The type parameter list of an `N_CLASS` (fifth child) or an `N_INTERFACE`
 * (third), both appended by WP18 G5 so the children that were there keep their
 * positions. The guard is the same one `typeParameterList` carries: a node
 * built before the list existed answers with something harmless rather than
 * reading past its own children.
 */
export const structTypeParameterList = (decl: Node): Node => {
  const at = decl.kind === N_CLASS ? 4 : 2;
  return decl.children.length > at ? decl.children[at] : decl.children[0];
};

/** Whether a class or interface declaration carries `<T, ...>`. */
export const isGenericStruct = (decl: Node): boolean => {
  const list = structTypeParameterList(decl);
  return list.kind === N_LIST && list.children.length > 0;
};

/** A struct template's declared type parameter names, in order. */
export const collectStructTypeParamNames = (decl: Node): string[] => {
  const names: string[] = [];
  for (const node of structTypeParameterList(decl).children) {
    if (node.kind === N_IDENT) {
      names.push(node.text);
    }
  }
  return names;
};

/** Whether a function declaration carries `<T, ...>`. */
export const isGenericFunction = (decl: Node): boolean => {
  const list = typeParameterList(decl);
  return list.kind === N_LIST && list.children.length > 0;
};

/**
 * The LLVM symbol for one instantiation: the template's name, then `$` and the
 * mangling of each type argument in order (`docs/wp18-generics.md` §3c). The
 * mangling is prefix-coded, so the arguments are self-delimiting and the whole
 * name splits again at the first `$` — which is why `$` may not appear in a
 * declared name.
 */
export const instanceSymbol = (table: TypeTable, base: string, args: i32[]): string => {
  let out = base;
  for (const arg of args) {
    out = `${out}$${table.mangle(arg)}`;
  }
  return out;
};

/** `identity<i32>`: the source spelling, for diagnostics and the dump. */
export const instanceDisplayName = (table: TypeTable, base: string, args: i32[]): string => {
  let out = "";
  let i = 0;
  while (i < args.length) {
    out = i === 0 ? table.typeName(args[i]) : `${out}, ${table.typeName(args[i])}`;
    i = i + 1;
  }
  return `${base}<${out}>`;
};

/**
 * The struct id of one class instantiation, with its source spelling recorded
 * beside it (WP18 §6.7): `Box$i32` to LLVM, `Box<i32>` to `typeName`. Every
 * place that mints an instantiated struct id goes through here, so the id never
 * exists without its display name.
 */
export const instanceStructType = (table: TypeTable, base: string, args: i32[]): i32 => {
  const type = table.structOf(instanceSymbol(table, base, args));
  table.setDisplayName(type, instanceDisplayName(table, base, args));
  return type;
};

/**
 * The canonical form of an inferred type argument: a `Result` narrowed to one
 * arm is the same type as the un-narrowed one, and the mangling already ignores
 * the proof, so the tuple has to as well or two ids would ask for one symbol.
 */
export const canonicalArgument = (table: TypeTable, type: i32): i32 => table.isResult(type) ? table.withState(type, R_UNKNOWN) : type;

/**
 * Whether `inner` occurs as a subterm of `outer`. The termination rule is
 * stated over this: an instantiation that asks for one of the same template
 * with an argument that *contains* its own has put that argument under a type
 * constructor, and the chain it starts has no end.
 */
export const containsType = (ctx: CheckContext, inner: i32, outer: i32): boolean => {
  if (inner === outer) {
    return true;
  }
  const table = ctx.table;
  const kind = table.kindOf(outer);
  if (kind === K_ARRAY || kind === K_NULLABLE) {
    return containsType(ctx, inner, table.refOf(outer));
  }
  if (kind === K_RESULT) {
    return containsType(ctx, inner, table.okOf(outer)) || containsType(ctx, inner, table.errOf(outer));
  }
  if (kind === K_STRUCT) {
    // An instantiated class is an ordinary struct and carries no arguments of
    // its own, so they are read back out of the instantiation its mangled name
    // belongs to. Without this, `grow<T>` asking for `grow<Box<T>>` would look
    // like a request for an unrelated named type and would not terminate.
    const instance = ctx.program.structArguments(table.nameOf(outer));
    if (instance !== null) {
      for (const arg of instance.typeArgs) {
        if (containsType(ctx, inner, arg)) {
          return true;
        }
      }
    }
  }
  return false;
};

/**
 * Which type argument of `previous` this request puts under a type constructor,
 * or -1 when none of them grew. Shared by the function and the struct halves of
 * the rule, because both say the same thing about the same tuples.
 */
export const growingArgument = (ctx: CheckContext, previous: i32[], args: i32[]): i32 => {
  let i = 0;
  while (i < args.length) {
    if (previous[i] !== args[i] && containsType(ctx, previous[i], args[i])) {
      return i;
    }
    i = i + 1;
  }
  return -1;
};

/**
 * The ancestor instantiation of the same template whose type arguments this
 * request grows, or `null` when the request is finite by §4's rule.
 *
 * Walking the whole chain rather than only the immediate parent is what covers
 * mutual recursion: `f<T>` asking for `g<T>` asking for `f<T[]>` expands, and
 * neither of its two edges does so on its own.
 */
export const expandingAncestor = (
  ctx: CheckContext,
  from: Instantiation | null,
  template: TemplateInfo,
  args: i32[]
): Expansion | null => {
  const wanted = chainArguments(template, args);
  let at = from;
  while (at !== null) {
    // A member of an instantiated class carries no function template, so the
    // narrowing is also the test that this link of the chain is one of ours.
    //
    // WP18 G8: "ours" is the same *declaration*, not the same template object.
    // A generic method is minted once per receiver, so a chain that changes
    // the receiver as it recurses (`Box<T>`'s `m<U>` asking for
    // `Box<U>.m<U[]>`) meets a different template at every step; comparing the
    // declaration and the receiver's arguments followed by the method's is
    // what sees it grow. For a function the two tests are one, because a
    // function template is one object per declaration.
    const owner = at.template;
    if (owner !== null && owner.decl === template.decl) {
      const index = growingArgument(ctx, chainArguments(owner, at.typeArgs), wanted);
      if (index >= 0) {
        return new Expansion(at, index);
      }
    }
    at = at.from;
  }
  return null;
};

/**
 * The tuple the termination rule compares for one request of `template` at
 * `args`: `args` for a generic function, and for a generic method the
 * receiver's type arguments followed by the method's (WP18 G8), because the
 * receiver is part of what an instantiation of a method is.
 */
export const chainArguments = (template: TemplateInfo, args: i32[]): i32[] => {
  const receiver = receiverOf(template);
  if (receiver === null) {
    return args;
  }
  const out: i32[] = [];
  for (const arg of receiver.typeArgs) {
    out.push(arg);
  }
  for (const arg of args) {
    out.push(arg);
  }
  return out;
};

/**
 * The instantiated class a generic method's receiver is (WP18 G8), whose
 * parameters are bound in the method's body; `null` for a function and for a
 * method of a declared class.
 */
const receiverOf = (template: TemplateInfo): StructInstantiation | null => {
  const owner = template.owner;
  return owner === null ? null : owner.instance;
};

/** The type parameter names `chainArguments` lines up with, in the same order. */
const chainParameters = (template: TemplateInfo): string[] => {
  const receiver = receiverOf(template);
  if (receiver === null) {
    return template.typeParams;
  }
  const out: string[] = [];
  for (const name of receiver.template.typeParams) {
    out.push(name);
  }
  for (const name of template.typeParams) {
    out.push(name);
  }
  return out;
};

/**
 * The struct half of the same rule (WP18 G5). A field's type is resolved while
 * the struct is being collected rather than while a body runs, so the chain
 * this walks is the one `ctx.currentStructInstance` maintains: the struct whose
 * members are being collected, or the struct whose method body is being
 * checked. `class Nest<T> { inner: Nest<T[]> | null }` is the shape it exists
 * for, and `reject_generic_expanding_field` is its case.
 *
 * The ancestor is also the answer, in the half of that chain where the request
 * is a declaration's: a field or a member signature refused while the struct
 * is being collected is handed `ancestor.info` rather than nothing, so the
 * class the programmer did write keeps its field and its layout. A request
 * from a method *body* is an expression's and keeps the refusal's throw. §4a
 * of `docs/wp18-generics.md` is the argument for that and what it costs.
 */
export const expandingStructAncestor = (
  ctx: CheckContext,
  from: StructInstantiation | null,
  template: StructTemplateInfo,
  args: i32[]
): StructExpansion | null => {
  let at = from;
  while (at !== null) {
    if (at.template === template) {
      const index = growingArgument(ctx, at.typeArgs, args);
      if (index >= 0) {
        return new StructExpansion(at, index);
      }
    }
    at = at.from;
  }
  return null;
};

/**
 * Bind the template's type parameters by matching one declared parameter
 * annotation against the type of the argument written for it. Only the *shape*
 * of the annotation is read, so nothing here resolves a type: `T[]` against
 * `i32[]` binds `T := i32` without either side becoming a type for `T`.
 *
 * First binding wins. A second, incompatible occurrence is not reported here —
 * the ordinary argument check against the instantiated signature reports it,
 * naming both types the way every other argument mismatch does.
 */
export const unifyAnnotation = (
  ctx: CheckContext,
  annotation: Node,
  arg: i32,
  names: StringSet,
  bindings: StringMap
): void => {
  const table = ctx.table;
  if (annotation.kind === N_TYPE_PAREN) {
    unifyAnnotation(ctx, annotation.children[0], arg, names, bindings);
    return;
  }
  if (annotation.kind === N_TYPE_ARRAY) {
    if (table.kindOf(arg) === K_ARRAY) {
      unifyAnnotation(ctx, annotation.children[0], table.refOf(arg), names, bindings);
    }
    return;
  }
  if (annotation.kind === N_TYPE_READONLY) {
    // The modifier changes who may write through the array, not its shape.
    unifyAnnotation(ctx, annotation.children[0], arg, names, bindings);
    return;
  }
  if (annotation.kind === N_TYPE_UNION) {
    // `T | null` against a nullable argument binds `T` to the inner type, and
    // against a plain pointer binds it to the argument itself, because `T` is
    // assignable into `T | null` and the call would have been legal.
    let member: Node | null = null;
    let count = 0;
    for (const part of annotation.children) {
      if (part.kind !== N_TYPE_NULL) {
        member = part;
        count = count + 1;
      }
    }
    if (count === 1 && member !== null) {
      unifyAnnotation(ctx, member, table.stripNull(arg), names, bindings);
    }
    return;
  }
  if (annotation.kind !== N_TYPE_REF) {
    return;
  }
  const name = annotation.text;
  const list = annotation.children[0];
  const argc = list.kind === N_LIST ? list.children.length : 0;
  if (argc === 0) {
    if (names.has(name) && bindings.get(name, -1) < 0) {
      bindings.set(name, canonicalArgument(table, arg));
    }
    return;
  }
  if ((name === "Array" || name === "ReadonlyArray") && argc === 1 && table.kindOf(arg) === K_ARRAY) {
    unifyAnnotation(ctx, list.children[0], table.refOf(arg), names, bindings);
    return;
  }
  if (name === "Result" && argc === 2 && table.isResult(arg)) {
    unifyAnnotation(ctx, list.children[0], table.okOf(arg), names, bindings);
    unifyAnnotation(ctx, list.children[1], table.errOf(arg), names, bindings);
    return;
  }
  // A user generic: `Box<T>` against a `Box$i32` argument binds `T := i32`. The
  // argument's own type carries no type arguments, because an instantiated
  // class is an ordinary struct, so they are read back out of the instantiation
  // the mangled name belongs to.
  if (table.kindOf(arg) === K_STRUCT) {
    const instance = ctx.program.structArguments(table.nameOf(arg));
    if (instance !== null && instance.template.sourceName === name && instance.typeArgs.length === argc) {
      let i = 0;
      while (i < argc) {
        unifyAnnotation(ctx, list.children[i], instance.typeArgs[i], names, bindings);
        i = i + 1;
      }
    }
  }
};

/** Whether an annotation mentions one of `names`, i.e. whether it needs an instantiation to resolve. */
export const mentionsTypeParam = (annotation: Node, names: StringSet): boolean => {
  if (annotation.kind === N_TYPE_REF) {
    const list = annotation.children[0];
    const argc = list.kind === N_LIST ? list.children.length : 0;
    // A bare parameter cannot take type arguments, so the name alone decides.
    if (argc === 0 && names.has(annotation.text)) {
      return true;
    }
  }
  for (const child of annotation.children) {
    if (mentionsTypeParam(child, names)) {
      return true;
    }
  }
  return false;
};

/** The set of a template's type parameter names, for `unifyAnnotation` and `mentionsTypeParam`. */
export const typeParamSet = (template: TemplateInfo): StringSet => {
  const names = new StringSet();
  for (const name of template.typeParams) {
    names.add(name);
  }
  return names;
};

/**
 * The message for a request that would not terminate. It names the type
 * argument that grew and the two shapes the rule accepts, never a number: a
 * user who sees it has to change the call, not raise a limit.
 */
export const nonTerminatingMessage = (
  table: TypeTable,
  template: TemplateInfo,
  ancestor: Instantiation,
  args: i32[],
  index: i32
): string => {
  // A generic method's two ends may have different receivers (WP18 G8), so
  // each is spelled from its own template; for a function both are one.
  let earlier = template;
  const own = ancestor.template;
  if (own !== null) {
    earlier = own;
  }
  const from = instanceDisplayName(table, earlier.sourceName, ancestor.typeArgs);
  const to = instanceDisplayName(table, template.sourceName, args);
  const grew = table.typeName(chainArguments(earlier, ancestor.typeArgs)[index]);
  return (
    `Monomorphising \`${earlier.sourceName}\` would not terminate: \`${from}\` asks for \`${to}\`, which puts ` +
    `\`${grew}\` under a type constructor instead of passing it on, so the chain has no end; pass ` +
    `\`${chainParameters(template)[index]}\` itself, or a type that does not mention it`
  );
};

/**
 * The message for a field or annotation whose instantiation would not
 * terminate. A field, not a call, is what names the next one, so the sentence
 * says "names" where the function half's says "asks for"; everything else about
 * it is the same, including that it quotes the concrete chain, never a depth.
 */
export const nonTerminatingStructMessage = (
  table: TypeTable,
  template: StructTemplateInfo,
  ancestor: StructInstantiation,
  args: i32[],
  index: i32
): string => {
  const from = instanceDisplayName(table, template.sourceName, ancestor.typeArgs);
  const to = instanceDisplayName(table, template.sourceName, args);
  const grew = table.typeName(ancestor.typeArgs[index]);
  return (
    `Monomorphising \`${template.sourceName}\` would not terminate: \`${from}\` names \`${to}\`, which puts ` +
    `\`${grew}\` under a type constructor instead of passing it on, so the chain has no end; name ` +
    `\`${template.typeParams[index]}\` itself, or a type that does not mention it`
  );
};

/**
 * Write down a request for an imported template and answer the type it will
 * resolve to (WP18 G7).
 *
 * The arguments are resolved here, in the scope the annotation sits in, exactly
 * as a local template's are; only the request itself waits, because the module
 * that answers it has not bound its own imports yet. The name it answers with
 * is the one the request is going to mint, so the annotation is already right
 * and nothing has to be patched up afterwards.
 */
export const deferInstantiation = (ctx: CheckContext, imp: ImportBinding, written: Node, at: Node): i32 => {
  const args: i32[] = [];
  if (written.kind === N_LIST) {
    for (const node of written.children) {
      args.push(resolveType(node, ctx));
    }
  }
  ctx.program.deferredInstances.push(new DeferredInstance(imp, args, at));
  return instanceStructType(ctx.table, imp.importedName, args);
};

/**
 * The struct one written type-argument list names (WP18 G5). All three
 * positions that may carry one go through here — an annotation (`Box<i32>`),
 * `new Box<i32>(v)` and an `implements Container<T>` clause — so the arity rule
 * is stated once and a reader is told the same thing wherever the mistake was
 * made. The arguments are resolved in the scope the list sits in, which is what
 * makes `Box<T>` inside another template and `Box<Box<i32>>` work with no case
 * of their own.
 */
export const instantiateWritten = (
  ctx: CheckContext,
  template: StructTemplateInfo,
  written: Node,
  at: Node
): StructInfo | null => {
  const count = written.kind === N_LIST ? written.children.length : 0;
  if (count !== template.typeParams.length) {
    let example = "";
    let i = 0;
    while (i < template.typeParams.length) {
      example = i === 0 ? "number" : `${example}, number`;
      i = i + 1;
    }
    ctx.error(
      at,
      `\`${template.sourceName}\` is generic: it must be written with its type arguments, e.g. ` +
        `\`${template.sourceName}<${example}>\``
    );
    return null;
  }
  const args: i32[] = [];
  let i = 0;
  while (i < count) {
    args.push(resolveType(written.children[i], ctx));
    i = i + 1;
  }
  return instantiateStruct(ctx, template, args, at);
};

/**
 * Where a request was written, as the module that answers it needs it (WP18 G7).
 *
 * A template is instantiated in the scope it was *declared* in, so the work
 * crosses a module boundary while the mistake a user can make with it does not:
 * a termination refusal or a cap is about this call, in this file, inside
 * whichever instantiation's body was being checked when it was made. All three
 * therefore travel with the request rather than being read off the answering
 * module, whose own cursors are about its own work.
 */
export class RequestSite {
  /** The module the request was written in; every refusal about it is reported there. */
  asker: CheckContext;
  /** The instantiation whose body made the request, or `null` for ordinary code. */
  fromFunction: Instantiation | null;
  /** The struct instantiation whose members or method body made it, if one did. */
  fromStruct: StructInstantiation | null;

  constructor(asker: CheckContext) {
    this.asker = asker;
    this.fromFunction = asker.currentInstance;
    this.fromStruct = asker.currentStructInstance;
  }
}

/**
 * Register `info` here as a layout this module can hold values of but does not
 * define (WP18 G7), and answer whether it was new.
 *
 * It is `closeReachableStructs` for one struct. `symbols` is what the two
 * directions of a forwarded request disagree about: an instantiated class
 * coming *back* brings its constructor and methods, which the module that asked
 * for it calls, while a type argument going *out* brings only a layout — the
 * language has no way to call a member of a type parameter, so the template's
 * module never emits a call to one, and declaring the symbols anyway would put
 * a `declare` in front of a definition `--strict-exports` made `internal` in
 * the module it came from. Neither direction touches `typeNames`: nobody may
 * write `Box$i32`, and `identity<Point>` does not put `Point` in scope in the
 * module that declares `identity`.
 */
const reachForeignLayout = (ctx: CheckContext, info: StructInfo, symbols: boolean): boolean => {
  if (ctx.program.structs.has(info.name)) {
    return false;
  }
  if (symbols) {
    ctx.program.reachableStructs.push(ctx.program.structList.length);
  }
  ctx.program.addStruct(info.name, info);
  return true;
};

/** `reachForeignLayout` over `root` and everything its members reach, in `from`'s registry. */
export const registerForeignLayouts = (
  ctx: CheckContext,
  root: StructInfo,
  from: CheckContext,
  symbols: boolean
): void => {
  const pending: StructInfo[] = [];
  if (reachForeignLayout(ctx, root, symbols)) {
    pending.push(root);
  }
  // A cursor rather than `pop()`, and `src/` walks it the same way so the two
  // registries end up in the same order: `pop()` answers `T` in this language
  // and `T | undefined` in `lib.es5`, which is the one divergence
  // `runtime/nish.d.ts` documents, and the suite's `tsc` pass over `self/`
  // tolerates it in exactly one file. Breadth-first is no worse than
  // depth-first here — everything reachable is registered either way — and it
  // costs one `i32`.
  let at = 0;
  while (at < pending.length) {
    const info = pending[at];
    at = at + 1;
    const names = new StringSet();
    referencedStructNames(ctx.table, info, names);
    let i = 0;
    while (i < names.size()) {
      const next = from.program.struct(names.at(i));
      if (next !== null && reachForeignLayout(ctx, next, symbols)) {
        pending.push(next);
      }
      i = i + 1;
    }
  }
};

/**
 * Make every layout a type argument mentions visible in the answering module
 * (WP18 G7).
 *
 * A template is monomorphised in its own module, so `identity<Point>` puts a
 * `%struct.Point` — and a `getelementptr` through its fields — into a module
 * that may never have heard of `Point`. The layout comes from the module that
 * made the request, which had to have it to write the request down.
 */
export const adoptArgumentLayouts = (ctx: CheckContext, args: i32[], site: RequestSite): void => {
  if (site.asker === ctx) {
    return;
  }
  const names = new StringSet();
  for (const arg of args) {
    noteStructNames(ctx.table, arg, names);
  }
  let i = 0;
  while (i < names.size()) {
    const info = site.asker.program.struct(names.at(i));
    if (info !== null) {
      registerForeignLayouts(ctx, info, site.asker, false);
    }
    i = i + 1;
  }
};

/**
 * One instantiation this module calls and another module defines. Recorded once
 * per symbol, in request order, so the `declare`s the emitter writes are in the
 * order the calls were checked in.
 */
export const useExternalInstance = (ctx: CheckContext, sig: FunctionSig): void => {
  if (ctx.program.externalInstanceNames.add(sig.name)) {
    ctx.program.externalInstances.push(sig);
  }
};

/**
 * The struct instantiation request (WP18 G5). Answers the ordinary `StructInfo`
 * one (struct template, type-argument tuple) names, creating it the first time
 * it is asked for — and collecting its members immediately rather than queueing
 * them, because the answer is a *type*, and a type has to have a layout the
 * moment an annotation resolves to it.
 *
 * What is queued instead is each method's and the constructor's *body*, on the
 * same worklist a generic function's body goes on. That is the whole of why an
 * instantiated class costs so little: `info` is an ordinary struct, its members
 * are ordinary signatures, and the only new thing about them is the side-table
 * overlay every specialised body already needed.
 */
export const instantiateStruct = (
  ctx: CheckContext,
  template: StructTemplateInfo,
  args: i32[],
  at: Node
): StructInfo | null => {
  const home = template.home;
  const info = instantiateStructHere(home, template, args, at, new RequestSite(ctx));
  // The layout and its members are the declaring module's; this module holds
  // values of the type, so it needs the `%struct` declaration and the
  // `declare`s for its constructor and methods — which is exactly what an
  // imported *declared* class gets through `reachableStructs`.
  if (info !== null && home !== ctx) {
    registerForeignLayouts(ctx, info, home, true);
  }
  return info;
};

/** The answering half of `instantiateStruct`: this module declares `template`. */
export const instantiateStructHere = (
  ctx: CheckContext,
  template: StructTemplateInfo,
  args: i32[],
  at: Node,
  site: RequestSite
): StructInfo | null => {
  // WP32: the global `Map` and `Set` hold a key a probe can hash and compare,
  // and a value it can store as it is. Refused where the type was written,
  // before the template's own body could refuse it in words about its fields.
  if (isCollectionTemplate(template) && !site.asker.program.isCollections()) {
    const refusal = collectionArgumentRefusal(site.asker, template, args);
    if (refusal.length > 0) {
      site.asker.error(at, refusal);
      return null;
    }
  }
  adoptArgumentLayouts(ctx, args, site);
  // WP18 G6: before the tuple is looked up, so every request is held to the
  // constraint where it was written, not only the first one to name the tuple.
  if (!checkStructConstraints(ctx, template, args, at, site.asker)) {
    return null;
  }
  const name = instanceSymbol(ctx.table, template.sourceName, args);
  const existing = ctx.program.structInstance(name);
  if (existing !== null) {
    return existing.info;
  }
  // TODO (WP27 S2, known gap): no `rejectForeignPointer` loop here, the way
  // there is one in `instantiate` below. A generic class at `CPtr` is
  // refused by whichever member rule the monomorphised class trips — the field
  // rule, the array-element rule, the parameter rule of a method that takes a
  // `T` — which is every shape that lays the type out or puts it across an
  // exported boundary. It is not the whole of the rule: a template that never
  // mentions `T` in a member (`class Empty<T> { n: i32 = 0; }`) compiles
  // `new Empty<CPtr>()`, here and in `src/checker/index.ts`, which agree.
  // `docs/wp27-ffi.md` §7a.

  // Termination, the struct half. A field whose type puts one of the struct's
  // own type arguments under a constructor starts a chain with no end, and it
  // is refused by name rather than by a depth count.
  const growing = expandingStructAncestor(ctx, site.fromStruct, template, args);
  if (growing !== null) {
    const asker = site.asker;
    const wasErrored = asker.errored;
    asker.error(at, nonTerminatingStructMessage(ctx.table, template, growing.ancestor, args, growing.index));
    // WP18 §4a: the recovery is a *declaration's*, and this is where that is
    // decided. `collectInstanceMembers` is the one caller that clears
    // `ctx.currentInstance` while `ctx.currentStructInstance` is set, so a
    // null one here means the struct's own members are being laid out: the
    // field has to resolve to something or the class the programmer did write
    // loses it, and the ancestor is the something. `ctx.error` does two things
    // — report, and set `errored` so the rest of the statement is silent — and
    // only the first is wanted here, because stage0 reports this one through
    // `report` rather than `error` and carries on collecting the members after
    // it. Silencing them would be a difference `--parity` finds.
    if (site.fromFunction === null) {
      asker.errored = wasErrored;
      return growing.ancestor.info;
    }
    // Anywhere else the request came from an expression in a body, where the
    // answer is a value's type rather than a layout, and a substitute would be
    // consumed by the statement around it — `const z: string = new Nest<T[]>()`
    // would report the refusal and then a mismatch against `Nest$i32`, a symbol
    // nobody wrote. So `errored` stays set, which is this compiler's mirror of
    // the throw stage0 keeps there, and the statement ends with one diagnostic.
    return null;
  }
  // The caps answer with nothing, for the reason `instantiate` below says.
  if (template.count >= MAX_INSTANTIATIONS_PER_TEMPLATE) {
    site.asker.error(
      at,
      `\`${template.sourceName}\` has been instantiated ${MAX_INSTANTIATIONS_PER_TEMPLATE} times, which is ` +
        "this compiler's limit rather than a rule of the language"
    );
    return null;
  }
  if (ctx.program.instantiationList.length + ctx.program.structInstantiationList.length >= MAX_INSTANTIATIONS) {
    site.asker.error(
      at,
      `This module has reached ${MAX_INSTANTIATIONS} generic instantiations, which is this compiler's limit ` +
        "rather than a rule of the language"
    );
    return null;
  }

  const bindings = new StringMap();
  let i = 0;
  while (i < template.typeParams.length) {
    bindings.set(template.typeParams[i], args[i]);
    i = i + 1;
  }
  const type = instanceStructType(ctx.table, template.sourceName, args);
  const info = new StructInfo(name, template.kind, type, template.decl, template.origin);
  info.exported = template.exported;
  const instance = new StructInstantiation(template, args, info, bindings);
  instance.from = site.fromStruct;
  template.count = template.count + 1;
  // Registered before the members are collected, so a field that mentions the
  // struct's own instantiation (`next: Node<i32> | null`) finds it rather than
  // asking for it a second time.
  info.instance = instance;
  ctx.program.addStruct(name, info);
  ctx.program.addStructInstance(name, instance);
  collectInstanceMembers(ctx, instance);
  return info;
};

/**
 * The fields, layout and member signatures of one instantiated struct, with its
 * type parameters bound — and one queued body per method and constructor, each
 * with side tables of its own.
 */
export const collectInstanceMembers = (ctx: CheckContext, instance: StructInstantiation): void => {
  const savedBindings = ctx.typeBindings;
  const savedStruct = ctx.currentStructInstance;
  const savedInstance = ctx.currentInstance;
  const savedErrored = ctx.errored;
  ctx.typeBindings = instance.bindings;
  ctx.currentStructInstance = instance;
  // A request made while collecting these members belongs to *this* struct's
  // chain, not to whichever function body happened to name it first.
  ctx.currentInstance = null;
  const before = ctx.program.functions.length;
  collectStructMembers(ctx, instance.info);
  ctx.currentInstance = savedInstance;
  ctx.currentStructInstance = savedStruct;
  ctx.typeBindings = savedBindings;
  ctx.errored = savedErrored;
  // WP18 G7: the *template's* package, not this module's. They are the same one
  // whenever this module declares the template — which is always, because
  // `instantiateStruct` forwards a foreign request to the module that does —
  // and reading it from the template is what keeps that true by construction
  // rather than by a refusal somewhere else.
  const prefix = instance.template.home.program.symbolPrefix;
  let i = before;
  while (i < ctx.program.functions.length) {
    const sig = ctx.program.functions[i];
    i = i + 1;
    // A nested instantiation's member: collecting the fields above asked for
    // another struct, and that struct's own call here has already qualified and
    // queued its members.
    if (sig.instance !== null) {
      continue;
    }
    // WP21 S1: an instantiation's symbol is complete from the moment it is
    // minted, because `qualifySymbols` runs once at the end of pass 1 and an
    // instantiation may be created on either side of it.
    sig.name = `${prefix}${sig.name}`;
    const member = new Instantiation(null, instance.typeArgs, sig, instance.bindings, ctx.program.nodeTypes.length);
    member.owner = instance;
    member.from = savedInstance;
    sig.instance = member;
    ctx.pending.push(member);
  }
  ctx.pendingFinish.push(instance.info);
};

/**
 * The instantiation request. Answers the specialised signature for one
 * (template, type-argument tuple), creating and queueing it the first time it
 * is asked for — so a tuple seen twice is one `define`, and the FIFO queue
 * makes the enumeration order the discovery order in both compilers.
 */
export const instantiate = (
  ctx: CheckContext,
  template: TemplateInfo,
  args: i32[],
  functions: FunctionSig[],
  at: Node
): FunctionSig | null => {
  const home = template.home;
  const sig = instantiateHere(home, template, args, functions, at, new RequestSite(ctx));
  // The definition is the declaring module's; this module links against it.
  // WP32 S5: except `nish/map`'s two, which are lowered at every call and
  // never called, so there is nothing to link against or declare.
  if (sig !== null && home !== ctx && mapIntrinsicRole(template) === MAP_NONE) {
    useExternalInstance(ctx, sig);
  }
  return sig;
};

/**
 * The answering half of `instantiate`: this module declares `template`, so this
 * is where the specialised signature is created and queued the first time a
 * tuple is asked for.
 */
export const instantiateHere = (
  ctx: CheckContext,
  template: TemplateInfo,
  args: i32[],
  functions: FunctionSig[],
  at: Node,
  site: RequestSite
): FunctionSig | null => {
  adoptArgumentLayouts(ctx, args, site);
  // WP21 S1: inside the package that declares the template, which since G7 is
  // not necessarily the package that asked. `qualifySymbols` runs at the end of
  // pass 1 and instantiations are appended during pass 2, so an instantiation
  // never passes through it -- the prefix has to be part of the symbol from the
  // moment it is minted, or a generic would be the one declaration in the
  // language whose symbol escaped its package. It is read off the *template*
  // rather than off `ctx.program` so that the two cannot drift apart again if
  // the forwarding above ever changes shape.
  // WP18 G6, the function half: a call's type arguments are inferred, so the
  // request site is the call, which is where the user implied them. The
  // constraints were resolved when the template was registered, in pass 1,
  // and a call is never checked before pass 2.
  if (!checkConstraints(site.asker, ctx, template.sourceName, template.typeParams, template.constraints, args, at)) {
    return null;
  }
  // A generic method's symbol builds on its receiver's method symbol,
  // `Box$i32.pick` (WP18 G8, §15.8).
  const owner = template.owner;
  const base = owner === null ? template.sourceName : `${owner.name}.${template.decl.children[0].text}`;
  // WP29: a callee another module defines has to be callable from this one.
  for (const fn of functions) {
    exposeTo(ctx, fn);
  }
  const symbol = withFunctionArguments(
    instanceSymbol(ctx.table, template.home.program.symbolPrefix + base, args),
    functions
  );
  const existing = ctx.program.instantiation(symbol);
  if (existing !== null) {
    // One symbol is one (template, tuple): the mangling is injective because
    // no declared name that becomes a symbol holds a `$` (§3c, §15.8). If that
    // ever stops holding, answering with another template's signature is a
    // silent miscompile, so it is an internal error instead.
    const minted = existing.template;
    if (minted === null || minted !== template) {
      process.exit(
        internalErrorFor(`generics: \`${symbol}\` was minted by two templates (\`${template.sourceName}\`)`, ctx.table.json)
      );
    }
    return existing.sig;
  }
  // WP27 S2. A template's parameters and return type are checked against its
  // *type parameters*, so the rule that keeps a foreign pointer out of a
  // function this program defines cannot be applied where the other ones are —
  // an instantiation is the first point at which `T` is known to be one. The
  // message is the same, because it is the same rule.
  for (const arg of args) {
    if (rejectForeignPointer(site.asker, arg, `a type argument of \`${template.sourceName}\``, at)) {
      return null;
    }
  }
  // Termination: a request that puts one of its own type arguments under a
  // constructor is the shape whose chain has no end, refused by name rather
  // than by a depth count.
  //
  // This half always answers with nothing, and on purpose: a request for a
  // generic *function* is only ever made from an expression, and §4a's
  // recovery is a declaration's. `grow<i32[]>` is asked for from inside
  // `grow<i32>`'s own body, so handing the caller `grow<i32>`'s signature
  // would check `[x]` against `x: i32` and produce exactly the second
  // diagnostic about a mistake nobody made that §4a exists to stop. The struct
  // half spans both and chooses there; the caps below have nothing to choose,
  // because a cap refusal has no ancestor to hand back.
  const growing = expandingAncestor(ctx, site.fromFunction, template, args);
  if (growing !== null) {
    site.asker.error(at, nonTerminatingMessage(ctx.table, template, growing.ancestor, args, growing.index));
    return null;
  }
  if (template.count >= MAX_INSTANTIATIONS_PER_TEMPLATE) {
    site.asker.error(
      at,
      `\`${template.sourceName}\` has been instantiated ${MAX_INSTANTIATIONS_PER_TEMPLATE} times, which is ` +
        "this compiler's limit rather than a rule of the language"
    );
    return null;
  }
  if (ctx.program.instantiationList.length >= MAX_INSTANTIATIONS) {
    site.asker.error(
      at,
      `This module has reached ${MAX_INSTANTIATIONS} generic instantiations, which is this compiler's limit ` +
        "rather than a rule of the language"
    );
    return null;
  }

  // WP18 G8: a generic method of an instantiated class sees the class's
  // parameters too, bound by the receiver, and its own beside them — the
  // shadowing rule keeps the two sets of names apart.
  const bindings = new StringMap();
  const names = chainParameters(template);
  const bound = chainArguments(template, args);
  let i = 0;
  while (i < names.length) {
    bindings.set(names[i], bound[i]);
    i = i + 1;
  }
  // The template's own annotations, resolved once with its parameters bound:
  // the signature collector a monomorphic declaration goes through, over a
  // resolver that now answers `T`.
  const display = functionInstanceDisplayName(ctx.table, template.sourceName, args, functions);
  const saved = ctx.typeBindings;
  ctx.typeBindings = bindings;
  const sig =
    owner === null ? collectFunctionSignature(ctx, template.decl) : collectMethodSignature(ctx, owner, template.decl, symbol, display);
  ctx.typeBindings = saved;
  sig.name = symbol;
  sig.sourceName = display;
  sig.exported = template.exported;
  const info = new Instantiation(template, args, sig, bindings, ctx.program.nodeTypes.length);
  info.owner = receiverOf(template);
  info.from = site.fromFunction;
  info.functionArgs = functions;
  info.functionBindings = bindFunctionParameters(template.decl, functions);
  info.parallel = parallelRole(template);
  info.mapIntrinsic = mapIntrinsicRole(template);
  sig.instance = info;
  template.count = template.count + 1;
  ctx.program.addInstantiation(symbol, info);
  ctx.pending.push(info);
  return sig;
};

/**
 * A call whose callee is a generic template. The type arguments are inferred
 * from the argument types and are never written here (§2a: one token of
 * lookahead cannot tell `f<i32>(x)` from `(f < i32) > (x)`), so the whole of
 * the resolution is: check the arguments, unify, request the instantiation, and
 * then check the arguments *again* against the signature that came back — which
 * is the ordinary monomorphic check and reports the ordinary message.
 *
 * WP29 puts a second phase between the unification and the request. A
 * function-typed parameter's argument is not a value to check: it is a name or
 * an arrow, resolved once the value arguments have bound what they can, so an
 * arrow's parameters can take their types from `xs` and its body can bind `U`.
 * What it resolves to is part of the request, beside the type arguments.
 */
export const checkGenericCall = (
  ctx: CheckContext,
  expr: Node,
  template: TemplateInfo,
  scope: Scope
): i32 => {
  const parameters = template.decl.children[1];
  const args = expr.children[1];
  if (args.children.length !== parameters.children.length) {
    return ctx.errorType(
      expr,
      `\`${template.sourceName}\` expects ${parameters.children.length} argument(s), got ${args.children.length}`
    );
  }
  // A generic method never has a function parameter: its signature collector
  // refuses one, so its arguments are all values and are checked as values.
  const functional = template.owner === null;
  const names = typeParamSet(template);
  const bindings = new StringMap();
  let argTypes: i32[] = [];
  // Which arguments are checked after the others: a function argument, and a
  // literal that takes its type from what the others bind.
  const later: boolean[] = [];
  let i = 0;
  while (i < args.children.length && i < parameters.children.length) {
    const deferred = (functional && isFunctionParameter(parameters.children[i])) || isContextualLiteral(args.children[i]);
    later.push(deferred);
    argTypes.push(deferred ? T_VOID : checkExpression(ctx, args.children[i], scope, -1));
    i = i + 1;
  }
  i = 0;
  while (i < parameters.children.length && i < later.length && i < argTypes.length) {
    const annotation = parameters.children[i].children[1];
    if (!later[i] && annotation.kind !== N_EMPTY) {
      unifyAnnotation(ctx, annotation, argTypes[i], names, bindings);
    }
    i = i + 1;
  }
  // A bare numeric literal takes its type from its context, so one written
  // for a parameter the other arguments have already bound is checked against
  // that binding: `reduce(xs, add, 0.0)` over an `f64[]` is an `f64` zero in
  // either number mode, as it would be with the type written out. One that no
  // other argument binds is checked as a `number` and binds the parameter
  // itself, which is what it did before (WP29, for an identity argument).
  const settled: i32[] = [];
  i = 0;
  while (i < args.children.length && i < parameters.children.length && i < later.length && i < argTypes.length) {
    const param = parameters.children[i];
    const arg = args.children[i];
    const annotation = param.children[1];
    const early = argTypes[i];
    if (later[i] && !(functional && isFunctionParameter(param))) {
      let want = -1;
      if (annotation.kind !== N_EMPTY && template.owner === null && !mentionsUnbound(annotation, names, bindings)) {
        want = resolveInTemplate(template, annotation, bindings);
      }
      const type = checkExpression(ctx, arg, scope, want);
      if (annotation.kind !== N_EMPTY) {
        unifyAnnotation(ctx, annotation, type, names, bindings);
      }
      settled.push(type);
    } else {
      settled.push(early);
    }
    i = i + 1;
  }
  argTypes = settled;
  const functions: FunctionSig[] = [];
  i = 0;
  while (i < parameters.children.length) {
    if (functional && isFunctionParameter(parameters.children[i])) {
      const fn = resolveFunctionArgument(ctx, template, i, args.children[i], names, bindings, scope);
      if (fn === null) {
        return T_ERROR;
      }
      functions.push(fn);
    }
    i = i + 1;
  }
  const tuple: i32[] = [];
  for (const name of template.typeParams) {
    const bound = bindings.get(name, -1);
    if (bound < 0) {
      // Every parameter that mentions `name` failed to match its argument's
      // shape, so the message points at the first of them rather than at the
      // whole call: that is the argument the programmer has to change.
      let at = -1;
      let k = 0;
      while (k < parameters.children.length) {
        const annotation = parameters.children[k].children[1];
        if (at < 0 && annotation.kind !== N_EMPTY && mentionsTypeParam(annotation, names)) {
          at = k;
        }
        k = k + 1;
      }
      const named = at < 0 ? 0 : at;
      // The annotation is the template's, so its text is in the module that declares it.
      const shown = at < 0 ? "T" : template.home.textOf(parameters.children[named].children[1]);
      const got = ctx.table.typeName(argTypes[named]);
      const where = at < 0 ? expr : args.children[named];
      return ctx.errorType(
        where,
        `Cannot infer \`${name}\` for \`${template.sourceName}\`: argument ${at + 1} is ${got}, ` +
          `which does not match the declared \`${shown}\``
      );
    }
    tuple.push(bound);
  }
  if (!matchFunctionArguments(ctx, template, bindings, functions, args)) {
    return T_ERROR;
  }
  const sig = instantiate(ctx, template, tuple, functions, expr);
  if (sig === null) {
    return T_ERROR;
  }
  // A generic method's signature starts with `this` (WP18 G8).
  const offset = template.owner === null ? 0 : 1;
  i = 0;
  while (i < args.children.length && i < argTypes.length) {
    if (
      !sig.isCompileTime(i + offset) &&
      argTypes[i] !== T_ERROR &&
      !ctx.table.assignable(argTypes[i], sig.paramTypes[i + offset])
    ) {
      const want = ctx.table.typeName(sig.paramTypes[i + offset]);
      ctx.error(
        args.children[i],
        `Argument ${i + 1} of \`${sig.sourceName}\`: expected ${want}, got ${ctx.table.typeName(argTypes[i])}`
      );
      return T_ERROR;
    }
    i = i + 1;
  }
  ctx.program.nodeCallees[expr.id] = sig;
  // WP29 P1: whether the body may run on several threads at once is a
  // question about the whole program, so it is asked once the fixpoint has an
  // answer (`Compilation.checkParallel`); the call is where it will be told.
  recordParallelCall(ctx.program, expr, sig);
  return sig.returnType;
};

// ---- Compile-time function parameters (WP29) ------------------------------------------
//
// docs/wp23-language-surface.md §6, built for a callee the checker can name and
// for no other kind. A parameter annotated with a function type makes its
// function a template even with no type parameters, and each call names the
// function it passes — a top-level function by name, or an arrow written right
// there, which is lifted into a function of its own. The instantiation key
// gains that function as a third component and the symbol a segment for it, so
// `apply(square, 3)` and `apply(cube, 3)` are two `define`s, each with a direct
// call in it. There is no function pointer anywhere: the parameter has no LLVM
// parameter, no local and no value, and the only things a body can do with it
// are call it and pass it on to another such parameter.

/** An annotation with its parentheses taken off, which is where a function type is recognised. */
const unwrapTypeParens = (node: Node): Node => node.kind === N_TYPE_PAREN ? unwrapTypeParens(node.children[0]) : node;

/** Whether a declared parameter is annotated with a function type (WP29). */
export const isFunctionParameter = (param: Node): boolean =>
  param.kind === N_PARAM && param.children.length > 1 && unwrapTypeParens(param.children[1]).kind === N_TYPE_FUNCTION;

/** Whether any parameter of a function declaration is annotated with a function type (WP29). */
export const hasFunctionParameter = (decl: Node): boolean => {
  if (decl.children.length < 2 || decl.children[1].kind !== N_LIST) {
    return false;
  }
  for (const param of decl.children[1].children) {
    if (isFunctionParameter(param)) {
      return true;
    }
  }
  return false;
};

/**
 * Whether a top-level function declaration is a template: it has type
 * parameters (WP18), or a function-typed parameter (WP29). A `declare
 * function` is never one; its collector refuses the function type instead.
 */
export const isTemplateFunction = (decl: Node): boolean =>
  isGenericFunction(decl) || ((decl.flags & FLAG_FOREIGN) === 0 && hasFunctionParameter(decl));

/**
 * The refusal for a function type written where a parameter may not take one,
 * shared by every such position, which `what` names.
 */
export const functionTypeHereMessage = (name: string, what: string): string =>
  `\`${name}\` cannot have a function type here: a function type may only annotate a parameter of a ` +
  `top-level function, which is monomorphised for each function it is given, and this is a parameter of ${what}`;

/**
 * A function type inside a function type — a callee that itself takes a
 * function — is refused once, against the declaration. Such a parameter would
 * need its argument's own function argument at the same call, which is a
 * function value by another name.
 */
export const refuseNestedFunctionTypes = (ctx: CheckContext, decl: Node): boolean => {
  for (const param of decl.children[1].children) {
    if (!isFunctionParameter(param)) {
      continue;
    }
    const fnType = unwrapTypeParens(param.children[1]);
    for (const inner of fnType.children[0].children) {
      if (inner.children.length > 1 && unwrapTypeParens(inner.children[1]).kind === N_TYPE_FUNCTION) {
        ctx.error(inner.children[1], functionTypeHereMessage(inner.children[0].text, "a function type"));
        return true;
      }
    }
  }
  return false;
};

/**
 * One segment per function argument, after the type arguments' (WP29). It is
 * prefix-coded like theirs — `fn.` and the symbol's length, then the symbol —
 * so a symbol that holds a `$` of its own cannot run into the next segment, and
 * no type mangles to anything starting `fn.`, so the encoding stays injective.
 */
const withFunctionArguments = (symbol: string, functions: FunctionSig[]): string => {
  const parts: string[] = [symbol];
  for (const fn of functions) {
    parts.push(`fn.${fn.name.length}.${fn.name}`);
  }
  return parts.join("$");
};

/** `apply<i32, square>`: the source spelling of a request that takes functions (WP29). */
const functionInstanceDisplayName = (
  table: TypeTable,
  base: string,
  args: i32[],
  functions: FunctionSig[]
): string => {
  if (functions.length === 0) {
    return instanceDisplayName(table, base, args);
  }
  const parts: string[] = [];
  for (const arg of args) {
    parts.push(table.typeName(arg));
  }
  for (const fn of functions) {
    parts.push(fn.sourceName);
  }
  return `${base}<${parts.join(", ")}>`;
};

/** Each function-typed parameter of `decl` by name, bound to the function the request gave it. */
const bindFunctionParameters = (decl: Node, functions: FunctionSig[]): FunctionBindings => {
  const out = new FunctionBindings();
  let k = 0;
  for (const param of decl.children[1].children) {
    if (isFunctionParameter(param) && k < functions.length) {
      out.add(param.children[0].text, functions[k]);
      k = k + 1;
    }
  }
  return out;
};

/**
 * Make `fn` callable from `home`, which is where an instantiation that calls it
 * is being made (WP29).
 *
 * A template is monomorphised in its own module (WP18 G7), so an instantiation
 * of an imported template that was given a caller's *private* function, or an
 * arrow the caller wrote, calls a function another module defines. Such a
 * function would be `internal`, so it becomes `hidden` instead: in the final
 * link, and exported from nothing. Its symbol needs no change for that, because
 * a function's symbol is already unique across the program whether or not it
 * is exported (`rejectSymbolClashes`), and a lifted arrow's is its enclosing
 * function's with a `$` no declared name can spell. The module that calls it
 * gets a `declare`, the way an instantiation it calls and another module
 * defines does.
 */
const exposeTo = (home: CheckContext, fn: FunctionSig): void => {
  if (fn.definedIn(home.source)) {
    return;
  }
  // A `declare function` is C's symbol, and has no linkage of this program's.
  if (!fn.exported && !fn.foreign()) {
    fn.hidden = true;
  }
  useExternalInstance(home, fn);
};

/**
 * `(x: i32) => i64`: a function's signature spelled as the function type it
 * would have to match, for the message that says it does not.
 */
const functionTypeText = (table: TypeTable, names: string[], types: i32[], returnType: i32): string => {
  const parts: string[] = [];
  let i = 0;
  while (i < names.length && i < types.length) {
    parts.push(`${names[i]}: ${table.typeName(types[i])}`);
    i = i + 1;
  }
  return `(${parts.join(", ")}) => ${table.typeName(returnType)}`;
};

/**
 * The refusal for a function argument whose signature is not its parameter's
 * function type, `wanted` spelled as the caller has it: as written while a
 * type parameter may still be unbound, and resolved once every one is.
 */
const mismatchMessage = (
  table: TypeTable,
  template: TemplateInfo,
  index: i32,
  fn: FunctionSig,
  param: Node,
  wanted: string
): string =>
  `Argument ${index + 1} of \`${template.sourceName}\`: \`${fn.sourceName}\` is ` +
  `\`${functionTypeText(table, fn.paramNames, fn.paramTypes, fn.returnType)}\`, and \`${param.children[0].text}\` is ` +
  `\`${wanted}\`; a function argument must have exactly its parameter's type`;

/**
 * Resolve an annotation written in `template`'s declaration, with `bindings`
 * standing for its type parameters: in the template's own module, whose names
 * the annotation uses, exactly as an instantiation's signature is resolved.
 */
const resolveInTemplate = (template: TemplateInfo, annotation: Node, bindings: StringMap): i32 => {
  const home = template.home;
  const saved = home.typeBindings;
  home.typeBindings = bindings;
  const type = resolveType(annotation, home);
  home.typeBindings = saved;
  return type;
};

/** Whether `annotation` mentions a type parameter of `names` that `bindings` has not bound yet. */
const mentionsUnbound = (annotation: Node, names: StringSet, bindings: StringMap): boolean => {
  const unbound = new StringSet();
  let i = 0;
  while (i < names.size()) {
    const name = names.at(i);
    if (bindings.get(name, -1) < 0) {
      unbound.add(name);
    }
    i = i + 1;
  }
  return unbound.size() > 0 && mentionsTypeParam(annotation, unbound);
};

/**
 * The function a call gives the function-typed parameter at `index`, or
 * `null` once it has been refused: the name of a top-level function (or of a
 * function parameter of the body being checked, which passes its callee on),
 * or an arrow written right there. What it binds is unified into `bindings`,
 * so a type parameter that only the callee mentions is inferred from it.
 */
const resolveFunctionArgument = (
  ctx: CheckContext,
  template: TemplateInfo,
  index: i32,
  arg: Node,
  names: StringSet,
  bindings: StringMap,
  scope: Scope
): FunctionSig | null => {
  const param = template.decl.children[1].children[index];
  const fnType = unwrapTypeParens(param.children[1]);
  // The argument is no value, and the walks after this one read a type off
  // every node they visit; `void` is the one that says so.
  let written = arg;
  ctx.program.nodeTypes[written.id] = T_VOID;
  while (written.kind === N_PAREN) {
    written = written.children[0];
    ctx.program.nodeTypes[written.id] = T_VOID;
  }
  if (written.kind === N_ARROW) {
    return liftArrowArgument(ctx, template, index, written, names, bindings, scope);
  }
  const lead = `Argument ${index + 1} of \`${template.sourceName}\` must be the name of a top-level function or an arrow written at the call, because \`${param.children[0].text}\` is a function parameter, resolved at compile time`;
  if (written.kind !== N_IDENT) {
    refuseOnce(ctx, arg, `${lead}; a function is never a value computed at run time`);
    return null;
  }
  const name = written.text;
  if (scope.lookup(name) !== null) {
    refuseOnce(ctx, arg, `${lead}; \`${name}\` is a local, and a local is never a function`);
    return null;
  }
  if (ctx.capturesOuter(name)) {
    refuseOnce(ctx, arg, capturedMessage(name));
    return null;
  }
  const bound = ctx.functionBindings.get(name);
  const fn = bound !== null ? bound : ctx.signature(name);
  if (fn === null) {
    if (ctx.template(name) !== null) {
      refuseOnce(ctx, 
        arg,
        `\`${name}\` is generic, so it names no one function to pass as argument ${index + 1} of ` +
          `\`${template.sourceName}\`; pass an arrow that calls it, such as \`(x) => ${name}(x)\``
      );
      return null;
    }
    if (ctx.program.constant(name) !== null) {
      refuseOnce(ctx, arg, `${lead}; \`${name}\` is a constant, and a constant is never a function`);
      return null;
    }
    refuseOnce(ctx, arg, `Unknown function \`${name}\``);
    return null;
  }
  const wanted = fnType.children[0].children;
  if (fn.paramTypes.length !== wanted.length) {
    // Said now, in the words of the exact-type rule, rather than as a type
    // parameter the callee failed to bind.
    refuseOnce(ctx, arg, mismatchMessage(ctx.table, template, index, fn, param, template.home.textOf(fnType)));
    return null;
  }
  let k = 0;
  while (k < wanted.length && k < fn.paramTypes.length) {
    unifyAnnotation(ctx, wanted[k].children[1], fn.paramTypes[k], names, bindings);
    k = k + 1;
  }
  unifyAnnotation(ctx, fnType.children[1], fn.returnType, names, bindings);
  return fn;
};

/**
 * An arrow given for the function-typed parameter at `index`: its parameters'
 * types — as written, or as the function type says once the value arguments
 * have bound what it mentions — and then its body, checked where it stands.
 * A result type the function type leaves to a type parameter nothing else has
 * bound is inferred from a concise body; a block body has many `return`s and
 * has to say.
 */
const liftArrowArgument = (
  ctx: CheckContext,
  template: TemplateInfo,
  index: i32,
  arrow: Node,
  names: StringSet,
  bindings: StringMap,
  scope: Scope
): FunctionSig | null => {
  const param = template.decl.children[1].children[index];
  const fnType = unwrapTypeParens(param.children[1]);
  const wanted = fnType.children[0].children;
  const returns = fnType.children[1];
  const params = arrow.children[1].children;
  if (params.length !== wanted.length) {
    refuseOnce(ctx, 
      arrow,
      `The arrow passed as argument ${index + 1} of \`${template.sourceName}\` takes ${params.length} ` +
        `parameter(s), and \`${param.children[0].text}\` is \`${template.home.textOf(fnType)}\``
    );
    return null;
  }
  const types: i32[] = [];
  // Each element is read into a local before anything is called, which is
  // what keeps the bounds proof: a call may reach an array, so a length fact
  // does not survive one.
  let k = 0;
  while (k < params.length && k < wanted.length) {
    const written = params[k];
    const expected = wanted[k].children[1];
    const annotation = written.children[1];
    if (annotation.kind === N_EMPTY) {
      types.push(-1);
    } else if (unwrapTypeParens(annotation).kind === N_TYPE_FUNCTION) {
      refuseOnce(ctx, annotation, functionTypeHereMessage(written.children[0].text, "an arrow"));
      return null;
    } else {
      const type = resolveType(annotation, ctx);
      if (type === T_ERROR) {
        return null;
      }
      unifyAnnotation(ctx, expected, type, names, bindings);
      types.push(type);
    }
    k = k + 1;
  }
  const resolved: i32[] = [];
  k = 0;
  while (k < params.length && k < wanted.length && k < types.length) {
    const written = params[k];
    const expected = wanted[k].children[1];
    const given = types[k];
    if (given >= 0) {
      resolved.push(given);
    } else if (mentionsUnbound(expected, names, bindings)) {
      refuseOnce(ctx, 
        written,
        `Cannot infer the type of \`${written.children[0].text}\` in the arrow passed to ` +
          `\`${template.sourceName}\`: \`${template.home.textOf(expected)}\` mentions a type parameter no ` +
          "other argument binds; annotate the parameter"
      );
      return null;
    } else {
      const type = resolveInTemplate(template, expected, bindings);
      if (type === T_ERROR) {
        return null;
      }
      resolved.push(type);
    }
    k = k + 1;
  }
  let returnType = -1;
  const annotated = arrow.children[2];
  if (annotated.kind !== N_EMPTY) {
    returnType = resolveType(annotated, ctx);
    if (returnType === T_ERROR) {
      return null;
    }
  } else if (!mentionsUnbound(returns, names, bindings)) {
    returnType = resolveInTemplate(template, returns, bindings);
    if (returnType === T_ERROR) {
      return null;
    }
  } else if (arrow.children[3].kind === N_BLOCK) {
    refuseOnce(ctx, 
      arrow,
      `The arrow passed to \`${template.sourceName}\` needs a return type annotation: its result is ` +
        `\`${template.home.textOf(returns)}\`, which only its body could bind, and a block body's type is not inferred`
    );
    return null;
  }
  const fn = liftArrow(ctx, arrow, resolved, returnType, scope);
  if (fn === null) {
    return null;
  }
  unifyAnnotation(ctx, returns, fn.returnType, names, bindings);
  return fn;
};

/** A numeric literal, negated or not, whose type is whatever its context says it is. */
const isContextualLiteral = (arg: Node): boolean =>
  arg.kind === N_NUMBER || (arg.kind === N_UNARY && arg.text === "-" && arg.children[0].kind === N_NUMBER);

/** `(a, b) => ...`: how a lifted arrow is named in a diagnostic and in an instantiation's display name. */
const arrowDisplayName = (arrow: Node): string => {
  const names: string[] = [];
  for (const param of arrow.children[1].children) {
    names.push(param.children[0].text);
  }
  return `(${names.join(", ")}) => ...`;
};

/**
 * Lift an arrow argument into a function of its own and check its body now,
 * where it was written (WP29).
 *
 * The body is checked into the enclosing function's side tables — its nodes
 * are the enclosing function's nodes, and the enclosing body is checked once
 * per instantiation, so each node still has exactly one answer — and an arrow
 * inside an instantiation's body shares that instantiation's tables for the
 * passes after this one. It sees its parameters and the module's top-level
 * names and nothing else: a name of the function around it is a capture, and
 * is refused as one (`capturesOuter`).
 *
 * The symbol is the enclosing function's and a counter, behind a `$`, which is
 * unique in the module because the enclosing symbol is. `returnType` is -1 when
 * the concise body's own type is the result.
 */
const liftArrow = (ctx: CheckContext, arrow: Node, types: i32[], returnType: i32, outer: Scope): FunctionSig | null => {
  // Checked twice in one body (a caller that re-checks an argument): the arrow
  // is lifted once, and the call node's table slot for it says which.
  const existing = ctx.program.nodeCallees[arrow.id];
  if (existing !== null) {
    return existing;
  }
  const enclosing = ctx.current;
  if (enclosing === null) {
    refuseOnce(ctx, arrow, arrowElsewhereMessage());
    return null;
  }
  const fn = new FunctionSig(`${enclosing.name}$arrow${enclosing.arrowCount}`, arrowDisplayName(arrow), arrow);
  enclosing.arrowCount = enclosing.arrowCount + 1;
  fn.origin = ctx.source;
  fn.role = ROLE_FUNCTION;
  fn.lifted = true;
  fn.returnType = returnType < 0 ? T_ERROR : returnType;
  const scope = new Scope(null);
  let k = 0;
  for (const param of arrow.children[1].children) {
    const name = param.children[0].text;
    const type = k < types.length ? types[k] : T_ERROR;
    const local = new Local(name, type, false, STORAGE_PARAM);
    // Inside an instantiation an arrow's parameter may be a `T`, and the rule
    // that a `T` has only its constraint's members has to see it; where it
    // came from is not followed through a lifted arrow, so it fails closed.
    local.origin = ctx.typeBindings.size() === 0 ? null : unknownOrigin(param);
    if (!scope.declare(local)) {
      refuseOnce(ctx, param, `Duplicate parameter \`${name}\``);
      return null;
    }
    fn.paramNames.push(name);
    fn.paramTypes.push(type);
    k = k + 1;
  }
  const enclosingInstance = enclosing.instance;
  if (enclosingInstance !== null) {
    const shared = new Instantiation(null, enclosingInstance.typeArgs, fn, enclosingInstance.bindings, 0);
    shared.shareTablesOf(enclosingInstance);
    shared.owner = enclosingInstance.owner;
    shared.from = enclosingInstance;
    fn.instance = shared;
  }
  ctx.program.nodeCallees[arrow.id] = fn;

  const savedErrored = ctx.errored;
  const savedLoopKinds = ctx.loopKinds;
  const savedLoopBreaks = ctx.loopBreaks;
  const savedStatement = ctx.statementExpression;
  const savedFunctions = ctx.functionBindings;
  ctx.arrowOuterScopes.push(outer);
  ctx.arrowOuterFunctions.push(savedFunctions);
  ctx.functionBindings = new FunctionBindings();
  ctx.current = fn;
  ctx.errored = false;
  ctx.loopKinds = [];
  ctx.loopBreaks = [];
  ctx.statementExpression = null;
  checkSignatureBody(ctx, fn, scope, returnType < 0);
  ctx.current = enclosing;
  ctx.loopKinds = savedLoopKinds;
  ctx.loopBreaks = savedLoopBreaks;
  ctx.statementExpression = savedStatement;
  ctx.functionBindings = savedFunctions;
  ctx.arrowOuterScopes.pop();
  ctx.arrowOuterFunctions.pop();
  if (fn.poisoned) {
    // The arrow's own diagnostic stands for the call around it.
    ctx.errored = true;
    return null;
  }
  ctx.errored = savedErrored;
  ctx.program.functions.push(fn);
  return fn;
};

/**
 * Report a refusal about a function argument once per node (WP29). The call
 * that makes it may sit in a template's body, which is checked once per
 * instantiation, and a mistake written once is reported once: the same rule
 * `refuseParameterMember` follows (`CheckContext.errorOnce`).
 */
export const refuseOnce = (ctx: CheckContext, node: Node, message: string): void => {
  ctx.errorOnce(node, node.start, message);
};

/** The refusal for an arrow anywhere but as a function argument. */
export const arrowElsewhereMessage = (): string =>
  "An arrow may only be written as the argument for a function-typed parameter of a top-level function, which " +
  `lifts it into a function of its own: a function is never a value in ${LANGUAGE}, so it cannot be stored, ` +
  "returned or called where it stands";

/** The refusal for an arrow argument that reads a name of the function it is written in. */
export const capturedMessage = (name: string): string =>
  `The arrow reads \`${name}\`, which belongs to the function it is written in: an arrow argument is lifted into a ` +
  "function of its own and sees only its parameters and the module's top-level names, so it can capture nothing";

/**
 * Every function argument of a request against the function type its
 * parameter has once every type parameter is bound (WP29). They must agree
 * exactly — the body calls the callee with the parameter's types and reads
 * the parameter's result type — so the check is here, at the call that chose
 * the callee, rather than as an error inside the template's body.
 */
const matchFunctionArguments = (
  ctx: CheckContext,
  template: TemplateInfo,
  bindings: StringMap,
  functions: FunctionSig[],
  args: Node
): boolean => {
  const table = ctx.table;
  let k = 0;
  let i = 0;
  for (const param of template.decl.children[1].children) {
    if (isFunctionParameter(param) && k < functions.length) {
      const fn = functions[k];
      const fnType = unwrapTypeParens(param.children[1]);
      const wanted = fnType.children[0].children;
      const names: string[] = [];
      const types: i32[] = [];
      for (const inner of wanted) {
        names.push(inner.children[0].text);
        const type = resolveInTemplate(template, inner.children[1], bindings);
        if (type === T_ERROR) {
          return false;
        }
        types.push(type);
      }
      const returnType = resolveInTemplate(template, fnType.children[1], bindings);
      if (returnType === T_ERROR) {
        return false;
      }
      let same = fn.paramTypes.length === types.length;
      let j = 0;
      while (same && j < types.length && j < fn.paramTypes.length) {
        const got = fn.paramTypes[j];
        const want = types[j];
        same = canonicalArgument(table, got) === canonicalArgument(table, want);
        j = j + 1;
      }
      same = same && canonicalArgument(table, fn.returnType) === canonicalArgument(table, returnType);
      if (!same) {
        refuseOnce(ctx, 
          args.children[i],
          mismatchMessage(table, template, i, fn, param, functionTypeText(table, names, types, returnType))
        );
        return false;
      }
      k = k + 1;
    }
    i = i + 1;
  }
  return true;
};

/**
 * `$` separates a generic's name from its type arguments in every symbol the
 * compiler emits, so a *declared* name may not contain one — a class literally
 * called `Box$i32` would be the same symbol as `Box<i32>`. Locals, parameters
 * and fields keep it; only names that become symbols are restricted, which is
 * what makes the encoding injective.
 */
export const rejectDollarInSymbolName = (ctx: CheckContext, name: string, what: string, node: Node): boolean => {
  if (name.indexOf("$") < 0) {
    return false;
  }
  ctx.error(
    node,
    `\`${name}\` cannot be the name of ${what === "interface" ? "an" : "a"} ${what} in ${LANGUAGE}: \`$\` separates a generic's name from its ` +
      "type arguments in the symbols the compiler emits"
  );
  return true;
};

/**
 * The rules about a class's generic methods that belong to the *declaration*
 * (WP18 G8), run once per class in pass 1 whether the class is generic or not:
 * a generic class's members are collected once per instantiation, and a mistake
 * in a method's type parameter list is one mistake, not one per receiver.
 *
 *   - A method type parameter may not share a name with one of its class's
 *     (NL2331): both are in scope in the body, and a diagnostic, a constraint
 *     or an origin that names `T` has to mean one of them.
 *   - One that no parameter mentions can never be inferred, and is refused here
 *     in the words a generic function's is.
 *   - A method name with a `$` is refused where it could spell an
 *     instantiation's symbol, which is when the part before the `$` names a
 *     generic method of the same class (`pick$i32` beside `pick<T>`); §3c's
 *     rule, applied only where it is needed so no program that compiled before
 *     stops compiling.
 *   - The constraints are resolved, once, into the list every receiver shares.
 */
export const declareMethodTypeParameters = (ctx: CheckContext, classDecl: Node): void => {
  if (classDecl.kind !== N_CLASS) {
    return;
  }
  const className = classDecl.children[0].text;
  const classParams = collectStructTypeParamNames(classDecl);
  const members = classDecl.children[3].children;
  for (const member of members) {
    if (member.kind !== N_METHOD) {
      continue;
    }
    ctx.errored = false;
    const methodName = member.children[0].text;
    // A generic method's own name becomes the base of every instantiation's
    // symbol, so it may hold no `$` at all, exactly as a generic function's
    // may not: `pick$i32<V>` at `i32` would be `pick<U1, U2>` at `i32, i32`.
    if (isGenericFunction(member) && rejectDollarInSymbolName(ctx, methodName, "method", member.children[0])) {
      continue;
    }
    if (!isGenericFunction(member)) {
      if (methodName.indexOf("$") >= 0 && spellsGenericInstance(members, methodName)) {
        rejectDollarInSymbolName(ctx, methodName, "method", member.children[0]);
      }
      continue;
    }
    const list = typeParameterList(member);
    const own = collectTypeParamNames(member);
    let refused = false;
    for (const param of list.children) {
      if (param.kind === N_IDENT && indexOfName(classParams, param.text) >= 0) {
        ctx.error(
          param,
          `Type parameter \`${param.text}\` of \`${className}.${methodName}\` shadows \`${className}\`'s own ` +
            `\`${param.text}\`: a class's type parameters are in scope in its methods, and a diagnostic that names ` +
            `\`${param.text}\` has to mean one of them; give the method's another name`
        );
        refused = true;
      }
    }
    if (refused) {
      continue;
    }
    if (refuseUninferable(ctx, member, own, `${className}.${methodName}`)) {
      continue;
    }
    // Resolved with the class's parameters counted as parameters, so a
    // constraint that mentions one is NL2326's refusal: the list is resolved
    // once for every receiver, which is the reason that rule gives.
    const all: string[] = [];
    for (const name of classParams) {
      all.push(name);
    }
    for (const name of own) {
      all.push(name);
    }
    resolveConstraints(ctx, ctx.program.methodConstraintList(member), list, all);
  }
  ctx.errored = false;
};

/**
 * A type parameter is inferred from the arguments and from nothing else, so one
 * that appears in no parameter of `decl` — a function's or a method's — can
 * never be bound and the declaration could never be called. Reported once,
 * against the declaration's name rather than against every call, and answers
 * whether it was.
 */
export const refuseUninferable = (ctx: CheckContext, decl: Node, typeParams: string[], shown: string): boolean => {
  const parameters = decl.children[1];
  for (const param of typeParams) {
    const names = new StringSet();
    names.add(param);
    let mentioned = false;
    for (const declared of parameters.children) {
      const annotation = declared.children[1];
      if (annotation.kind !== N_EMPTY && mentionsTypeParam(annotation, names)) {
        mentioned = true;
      }
    }
    if (!mentioned) {
      ctx.error(
        decl.children[0],
        `Cannot infer \`${param}\` for \`${shown}\`: a type parameter is inferred from the arguments, and ` +
          `\`${param}\` appears in none of them; give \`${shown}\` a parameter that mentions \`${param}\``
      );
      return true;
    }
  }
  return false;
};

/**
 * Whether `name` starts with the name of a generic method of `members` and a
 * `$`, which is how an instantiation of that method's symbol continues.
 */
const spellsGenericInstance = (members: Node[], name: string): boolean => {
  for (const member of members) {
    if (member.kind === N_METHOD && isGenericFunction(member) && name.startsWith(`${member.children[0].text}$`)) {
      return true;
    }
  }
  return false;
};

/** A template's declared type parameter names, in order, from its fifth child. */
export const collectTypeParamNames = (decl: Node): string[] => {
  const names: string[] = [];
  for (const node of typeParameterList(decl).children) {
    if (node.kind === N_IDENT) {
      names.push(node.text);
    }
  }
  return names;
};

// ---- Constraints (WP18 G6) ------------------------------------------------------------
//
// `<T extends Shape>` says two things, and they are checked in two places.
// What a template may do with a `T` — read and call exactly `Shape`'s members —
// is judged while each instantiation's body is checked, against the constraint
// and never against the concrete type the instantiation happens to have. What
// a type argument must be — `Shape` itself, or a class that `implements Shape`
// — is judged at each request, where the argument was written or inferred.
// Neither changes the lowering: `T` at `Circle` is `%struct.Circle`, and a
// member read through it is the read a hand-written `Circle` would make.

/**
 * Resolve one template's constraints, once, in the module that declares it and
 * with no type parameter bound (WP18 G6).
 *
 * The bindings and both instantiation cursors are cleared for the duration,
 * because the first request for a template may arrive from inside some other
 * instantiation's body, and a constraint means the same thing whoever asks.
 * `errored` is cleared too, or a refused constraint met from inside a
 * statement that had already failed would never be reported at all — and the
 * list is only ever resolved once.
 */
export const resolveConstraints = (
  home: CheckContext,
  constraints: ConstraintList,
  list: Node,
  typeParams: string[]
): void => {
  if (constraints.resolved || constraints.resolving) {
    return;
  }
  constraints.resolving = true;
  const savedBindings = home.typeBindings;
  const savedInstance = home.currentInstance;
  const savedStruct = home.currentStructInstance;
  const savedErrored = home.errored;
  home.typeBindings = new StringMap();
  home.currentInstance = null;
  home.currentStructInstance = null;
  const names = new StringSet();
  for (const name of typeParams) {
    names.add(name);
  }
  const types: i32[] = [];
  for (const param of list.children) {
    if (param.kind === N_IDENT) {
      home.errored = false;
      types.push(param.children.length > 0 ? resolveConstraint(home, param, names) : -1);
    }
  }
  home.typeBindings = savedBindings;
  home.currentInstance = savedInstance;
  home.currentStructInstance = savedStruct;
  home.errored = savedErrored;
  constraints.types = types;
  constraints.resolved = true;
  constraints.resolving = false;
};

/**
 * One `T extends X`: the struct type `X` names, or -1 once it has been refused.
 * A constraint is resolved once for every instantiation, so it may not depend
 * on one: that rules out a type parameter, and an instantiation that mentions
 * one, which is where an F-bounded or parameter-dependent bound would start.
 */
const resolveConstraint = (ctx: CheckContext, param: Node, names: StringSet): i32 => {
  const node = param.children[0];
  if (mentionsTypeParam(node, names)) {
    ctx.error(
      node,
      `\`${param.text} extends ${ctx.textOf(node)}\` is not supported: a constraint cannot mention a type ` +
        "parameter, because it is resolved once for the template rather than once per instantiation; name a " +
        "class or interface, with any type arguments written out"
    );
    return -1;
  }
  const type = resolveType(node, ctx);
  if (type === T_ERROR) {
    return -1;
  }
  if (!ctx.table.isStruct(type)) {
    ctx.error(
      node,
      `\`${param.text} extends ${ctx.table.typeName(type)}\` is not supported: a constraint must be a declared ` +
        "class or interface, because the members a type parameter has are its constraint's"
    );
    return -1;
  }
  return type;
};

/** `resolveConstraints` for a generic function, in its home module. */
export const resolveTemplateConstraints = (template: TemplateInfo): void => {
  resolveConstraints(template.home, template.constraints, typeParameterList(template.decl), template.typeParams);
};

/** `resolveConstraints` for a generic class or interface, in its home module. */
export const resolveStructTemplateConstraints = (template: StructTemplateInfo): void => {
  resolveConstraints(template.home, template.constraints, structTypeParameterList(template.decl), template.typeParams);
};

/**
 * Whether `arg` satisfies `constraint`: it is the constraint, or it is a class
 * that `implements` it. There is no inheritance (WP25), so those are the only
 * two ways a type has a struct's members at the offsets the struct has them.
 * `arg`'s own layout is read from `asker`, the module that asked for it, and
 * the constraint's from `home`, the template's module, which resolved it.
 *
 * Both are held to the *declaration*, not the name (#161). The `TypeTable`
 * interns a struct by name alone, so a module's own `interface Shape` and the
 * template's `Shape` are one type id, and an `implements Shape` written against
 * the first says nothing about the second. A `StructInfo` is one object per
 * declaration, shared by every module that imports or reaches it, so identity
 * is an object compare.
 */
export const satisfiesConstraint = (
  asker: CheckContext,
  home: CheckContext,
  arg: i32,
  constraint: i32
): boolean => {
  if (!asker.table.isStruct(arg)) {
    return false;
  }
  const info = asker.program.struct(asker.table.nameOf(arg));
  const want = home.program.struct(home.table.nameOf(constraint));
  if (info === null || want === null) {
    return false;
  }
  return info === want || implementsDeclaration(info, want);
};

/**
 * Whether `cls`'s `implements` clause names the declaration `iface`: the one
 * test of "implements" in the checker, shared by a constraint here and by the
 * implicit class-to-interface conversion (`coercesTo` in `structs.ts`, #173).
 * `implementsNames` holds names, resolved in the module that collected `cls`'s
 * members: its `origin`, which is its template's for an instantiation. A plain
 * interface resolved there is one that module declares, because implementing an
 * imported interface is refused today (NL2079, a pass-1 ordering limit rather
 * than a rule; wp18 §15.6), so the names agreeing and `iface` being declared
 * there is identity. An instantiated interface's name is unique across the
 * program (`generic_class_clash`). If NL2079 is ever lifted this refuses the
 * newly legal case rather than accepting a stranger; recording the resolved
 * `StructInfo` beside the name is the fix then.
 */
export const implementsDeclaration = (cls: StructInfo, iface: StructInfo): boolean => {
  if (iface.instance === null && iface.origin !== cls.origin) {
    return false;
  }
  for (const name of cls.implementsNames) {
    if (name === iface.name) {
      return true;
    }
  }
  return false;
};

/**
 * Every type argument of one request against its parameter's constraint,
 * reporting the first that fails in `asker` at `at` — the request site, which
 * is where the user wrote or implied the argument (WP18 §6.5). `home` is the
 * template's module, which is where the constraint's own layout is known.
 */
export const checkConstraints = (
  asker: CheckContext,
  home: CheckContext,
  templateName: string,
  typeParams: string[],
  constraints: ConstraintList,
  args: i32[],
  at: Node
): boolean => {
  let i = 0;
  while (i < args.length) {
    const want = constraints.at(i);
    if (want >= 0 && !satisfiesConstraint(asker, home, args[i], want)) {
      const bound = home.table.typeName(want);
      const info = home.program.struct(home.table.nameOf(want));
      // A class constraint is met by the class and nothing else, because a
      // class can only `implements` an interface; so the fix names the class
      // rather than sending the reader after a clause they cannot write.
      const fix = info !== null && info.kind === STRUCT_CLASS
        ? `pass \`${bound}\` itself, because a class constraint is satisfied by that class alone`
        : `pass a class or interface that declares \`implements ${bound}\``;
      asker.error(
        at,
        `\`${typeParams[i]}\` of \`${templateName}\` requires \`${typeParams[i]} extends ${bound}\`, and ` +
          `\`${asker.table.typeName(args[i])}\` does not implement it; ${fix}`
      );
      return false;
    }
    i = i + 1;
  }
  return true;
};

/**
 * The struct half of the check, which may have to wait: see
 * `DeferredConstraint` for why a pass-1 request is written down instead.
 */
const checkStructConstraints = (
  home: CheckContext,
  template: StructTemplateInfo,
  args: i32[],
  at: Node,
  asker: CheckContext
): boolean => {
  resolveStructTemplateConstraints(template);
  if (asker.constraintsDeferred) {
    asker.deferredConstraints.push(new DeferredConstraint(template, args, at));
    return true;
  }
  return checkConstraints(asker, home, template.sourceName, template.typeParams, template.constraints, args, at);
};

/** The pass-1b end of `checkStructConstraints`: every request pass 1 wrote down. */
export const checkDeferredConstraints = (ctx: CheckContext): void => {
  ctx.constraintsDeferred = false;
  for (const request of ctx.deferredConstraints) {
    ctx.errored = false;
    const template = request.template;
    checkConstraints(
      ctx,
      template.home,
      template.sourceName,
      template.typeParams,
      template.constraints,
      request.args,
      request.at
    );
  }
  ctx.errored = false;
  ctx.deferredConstraints = [];
};

/** The origin an element of `iterable` starts with in `for...of`, or `null` outside an instantiation. */
export const elementOrigin = (ctx: CheckContext, iterable: Node, scope: Scope): TypeOrigin | null => {
  if (ctx.typeBindings.size() === 0) {
    return null;
  }
  return originElement(originOf(ctx, iterable, scope));
};

/** The position of `name` in `names`, or -1. */
const indexOfName = (names: string[], name: string): i32 => {
  let i = 0;
  while (i < names.length) {
    if (names[i] === name) {
      return i;
    }
    i = i + 1;
  }
  return -1;
};

/**
 * The constraint of the type parameter `name` of the instantiation whose body
 * is being checked, or -1 when it has none. A method of an instantiated class
 * answers from the class's parameter list, because those are its parameters.
 * Every template's list is resolved by the end of pass 1, before any body.
 */
const constraintInScope = (ctx: CheckContext, name: string): i32 => {
  const instance = ctx.currentInstance;
  if (instance === null) {
    return -1;
  }
  const template = instance.template;
  if (template !== null) {
    const at = indexOfName(template.typeParams, name);
    // A generic method of a generic class has both lists in scope (WP18 G8):
    // its own first, and the class's for a name that is not one of them.
    if (at >= 0 || instance.owner === null) {
      return template.constraints.at(at);
    }
  }
  const owner = instance.owner;
  if (owner === null) {
    return -1;
  }
  return owner.template.constraints.at(indexOfName(owner.template.typeParams, name));
};

/** `(T)`, `readonly T[]` and `T | null` are `T`, `T[]` and `T` for the question of where a value came from. */
const unwrapOrigin = (annotation: Node): Node => {
  if (annotation.kind === N_TYPE_PAREN || annotation.kind === N_TYPE_READONLY) {
    return unwrapOrigin(annotation.children[0]);
  }
  if (annotation.kind === N_TYPE_UNION) {
    for (const part of annotation.children) {
      if (part.kind !== N_TYPE_NULL) {
        return unwrapOrigin(part);
      }
    }
  }
  return annotation;
};

/**
 * Whether an annotation is a bare name with no type arguments. A type
 * parameter's own `IDENT` counts: it is what `this`'s origin names its
 * class's parameters with.
 */
const isBareName = (annotation: Node): boolean =>
  annotation.kind === N_IDENT || (annotation.kind === N_TYPE_REF && annotation.children[0].children.length === 0);

/**
 * Follow an origin through the names it substitutes, to the one whose
 * annotation says something about shape: `value: T` read through `Box<U[]>`
 * is `U[]`, as written in the body being checked.
 */
const substituted = (origin: TypeOrigin | null): TypeOrigin | null => {
  let at = origin;
  while (at !== null && !at.unknown && at.names.length > 0) {
    const node = unwrapOrigin(at.annotation);
    if (!isBareName(node)) {
      return at;
    }
    const index = indexOfName(at.names, node.text);
    if (index < 0) {
      return at;
    }
    at = at.args[index];
  }
  return at;
};

/**
 * The type parameter of the body being checked that `origin` is, once it is
 * unwrapped and substituted, or "" when it is anything else — a class, an
 * array, a type that mentions no parameter.
 *
 * An unknown origin (`TypeOrigin.unknown`) is answered from `type`, the
 * receiver's concrete type: it is a parameter's when some parameter in scope
 * is bound to exactly that type. That is the test the header of `originOf`
 * says is *not* a test for "came from `T`" — it refuses too much — and it is
 * used here for exactly that reason: an expression this module does not know
 * how to follow is refused rather than waved through.
 */
const originParameter = (ctx: CheckContext, origin: TypeOrigin | null, type: i32): string => {
  const at = substituted(origin);
  if (at === null) {
    return "";
  }
  if (at.unknown) {
    let i = 0;
    while (i < ctx.typeBindings.size()) {
      const name = ctx.typeBindings.keyAt(i);
      if (ctx.typeBindings.get(name, -1) === type) {
        return name;
      }
      i = i + 1;
    }
    return "";
  }
  const node = unwrapOrigin(at.annotation);
  if (at.names.length > 0 || !isBareName(node)) {
    return "";
  }
  return ctx.typeBindings.has(node.text) ? node.text : "";
};

/**
 * The origin of an element of an array whose origin is `origin`: `T` for
 * `T[]`, `Array<T>` and `new Array<T>(n)`, and the elements' own origin for an
 * array literal. An element of an unknown array is unknown.
 */
const originElement = (origin: TypeOrigin | null): TypeOrigin | null => {
  const at = substituted(origin);
  if (at === null || at.unknown) {
    return at;
  }
  const node = unwrapOrigin(at.annotation);
  if (node.kind === N_TYPE_ARRAY) {
    return new TypeOrigin(node.children[0], at.names, at.args);
  }
  if (node.kind === N_ARRAY) {
    return at.args.length > 0 ? at.args[0] : null;
  }
  const isArrayRef = node.kind === N_TYPE_REF && (node.text === "Array" || node.text === "ReadonlyArray");
  const isArrayNew = node.kind === N_NEW && node.children[0].text === "Array";
  if (isArrayRef || isArrayNew) {
    const list = node.kind === N_NEW ? node.children[1] : node.children[0];
    if (list.kind === N_LIST && list.children.length === 1) {
      return new TypeOrigin(list.children[0], at.names, at.args);
    }
  }
  return null;
};

/**
 * A member's declared type in a generic class or interface: a field's
 * annotation, or a method's return type. Found in the declaration rather than
 * in an instantiated layout, because the layout has only concrete types.
 */
const memberAnnotation = (decl: Node, name: string, method: boolean): Node | null => {
  const members = decl.kind === N_CLASS ? decl.children[3] : decl.children[1];
  for (const member of members.children) {
    if (member.children.length === 0 || member.children[0].text !== name) {
      continue;
    }
    if (method && member.kind === N_METHOD) {
      return member.children[2];
    }
    if (!method && member.kind === N_FIELD) {
      return member.children[1];
    }
  }
  return null;
};

/**
 * The generic class or interface an origin is an instantiation of, with the
 * origin of each type argument pushed onto `args`, or `null` when it is not
 * one. Three spellings reach here: an annotation `Box<U>`, an expression
 * `new Box<U>(u)` — the same written list, one position over — and the
 * declaration itself, which is `this`'s origin inside an instantiated class's
 * method, whose arguments are its own parameters.
 */
const structShape = (ctx: CheckContext, at: TypeOrigin, args: (TypeOrigin | null)[]): StructTemplateInfo | null => {
  const node = unwrapOrigin(at.annotation);
  if (node.kind === N_CLASS || node.kind === N_INTERFACE) {
    const owner = ctx.currentStructInstance;
    if (owner === null || owner.template.decl !== node) {
      return null;
    }
    for (const param of structTypeParameterList(node).children) {
      args.push(new TypeOrigin(param, [], []));
    }
    return owner.template;
  }
  let name = "";
  let written: Node | null = null;
  if (node.kind === N_TYPE_REF) {
    name = node.text;
    written = node.children[0];
  } else if (node.kind === N_NEW) {
    name = node.children[0].text;
    written = node.children[1];
  }
  if (written === null || written.children.length === 0) {
    return null;
  }
  const template = ctx.program.structTemplate(name);
  if (template === null) {
    return null;
  }
  for (const arg of written.children) {
    args.push(new TypeOrigin(arg, at.names, at.args));
  }
  return template;
};

/** Whether a `Result` member hands back the ok payload: `value`, and the three methods that unwrap. */
const unwrapsOk = (name: string, method: boolean): boolean =>
  method ? name === "orReturn" || name === "unwrapOr" || name === "expect" : name === "value";

/**
 * The origin of `receiver.name` (or of `receiver.name(...)`'s result): the
 * member's annotation in a generic class or interface, with the class's
 * parameters standing for its type arguments' origins; the payload of a
 * `Result`; the element `pop()` hands back. A member of anything else has a
 * declared, concrete type, and a member of an unknown value is unknown.
 */
const originOfMember = (ctx: CheckContext, receiver: Node, name: string, method: boolean, scope: Scope): TypeOrigin | null => {
  const at = substituted(originOf(ctx, receiver, scope));
  if (at === null || at.unknown) {
    return at;
  }
  if (method && name === "pop") {
    return originElement(at);
  }
  const node = unwrapOrigin(at.annotation);
  if (node.kind === N_TYPE_REF && node.text === "Result" && node.children[0].children.length === 2) {
    const list = node.children[0];
    if (unwrapsOk(name, method)) {
      return new TypeOrigin(list.children[0], at.names, at.args);
    }
    return !method && name === "error" ? new TypeOrigin(list.children[1], at.names, at.args) : null;
  }
  const args: (TypeOrigin | null)[] = [];
  const template = structShape(ctx, at, args);
  if (template === null) {
    return null;
  }
  const annotation = memberAnnotation(template.decl, name, method);
  return annotation === null ? null : new TypeOrigin(annotation, template.typeParams, args);
};

/**
 * The origin of a call to a generic function or a generic method: its declared
 * return type, with each of its type parameters standing for the argument it
 * was inferred from — `identity(p)` is whatever `p` is, and `first(xs)` is an
 * element of `xs`. A parameter inferred through any other shape stands for
 * nothing, which is the answer for a type that did not come from one of ours.
 *
 * A generic method of an instantiated class (WP18 G8) has the class's
 * parameters in scope too, and they stand for what the receiver's origin says
 * its type arguments are — `this` in a generic class is the class at its own
 * parameters, an annotated `Box<U>` is `U` — and a receiver that says nothing
 * makes them stand for nothing.
 */
const originOfGenericCall = (ctx: CheckContext, call: Node, template: TemplateInfo, scope: Scope): TypeOrigin => {
  const args: (TypeOrigin | null)[] = [];
  const receiver = receiverOf(template);
  if (receiver !== null) {
    const at = substituted(originOf(ctx, call.children[0].children[0], scope));
    const shape: (TypeOrigin | null)[] = [];
    let shaped: StructTemplateInfo | null = null;
    if (at !== null && !at.unknown) {
      shaped = structShape(ctx, at, shape);
    }
    let k = 0;
    while (k < receiver.template.typeParams.length) {
      if (shaped !== null && k < shape.length) {
        args.push(shape[k]);
      } else if (at !== null && at.unknown) {
        args.push(at);
      } else {
        args.push(null);
      }
      k = k + 1;
    }
  }
  const parameters = template.decl.children[1];
  const written = call.children[1];
  for (const name of template.typeParams) {
    let found: TypeOrigin | null = null;
    let k = 0;
    while (found === null && k < parameters.children.length && k < written.children.length) {
      const annotation = unwrapOrigin(parameters.children[k].children[1]);
      if (isBareName(annotation) && annotation.text === name) {
        found = originOf(ctx, written.children[k], scope);
      } else if (annotation.kind === N_TYPE_ARRAY && isBareName(unwrapOrigin(annotation.children[0]))) {
        if (unwrapOrigin(annotation.children[0]).text === name) {
          found = originElement(originOf(ctx, written.children[k], scope));
        }
      }
      k = k + 1;
    }
    args.push(found);
  }
  return new TypeOrigin(template.decl.children[2], chainParameters(template), args);
};

/**
 * The return annotation of the function type of the parameter `name` of the
 * instantiation whose body is being checked, or `null` when `name` is not one
 * of its function parameters (WP29).
 */
const functionParameterReturn = (ctx: CheckContext, name: string): Node | null => {
  if (ctx.functionBindings.get(name) === null) {
    return null;
  }
  const instance = ctx.currentInstance;
  const template: TemplateInfo | null = instance === null ? null : instance.template;
  if (template === null) {
    return null;
  }
  for (const param of template.decl.children[1].children) {
    if (isFunctionParameter(param) && param.children[0].text === name) {
      return unwrapTypeParens(param.children[1]).children[1];
    }
  }
  return null;
};

/** An array literal's origin: the literal, standing for its first element that came from somewhere. */
const originOfArrayLiteral = (ctx: CheckContext, expr: Node, scope: Scope): TypeOrigin | null => {
  for (const element of expr.children) {
    const found = originOf(ctx, element, scope);
    if (found !== null) {
      const elements: (TypeOrigin | null)[] = [];
      elements.push(found);
      return new TypeOrigin(expr, [], elements);
    }
  }
  return null;
};

/**
 * Where an expression's value came from, as the template wrote it, or `null`
 * when nothing about it mentions a type parameter (WP18 G6).
 *
 * This is the whole of how "the receiver came from `T`" is told apart from
 * "the receiver's type is `Point`, which is `T`'s binding" — the second is not
 * a test for the first, because `<T>(p: T, q: Point)` at `T = Point` gives `p`
 * and `q` one type.
 *
 * Every expression kind of `self/nodes.ts` has a case, and each one either
 * follows the value or says why it cannot be a `T`. The `default` fails
 * closed: a kind added later answers "unknown", and an unknown receiver is
 * refused whenever its type is some parameter's binding, so a construct this
 * switch has not been taught about over-refuses in a test rather than letting
 * a member of `T` through in silence (`docs/wp18-generics.md` §15.6).
 */
export const originOf = (ctx: CheckContext, expr: Node, scope: Scope): TypeOrigin | null => {
  switch (expr.kind) {
    case N_IDENT: {
      // A module constant or a builtin import is a scalar, a string or an
      // array of them, declared outside every template.
      const local = scope.lookup(expr.text);
      return local === null ? null : local.origin;
    }
    case N_THIS: {
      // In an instantiated class's method, `this` is the class at its own
      // parameters; anywhere else it is a declared class.
      const owner = ctx.currentStructInstance;
      return owner === null ? null : new TypeOrigin(owner.template.decl, [], []);
    }
    case N_PAREN:
      return originOf(ctx, expr.children[0], scope);
    case N_CONDITIONAL: {
      const whenTrue = originOf(ctx, expr.children[1], scope);
      return whenTrue !== null ? whenTrue : originOf(ctx, expr.children[2], scope);
    }
    case N_BINARY:
      // An assignment's value is its right-hand side. Every other operator
      // answers a type of its own — a number, a boolean, a concatenated
      // string — which is the operator's result, not the operand's.
      // `??` answers one of its operands, the left one read out of a map: where
      // that came from is not followed, so it fails closed (WP32).
      if (expr.text === "??") {
        return unknownOrigin(expr);
      }
      return expr.text === "=" ? originOf(ctx, expr.children[1], scope) : null;
    case N_INDEX:
      return originElement(originOf(ctx, expr.children[0], scope));
    case N_MEMBER:
      return originOfMember(ctx, expr.children[0], expr.text, false, scope);
    case N_CALL: {
      const callee = expr.children[0];
      if (callee.kind === N_MEMBER) {
        // A generic method's call was resolved to its instantiation when it was
        // checked, which is before anybody asks where its value came from.
        const sig = ctx.program.nodeCallees[expr.id];
        const instance: Instantiation | null = sig === null ? null : sig.instance;
        const template: TemplateInfo | null = instance === null ? null : instance.template;
        if (template !== null && template.owner !== null) {
          return originOfGenericCall(ctx, expr, template, scope);
        }
        return originOfMember(ctx, callee.children[0], callee.text, true, scope);
      }
      if (callee.kind === N_IDENT && scope.lookup(callee.text) === null) {
        // WP29: a call through a function parameter answers what its function
        // type says it does, as the template wrote it: `f(x)` with
        // `f: (a: T) => T` is a `T`, whatever the callee's declared type is.
        const returns = functionParameterReturn(ctx, callee.text);
        if (returns !== null) {
          return new TypeOrigin(returns, [], []);
        }
        const template = ctx.program.template(callee.text);
        if (template !== null) {
          return originOfGenericCall(ctx, expr, template, scope);
        }
      }
      // A plain function's return type is declared outside every template,
      // and no builtin hands back its argument's type but `Math.abs`,
      // `Math.min` and `Math.max`, whose values are numbers.
      return null;
    }
    case N_NEW:
      // `new Box<U>(u)` is an instantiation written out, exactly as an
      // annotation `Box<U>` is; a class with no type arguments is declared.
      return expr.children[1].children.length > 0 ? new TypeOrigin(expr, [], []) : null;
    case N_ARRAY:
      return originOfArrayLiteral(ctx, expr, scope);
    case N_UNARY:
      // `-`, `+`, `!`, `~`, `++` and `--` answer a number or a boolean.
      return null;
    case N_OBJECT:
      // An object literal takes its type from its context, which is an
      // annotation, and the annotation is what a declaration records.
      return null;
    case N_NUMBER:
    case N_BIGINT:
    case N_STRING:
    case N_TEMPLATE:
    case N_TRUE:
    case N_FALSE:
    case N_NULL:
      // A literal has the type it spells.
      return null;
    case N_SUPER:
      // Refused wherever it is written (WP25).
      return null;
    default:
      return unknownOrigin(expr);
  }
};

/**
 * The origin a local declared in an instantiation's body starts with: its
 * annotation when it has one, else its initialiser's. `null` outside an
 * instantiation, where no annotation can mention a type parameter.
 */
export const declaredOrigin = (ctx: CheckContext, annotation: Node, initializer: Node, scope: Scope): TypeOrigin | null => {
  if (ctx.typeBindings.size() === 0) {
    return null;
  }
  if (annotation.kind !== N_EMPTY) {
    return new TypeOrigin(annotation, [], []);
  }
  return initializer.kind === N_EMPTY ? null : originOf(ctx, initializer, scope);
};

/** The origin of parameter `index` of `sig` (after `this`, for a method), or `null` outside an instantiation. */
export const parameterOrigin = (ctx: CheckContext, sig: FunctionSig, index: i32): TypeOrigin | null => {
  if (ctx.typeBindings.size() === 0) {
    return null;
  }
  const list = sig.decl.kind === N_CONSTRUCTOR ? sig.decl.children[0] : sig.decl.children[1];
  const at = sig.owner !== null ? index - 1 : index;
  if (at < 0 || at >= list.children.length) {
    return null;
  }
  return new TypeOrigin(list.children[at].children[1], [], []);
};

/**
 * WP18 G6: a member read, written or called through a value that came from a
 * type parameter is answered by the parameter's constraint, never by the type
 * the instantiation bound it to. Answers true when the access was refused,
 * after reporting it once for the template (`errorOnce`).
 *
 * An unconstrained parameter has no members at all (§8, message 8). A
 * constrained one has its constraint's, and nothing else — a member the
 * concrete type has and the constraint lacks is refused, or the constraint
 * would be decoration. Everything past this check is the ordinary lookup on
 * the concrete type, which finds the same member at the same index: an
 * implementer's first fields are its interface's.
 */
export const refuseParameterMember = (
  ctx: CheckContext,
  receiver: Node,
  receiverType: i32,
  member: Node,
  verb: string,
  method: boolean,
  scope: Scope
): boolean => {
  if (ctx.typeBindings.size() === 0) {
    return false;
  }
  const param = originParameter(ctx, originOf(ctx, receiver, scope), receiverType);
  if (param.length === 0) {
    return false;
  }
  const at = member.end - member.text.length;
  const constraint = constraintInScope(ctx, param);
  if (constraint < 0) {
    // The fix names the type this instantiation bound, which is the one the
    // author had in mind. A constraint can only be a class or interface, so
    // for anything else the honest fix is to stop being generic over it.
    const bound = ctx.typeBindings.get(param, -1);
    const spelled = ctx.table.typeName(bound);
    const fix = ctx.table.isStruct(bound)
      ? `say which ones it has with \`<${param} extends ${spelled}>\``
      : `\`${param}\` is \`${spelled}\` here, and only a class or interface can be a constraint, so take a ` +
        `\`${spelled}\` rather than a \`${param}\``;
    ctx.errorOnce(
      member,
      at,
      `Cannot ${verb} \`${member.text}\` of \`${param}\`: an unconstrained type parameter has no members; ${fix}`
    );
    return true;
  }
  const info = ctx.program.struct(ctx.table.nameOf(constraint));
  if (info === null) {
    return false;
  }
  if (method ? info.method(member.text) !== null : info.field(member.text) !== null) {
    return false;
  }
  const kind = info.kind === STRUCT_CLASS ? "class" : "interface";
  ctx.errorOnce(
    member,
    at,
    `Unknown ${method ? "method" : "field"} \`${member.text}\` on ${kind} \`${ctx.table.typeName(info.type)}\`, ` +
      `the constraint of \`${param}\`: a constrained type parameter has only the members its constraint declares`
  );
  return true;
};
