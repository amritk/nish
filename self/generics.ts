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
import { collectFunctionSignature } from "./declarations";
import { checkExpression } from "./expressions";
import { StringMap, StringSet } from "./map";
import { collectStructMembers } from "./structs";
import {
  N_CLASS,
  N_EMPTY,
  N_IDENT,
  N_LIST,
  N_TYPE_ARRAY,
  N_TYPE_NULL,
  N_TYPE_PAREN,
  N_TYPE_READONLY,
  N_TYPE_REF,
  N_TYPE_UNION,
  Node,
} from "./nodes";
import {
  FunctionSig,
  Instantiation,
  StructInfo,
  StructInstantiation,
  StructTemplateInfo,
  TemplateInfo,
} from "./program";
import { Scope } from "./symbols";
import { K_ARRAY, K_NULLABLE, K_RESULT, K_STRUCT, R_UNKNOWN, T_ERROR, TypeTable } from "./types";

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
    const instance = ctx.program.structInstance(table.nameOf(outer));
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
  let at = from;
  while (at !== null) {
    // A member of an instantiated class carries no function template, so the
    // narrowing is also the test that this link of the chain is one of ours.
    const owner = at.template;
    if (owner !== null && owner === template) {
      const index = growingArgument(ctx, at.typeArgs, args);
      if (index >= 0) {
        return new Expansion(at, index);
      }
    }
    at = at.from;
  }
  return null;
};

/**
 * The struct half of the same rule (WP18 G5). A field's type is resolved while
 * the struct is being collected rather than while a body runs, so the chain
 * this walks is the one `ctx.currentStructInstance` maintains: the struct whose
 * members are being collected, or the struct whose method body is being
 * checked. `class Nest<T> { inner: Nest<T[]> | null }` is the shape it exists
 * for, and `reject_generic_expanding_field` is its case.
 *
 * The ancestor is also the answer: a refused request is handed
 * `ancestor.info` rather than nothing, so the class the programmer did write
 * keeps its field and its layout. §4a of `docs/wp18-generics.md` is the
 * argument for that and what it costs.
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
    const instance = ctx.program.structInstance(table.nameOf(arg));
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
  const from = instanceDisplayName(table, template.sourceName, ancestor.typeArgs);
  const to = instanceDisplayName(table, template.sourceName, args);
  const grew = table.typeName(ancestor.typeArgs[index]);
  return (
    `Monomorphising \`${template.sourceName}\` would not terminate: \`${from}\` asks for \`${to}\`, which puts ` +
    `\`${grew}\` under a type constructor instead of passing it on, so the chain has no end; pass ` +
    `\`${template.typeParams[index]}\` itself, or a type that does not mention it`
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
  const growing = expandingStructAncestor(ctx, ctx.currentStructInstance, template, args);
  if (growing !== null) {
    // WP18 §4a: refused, and answered with the ancestor. `ctx.error` does two
    // things — report, and set `errored` so the rest of the statement is
    // silent — and only the first is wanted. stage0 reports this one through
    // `report` rather than `error`, which does not throw, so the members after
    // this one are still collected and still refused; silencing them here is a
    // difference `--parity` finds. The gate on the way *in* is kept, because a
    // statement that has already reported is one stage0 has thrown out of, so
    // it never reaches this call at all.
    const wasErrored = ctx.errored;
    ctx.error(at, nonTerminatingStructMessage(ctx.table, template, growing.ancestor, args, growing.index));
    ctx.errored = wasErrored;
    return growing.ancestor.info;
  }
  // The caps answer with nothing, for the reason `instantiate` below says.
  if (template.count >= MAX_INSTANTIATIONS_PER_TEMPLATE) {
    ctx.error(
      at,
      `\`${template.sourceName}\` has been instantiated ${MAX_INSTANTIATIONS_PER_TEMPLATE} times, which is ` +
        "this compiler's limit rather than a rule of the language"
    );
    return null;
  }
  if (ctx.program.instantiationList.length + ctx.program.structInstantiationList.length >= MAX_INSTANTIATIONS) {
    ctx.error(
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
  const info = new StructInfo(name, template.kind, ctx.table.structOf(name), template.decl, template.origin);
  info.exported = template.exported;
  const instance = new StructInstantiation(template, args, info, bindings);
  instance.from = ctx.currentStructInstance;
  template.count = template.count + 1;
  // Registered before the members are collected, so a field that mentions the
  // struct's own instantiation (`next: Node<i32> | null`) finds it rather than
  // asking for it a second time.
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
  const prefix = ctx.program.symbolPrefix;
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
    // TODO(WP18 G7): the prefix must become the *template's* rather than this
    // module's once a generic may be instantiated from another module; the two
    // are the same one only because importing a template is refused.
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
  at: Node
): FunctionSig | null => {
  // WP21 S1: inside the package that declares the template. `qualifySymbols`
  // runs at the end of pass 1 and instantiations are appended during pass 2, so
  // an instantiation never passes through it -- the prefix has to be part of the
  // symbol from the moment it is minted, or a generic would be the one
  // declaration in the language whose symbol escaped its package.
  const symbol = instanceSymbol(ctx.table, ctx.program.symbolPrefix + template.sourceName, args);
  const existing = ctx.program.instantiation(symbol);
  if (existing !== null) {
    return existing.sig;
  }
  // WP27 S2. A template's parameters and return type are checked against its
  // *type parameters*, so the rule that keeps a foreign pointer out of a
  // function this program defines cannot be applied where the other ones are —
  // an instantiation is the first point at which `T` is known to be one. The
  // message is the same, because it is the same rule.
  for (const arg of args) {
    if (rejectForeignPointer(ctx, arg, `a type argument of \`${template.sourceName}\``, at)) {
      return null;
    }
  }
  // Termination: a request that puts one of its own type arguments under a
  // constructor is the shape whose chain has no end, refused by name rather
  // than by a depth count.
  //
  // This half answers with nothing, where §4a has the struct half answer with
  // the ancestor, and on purpose: `grow<i32[]>` is asked for from inside
  // `grow<i32>`'s own body, so handing the caller `grow<i32>`'s signature
  // would check `[x]` against `x: i32` and produce exactly the second
  // diagnostic about a mistake nobody made that §4a exists to stop. A field's
  // type has a well-typed substitute nearby; a call's does not, and neither do
  // the caps below — a cap refusal has no ancestor to hand back.
  const growing = expandingAncestor(ctx, ctx.currentInstance, template, args);
  if (growing !== null) {
    ctx.error(at, nonTerminatingMessage(ctx.table, template, growing.ancestor, args, growing.index));
    return null;
  }
  if (template.count >= MAX_INSTANTIATIONS_PER_TEMPLATE) {
    ctx.error(
      at,
      `\`${template.sourceName}\` has been instantiated ${MAX_INSTANTIATIONS_PER_TEMPLATE} times, which is ` +
        "this compiler's limit rather than a rule of the language"
    );
    return null;
  }
  if (ctx.program.instantiationList.length >= MAX_INSTANTIATIONS) {
    ctx.error(
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
  // The template's own annotations, resolved once with its parameters bound:
  // the signature collector a monomorphic declaration goes through, over a
  // resolver that now answers `T`.
  const saved = ctx.typeBindings;
  ctx.typeBindings = bindings;
  const sig = collectFunctionSignature(ctx, template.decl);
  ctx.typeBindings = saved;
  sig.name = symbol;
  sig.sourceName = instanceDisplayName(ctx.table, template.sourceName, args);
  sig.exported = template.exported;
  const info = new Instantiation(template, args, sig, bindings, ctx.program.nodeTypes.length);
  info.from = ctx.currentInstance;
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
  const names = typeParamSet(template);
  const bindings = new StringMap();
  const argTypes: i32[] = [];
  let i = 0;
  while (i < args.children.length) {
    argTypes.push(checkExpression(ctx, args.children[i], scope, -1));
    i = i + 1;
  }
  i = 0;
  while (i < parameters.children.length) {
    const annotation = parameters.children[i].children[1];
    if (annotation.kind !== N_EMPTY) {
      unifyAnnotation(ctx, annotation, argTypes[i], names, bindings);
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
      const shown = at < 0 ? "T" : ctx.textOf(parameters.children[named].children[1]);
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
  const sig = instantiate(ctx, template, tuple, expr);
  if (sig === null) {
    return T_ERROR;
  }
  i = 0;
  while (i < args.children.length) {
    if (argTypes[i] !== T_ERROR && !ctx.table.assignable(argTypes[i], sig.paramTypes[i])) {
      const want = ctx.table.typeName(sig.paramTypes[i]);
      ctx.error(
        args.children[i],
        `Argument ${i + 1} of \`${sig.sourceName}\`: expected ${want}, got ${ctx.table.typeName(argTypes[i])}`
      );
      return T_ERROR;
    }
    i = i + 1;
  }
  ctx.program.nodeCallees[expr.id] = sig;
  return sig.returnType;
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
    `\`${name}\` cannot be the name of a ${what} in ${LANGUAGE}: \`$\` separates a generic's name from its ` +
      "type arguments in the symbols the compiler emits"
  );
  return true;
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
