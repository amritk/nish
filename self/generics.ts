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

import { LANGUAGE } from "./branding";
import { CheckContext } from "./context";
import { collectFunctionSignature } from "./declarations";
import { checkExpression } from "./expressions";
import { StringMap, StringSet } from "./map";
import {
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
import { FunctionSig, Instantiation, TemplateInfo } from "./program";
import { Scope } from "./symbols";
import { K_ARRAY, K_NULLABLE, K_RESULT, R_UNKNOWN, T_ERROR, TypeTable } from "./types";

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

/** The type parameter list of an `N_FUNCTION`: its fifth child (WP18). */
export function typeParameterList(decl: Node): Node {
  return decl.children.length > 4 ? decl.children[4] : decl.children[0];
}

/** Whether a function declaration carries `<T, ...>`. */
export function isGenericFunction(decl: Node): boolean {
  const list = typeParameterList(decl);
  return list.kind === N_LIST && list.children.length > 0;
}

/**
 * The LLVM symbol for one instantiation: the template's name, then `$` and the
 * mangling of each type argument in order (`docs/wp18-generics.md` §3c). The
 * mangling is prefix-coded, so the arguments are self-delimiting and the whole
 * name splits again at the first `$` — which is why `$` may not appear in a
 * declared name.
 */
export function instanceSymbol(table: TypeTable, base: string, args: i32[]): string {
  let out = base;
  for (const arg of args) {
    out = `${out}$${table.mangle(arg)}`;
  }
  return out;
}

/** `identity<i32>`: the source spelling, for diagnostics and the dump. */
export function instanceDisplayName(table: TypeTable, base: string, args: i32[]): string {
  let out = "";
  let i = 0;
  while (i < args.length) {
    out = i === 0 ? table.typeName(args[i]) : `${out}, ${table.typeName(args[i])}`;
    i = i + 1;
  }
  return `${base}<${out}>`;
}

/**
 * The canonical form of an inferred type argument: a `Result` narrowed to one
 * arm is the same type as the un-narrowed one, and the mangling already ignores
 * the proof, so the tuple has to as well or two ids would ask for one symbol.
 */
export function canonicalArgument(table: TypeTable, type: i32): i32 {
  return table.isResult(type) ? table.withState(type, R_UNKNOWN) : type;
}

/**
 * Whether `inner` occurs as a subterm of `outer`. The termination rule is
 * stated over this: an instantiation that asks for one of the same template
 * with an argument that *contains* its own has put that argument under a type
 * constructor, and the chain it starts has no end.
 */
export function containsType(table: TypeTable, inner: i32, outer: i32): boolean {
  if (inner === outer) {
    return true;
  }
  const kind = table.kindOf(outer);
  if (kind === K_ARRAY || kind === K_NULLABLE) {
    return containsType(table, inner, table.refOf(outer));
  }
  if (kind === K_RESULT) {
    return containsType(table, inner, table.okOf(outer)) || containsType(table, inner, table.errOf(outer));
  }
  return false;
}

/**
 * The ancestor instantiation of the same template whose type arguments this
 * request grows, or `null` when the request is finite by §4's rule.
 *
 * Walking the whole chain rather than only the immediate parent is what covers
 * mutual recursion: `f<T>` asking for `g<T>` asking for `f<T[]>` expands, and
 * neither of its two edges does so on its own.
 */
export function expandingAncestor(
  table: TypeTable,
  from: Instantiation | null,
  template: TemplateInfo,
  args: i32[]
): Expansion | null {
  let at = from;
  while (at !== null) {
    if (at.template === template) {
      let i = 0;
      while (i < args.length) {
        const previous = at.typeArgs[i];
        if (previous !== args[i] && containsType(table, previous, args[i])) {
          return new Expansion(at, i);
        }
        i = i + 1;
      }
    }
    at = at.from;
  }
  return null;
}

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
export function unifyAnnotation(
  table: TypeTable,
  annotation: Node,
  arg: i32,
  names: StringSet,
  bindings: StringMap
): void {
  if (annotation.kind === N_TYPE_PAREN) {
    unifyAnnotation(table, annotation.children[0], arg, names, bindings);
    return;
  }
  if (annotation.kind === N_TYPE_ARRAY) {
    if (table.kindOf(arg) === K_ARRAY) {
      unifyAnnotation(table, annotation.children[0], table.refOf(arg), names, bindings);
    }
    return;
  }
  if (annotation.kind === N_TYPE_READONLY) {
    // The modifier changes who may write through the array, not its shape.
    unifyAnnotation(table, annotation.children[0], arg, names, bindings);
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
      unifyAnnotation(table, member, table.stripNull(arg), names, bindings);
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
    unifyAnnotation(table, list.children[0], table.refOf(arg), names, bindings);
    return;
  }
  if (name === "Result" && argc === 2 && table.isResult(arg)) {
    unifyAnnotation(table, list.children[0], table.okOf(arg), names, bindings);
    unifyAnnotation(table, list.children[1], table.errOf(arg), names, bindings);
  }
}

/** Whether an annotation mentions one of `names`, i.e. whether it needs an instantiation to resolve. */
export function mentionsTypeParam(annotation: Node, names: StringSet): boolean {
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
}

/** The set of a template's type parameter names, for `unifyAnnotation` and `mentionsTypeParam`. */
export function typeParamSet(template: TemplateInfo): StringSet {
  const names = new StringSet();
  for (const name of template.typeParams) {
    names.add(name);
  }
  return names;
}

/**
 * The message for a request that would not terminate. It names the type
 * argument that grew and the two shapes the rule accepts, never a number: a
 * user who sees it has to change the call, not raise a limit.
 */
export function nonTerminatingMessage(
  table: TypeTable,
  template: TemplateInfo,
  ancestor: Instantiation,
  args: i32[],
  index: i32
): string {
  const from = instanceDisplayName(table, template.sourceName, ancestor.typeArgs);
  const to = instanceDisplayName(table, template.sourceName, args);
  const grew = table.typeName(ancestor.typeArgs[index]);
  return (
    `Monomorphising \`${template.sourceName}\` would not terminate: \`${from}\` asks for \`${to}\`, which puts ` +
    `\`${grew}\` under a type constructor instead of passing it on, so the chain has no end; pass ` +
    `\`${template.typeParams[index]}\` itself, or a type that does not mention it`
  );
}

/**
 * The instantiation request. Answers the specialised signature for one
 * (template, type-argument tuple), creating and queueing it the first time it
 * is asked for — so a tuple seen twice is one `define`, and the FIFO queue
 * makes the enumeration order the discovery order in both compilers.
 */
export function instantiate(
  ctx: CheckContext,
  template: TemplateInfo,
  args: i32[],
  at: Node
): FunctionSig | null {
  const symbol = instanceSymbol(ctx.table, template.sourceName, args);
  const existing = ctx.program.instantiation(symbol);
  if (existing !== null) {
    return existing.sig;
  }
  // Termination: a request that puts one of its own type arguments under a
  // constructor is the shape whose chain has no end, refused by name rather
  // than by a depth count.
  const growing = expandingAncestor(ctx.table, ctx.currentInstance, template, args);
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
}

/**
 * A call whose callee is a generic template. The type arguments are inferred
 * from the argument types and are never written here (§2a: one token of
 * lookahead cannot tell `f<i32>(x)` from `(f < i32) > (x)`), so the whole of
 * the resolution is: check the arguments, unify, request the instantiation, and
 * then check the arguments *again* against the signature that came back — which
 * is the ordinary monomorphic check and reports the ordinary message.
 */
export function checkGenericCall(
  ctx: CheckContext,
  expr: Node,
  template: TemplateInfo,
  scope: Scope
): i32 {
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
      unifyAnnotation(ctx.table, annotation, argTypes[i], names, bindings);
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
}

/**
 * `$` separates a generic's name from its type arguments in every symbol the
 * compiler emits, so a *declared* name may not contain one — a class literally
 * called `Box$i32` would be the same symbol as `Box<i32>`. Locals, parameters
 * and fields keep it; only names that become symbols are restricted, which is
 * what makes the encoding injective.
 */
export function rejectDollarInSymbolName(ctx: CheckContext, name: string, what: string, node: Node): boolean {
  if (name.indexOf("$") < 0) {
    return false;
  }
  ctx.error(
    node,
    `\`${name}\` cannot be the name of a ${what} in ${LANGUAGE}: \`$\` separates a generic's name from its ` +
      "type arguments in the symbols the compiler emits"
  );
  return true;
}

/** A template's declared type parameter names, in order, from its fifth child. */
export function collectTypeParamNames(decl: Node): string[] {
  const names: string[] = [];
  for (const node of typeParameterList(decl).children) {
    if (node.kind === N_IDENT) {
      names.push(node.text);
    }
  }
  return names;
}
