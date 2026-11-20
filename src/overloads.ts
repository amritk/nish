// WP28 C1: overload signatures, the `overloads` feature of the compatibility
// dialect (`docs/LANGUAGE.md`, "The compatibility dialect").
//
// A function, method or constructor may be written as bodiless signatures
// followed by one implementation, as TypeScript reads them. Under `--compat`
// the signatures are lifted out of the tree before Phase 0 runs, so every
// pass after the checker sees the implementation alone and emits exactly
// what it would for it. The checker collects each signature, holds it to the
// implementation's (`attachOverloads`), and holds each call, after the
// implementation has accepted it, to one of them (`checkOverloadCall`), so a
// call TypeScript refuses because no overload takes it is refused here too.
// A strict build records the same signatures without lifting them, only so
// that its refusal can name the feature (`isOverloadSignature`).

import { CheckContext } from "./context"
import { collectParams } from "./declarations"
import { isTemplateFunction } from "./generics"
import {
  FLAG_ABSTRACT,
  FLAG_ACCESSOR,
  FLAG_ASYNC,
  FLAG_EXPORTED,
  FLAG_FOREIGN,
  FLAG_OPTIONAL,
  FLAG_REST,
  FLAG_STATIC,
  Node,
  NodeKind,
} from "./nodes"
import { FunctionSig } from "./program"
import { resolveType } from "./annotations"
import { T_ERROR } from "./types"

/** Whether `node` is a declaration of the kinds that take overload signatures, written without a body. */
const bodiless = (node: Node): boolean => {
  if (node.kind === NodeKind.FunctionDecl) {
    return (
      node.children[3].kind === NodeKind.Empty &&
      (node.flags & (FLAG_FOREIGN | FLAG_ASYNC)) === 0 &&
      node.children[0].kind === NodeKind.Ident &&
      !isTemplateFunction(node)
    )
  }
  if (node.kind === NodeKind.Method) {
    return (
      node.children[3].kind === NodeKind.Empty &&
      (node.flags & (FLAG_ABSTRACT | FLAG_ACCESSOR | FLAG_ASYNC)) === 0 &&
      node.children[0].kind === NodeKind.Ident &&
      (node.children.length < 5 || node.children[4].children.length === 0)
    )
  }
  if (node.kind === NodeKind.Constructor) {
    return node.children.length === 2 && node.children[1].kind === NodeKind.Empty
  }
  return false
}

/** Whether `node` has a body that can end a run of overload signatures. */
const endsRun = (node: Node): boolean => {
  if (node.kind === NodeKind.FunctionDecl) {
    return (
      node.children[3].kind === NodeKind.Block &&
      (node.flags & (FLAG_FOREIGN | FLAG_ASYNC)) === 0 &&
      !isTemplateFunction(node)
    )
  }
  if (node.kind === NodeKind.Method) {
    return (
      node.children[3].kind === NodeKind.Block &&
      (node.flags & (FLAG_ABSTRACT | FLAG_ACCESSOR | FLAG_ASYNC)) === 0 &&
      (node.children.length < 5 || node.children[4].children.length === 0)
    )
  }
  return (
    node.kind === NodeKind.Constructor &&
    node.children.length === 2 &&
    node.children[1].kind === NodeKind.Block
  )
}

/** Whether `a` and `b` declare the same function, method or constructor. */
const sameMember = (a: Node, b: Node): boolean => {
  if (a.kind !== b.kind) {
    return false
  }
  if (a.kind === NodeKind.Constructor) {
    return true
  }
  if (b.children[0].kind !== NodeKind.Ident || a.children[0].text !== b.children[0].text) {
    return false
  }
  const kept = a.kind === NodeKind.FunctionDecl ? FLAG_EXPORTED : FLAG_STATIC
  return (a.flags & kept) === (b.flags & kept)
}

/**
 * The position in `list` of the implementation that the signature at `i`
 * belongs to, or -1: a run of bodiless declarations of one name, ended by
 * one with a body. A run with no implementation after it is not one, and is
 * refused as a missing body in either dialect.
 */
const implementationAt = (list: Node[], i: i32): i32 => {
  const first = list[i]
  if (!bodiless(first)) {
    return -1
  }
  let j = i + 1
  while (j < list.length) {
    const next = list[j]
    if (!sameMember(first, next)) {
      return -1
    }
    if (!bodiless(next)) {
      return endsRun(next) ? j : -1
    }
    j = j + 1
  }
  return -1
}

/** `list` with every overload signature recorded, and taken out when `lift`. */
const recordFrom = (ctx: CheckContext, list: Node[], lift: boolean): Node[] => {
  const kept: Node[] = []
  let i = 0
  while (i < list.length) {
    const impl = implementationAt(list, i)
    if (impl < 0 || impl >= list.length) {
      kept.push(list[i])
      i = i + 1
      continue
    }
    const target = list[impl]
    while (i >= 0 && i < impl && i < list.length) {
      const signature = list[i]
      ctx.overloadSignatures.push(signature)
      ctx.overloadOf.push(target)
      if (!lift) {
        kept.push(signature)
      }
      i = i + 1
    }
  }
  return kept
}

/**
 * Record the overload signatures of a module's functions and of its classes'
 * methods and constructors, and lift them out of the tree when the build
 * allows `overloads`. A generic class keeps its signatures, and they are
 * refused as a missing body: a template's members are collected once
 * instantiated, and this version holds no signature to an instance.
 */
export const recordOverloads = (ctx: CheckContext, file: Node): void => {
  const lift = ctx.compatAllows("overloads")
  file.children = recordFrom(ctx, file.children, lift)
  for (const stmt of file.children) {
    if (stmt.kind === NodeKind.Class && stmt.children[4].children.length === 0) {
      stmt.children[3].children = recordFrom(ctx, stmt.children[3].children, lift)
    }
  }
}

/** Whether `node` is an overload signature that the `overloads` feature would accept. */
export const isOverloadSignature = (ctx: CheckContext, node: Node): boolean =>
  ctx.overloadSignatures.indexOf(node) >= 0

/** How many arguments a call must write to match overload `ov`, whose first `skip` are `this`. */
const leastOf = (ov: FunctionSig): i32 => {
  const at: i32 = ov.decl.kind === NodeKind.Constructor ? 0 : 1
  let least = 0
  for (const param of ov.decl.children[at].children) {
    if ((param.flags & FLAG_OPTIONAL) !== 0) {
      return least
    }
    least = least + 1
  }
  return least
}

/** NL2800: an overload signature the implementation cannot stand behind. */
const incompatible = (ctx: CheckContext, node: Node, shown: string, why: string): void => {
  ctx.error(node, `This overload signature of \`${shown}\` is not compatible with its implementation: ${why}`)
}

/**
 * Collect the overload signatures written before `sig`'s declaration and
 * hold each to it, as `tsc` does (TS2394): every argument list a signature
 * takes, the implementation takes too, and both give a call the same type.
 * `owner` is the type of `this` for a member, -1 for a function.
 */
export const attachOverloads = (ctx: CheckContext, sig: FunctionSig, owner: i32, shown: string): void => {
  if (!ctx.compatAllows("overloads")) {
    return
  }
  const skip = owner >= 0 ? 1 : 0
  let i = 0
  while (i < ctx.overloadOf.length) {
    if (ctx.overloadOf[i] !== sig.decl) {
      i = i + 1
      continue
    }
    const node = ctx.overloadSignatures[i]
    i = i + 1
    const ov = new FunctionSig(sig.name, sig.sourceName, node)
    ov.origin = sig.origin
    ov.exported = sig.exported
    ov.role = sig.role
    ov.owner = sig.owner
    const isCtor = node.kind === NodeKind.Constructor
    const at: i32 = isCtor ? 0 : 1
    const params = node.children[at]
    collectParams(ctx, ov, params, owner, false)
    if (isCtor) {
      ov.returnType = sig.returnType
    } else if (node.children[2].kind === NodeKind.Empty) {
      incompatible(ctx, node, shown, "it needs an explicit return type annotation")
      continue
    } else {
      ov.returnType = resolveType(node.children[2], ctx)
    }
    if (!holdsTo(ctx, ov, sig, skip, node, params, shown)) {
      continue
    }
    sig.overloads.push(ov)
  }
}

/** Whether overload `ov` is one `sig` stands behind; `false` when it reported. */
const holdsTo = (
  ctx: CheckContext,
  ov: FunctionSig,
  sig: FunctionSig,
  skip: i32,
  node: Node,
  params: Node,
  shown: string
): boolean => {
  if (sig.restIndex >= 0) {
    incompatible(ctx, node, shown, "an implementation with a rest parameter takes no overload signatures")
    return false
  }
  for (const param of params.children) {
    if ((param.flags & FLAG_REST) !== 0) {
      incompatible(ctx, param, shown, "a signature takes no rest parameter")
      return false
    }
    if (
      (param.flags & FLAG_OPTIONAL) === 0 &&
      param !== params.children[0] &&
      leastOf(ov) < indexIn(params, param)
    ) {
      incompatible(ctx, param, shown, "a required parameter cannot follow an optional one")
      return false
    }
  }
  const written = ov.paramTypes.length - skip
  if (written > sig.writtenArity() - skip) {
    incompatible(
      ctx,
      node,
      shown,
      `it takes ${written} argument(s), and the implementation at most ${sig.writtenArity() - skip}`
    )
    return false
  }
  if (leastOf(ov) < sig.requiredArity() - skip) {
    incompatible(
      ctx,
      node,
      shown,
      `it may be called with ${leastOf(ov)} argument(s), and the implementation needs ${sig.requiredArity() - skip}`
    )
    return false
  }
  // The first parameter the implementation does not take, named once the
  // loop is over, so that the loop builds no text.
  let k = skip
  while (k < ov.paramTypes.length && k < sig.paramTypes.length) {
    const have = ov.paramTypes[k]
    if (have !== T_ERROR && sig.paramTypes[k] !== T_ERROR && !ctx.table.assignable(have, sig.paramTypes[k])) {
      break
    }
    k = k + 1
  }
  if (k < ov.paramTypes.length && k < sig.paramTypes.length && k - skip < params.children.length) {
    incompatible(
      ctx,
      params.children[k - skip],
      shown,
      `parameter ${k - skip + 1} is ${ctx.table.typeName(ov.paramTypes[k])}, which the implementation's ${ctx.table.typeName(sig.paramTypes[k])} does not take`
    )
    return false
  }
  if (ov.returnType !== T_ERROR && sig.returnType !== T_ERROR && ov.returnType !== sig.returnType) {
    incompatible(
      ctx,
      node.children[2],
      shown,
      `it returns ${ctx.table.typeName(ov.returnType)} and the implementation ${ctx.table.typeName(sig.returnType)}, and a call has the implementation's type`
    )
    return false
  }
  return true
}

/** The position of `param` in `params`. */
const indexIn = (params: Node, param: Node): i32 => params.children.indexOf(param)

/**
 * Hold a call the implementation accepted to `sig`'s overload signatures:
 * `got` are its arguments' types, after the `skip` that are `this`. A call no
 * signature takes is refused (NL2801), as `tsc` refuses it (TS2769), because
 * the implementation's own signature is not one a caller may call.
 */
export const checkOverloadCall = (
  ctx: CheckContext,
  call: Node,
  sig: FunctionSig,
  got: i32[],
  skip: i32,
  shown: string
): void => {
  if (sig.overloads.length === 0) {
    return
  }
  for (const type of got) {
    if (type === T_ERROR) {
      return
    }
  }
  for (const ov of sig.overloads) {
    if (accepts(ctx, ov, got, skip)) {
      return
    }
  }
  const spelled: string[] = []
  for (const type of got) {
    spelled.push(ctx.table.typeName(type))
  }
  ctx.error(
    call,
    `No overload signature of \`${shown}\` takes (${spelled.join(", ")}): a call is held to the signatures written before the implementation, not to the implementation's own`
  )
}

/** Whether overload `ov` takes arguments of types `got`. */
const accepts = (ctx: CheckContext, ov: FunctionSig, got: i32[], skip: i32): boolean => {
  if (got.length < leastOf(ov) || got.length > ov.paramTypes.length - skip) {
    return false
  }
  let i = 0
  while (i < got.length) {
    if (!ctx.table.assignable(got[i], ov.paramTypes[i + skip])) {
      return false
    }
    i = i + 1
  }
  return true
}
