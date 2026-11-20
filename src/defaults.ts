// WP28 C1: a default that is not a constant, the second half of the
// `optional-params` feature of the compatibility dialect (`docs/LANGUAGE.md`,
// "The compatibility dialect").
//
// A strict default is a constant each call that leaves the argument out
// passes itself. TypeScript evaluates a default in the callee instead, once
// per call that leaves the argument out, after the arguments and left to
// right, so a default may call a function, build an array or read an earlier
// parameter. Under `--compat` a top-level function with such a default is
// given one wrapper per argument count a call may stop at, before the checker
// numbers the tree: `f__default<n>` takes the first `n` parameters, evaluates
// the default of parameter `n` in a `const` of its name, and passes them on to
// the next wrapper, the last of which calls `f` itself. The defaults it moved
// become required parameters of `f`, so each runs exactly when TypeScript runs
// it, and the checker sends a call that writes `n` arguments to the wrapper
// for `n` (`defaultTarget`). A constant default after the last moved one stays
// on `f` and is passed by the call as before.
//
// Only a function every call to which this module sees and routes takes
// wrappers: one that is not exported (a call from another module would pass
// the defaults it leaves out itself) and not overloaded (a signature names
// the implementation, not a wrapper), with a default on every parameter from
// the first lifted one to the last, so that each wrapper drops one argument.
// Any other function with such a default keeps the strict refusal, with a
// note that names the rule.

import { CheckContext } from "./context"
import {
  FLAG_ASYNC,
  FLAG_CONST,
  FLAG_DEFAULT,
  FLAG_EXPORTED,
  FLAG_FOREIGN,
  FLAG_GENERATOR,
  FLAG_OPTIONAL,
  FLAG_REST,
  FLAG_SIGNATURE,
  Node,
  NodeKind,
} from "./nodes"
import { Parser } from "./parser"
import { FunctionSig } from "./program"

/** The wrappers one module was given: beside each, the function it calls on behalf of and the argument count it takes. */
export class DefaultWrappers {
  impls: Node[]
  arities: i32[]
  wrappers: Node[]
  /**
   * Each parameter whose default a wrapper would evaluate but does not: in a
   * build without the feature, every one; with it, those of a function the
   * feature leaves out (`admits`). Their refusal names why.
   */
  lifted: Node[]

  constructor() {
    this.impls = []
    this.arities = []
    this.wrappers = []
    this.lifted = []
  }
}

/** A copy of `node` and everything under it, numbered by `parser`. */
const cloneTree = (parser: Parser, node: Node): Node => {
  const made = parser.node(node.kind, node.start, node.end)
  made.text = node.text
  made.flags = node.flags
  for (const child of node.children) {
    made.children.push(cloneTree(parser, child))
  }
  return made
}

/**
 * Whether default `init` is one the strict dialect may accept as a constant,
 * and so stays on the function: a literal, a negated number, a template with
 * no substitution, an enum member or an earlier parameter's name. Anything
 * else is evaluated per call, which the strict dialect refuses.
 */
const isConstantDefault = (init: Node, earlier: string[]): boolean => {
  switch (init.kind) {
    case NodeKind.Number:
    case NodeKind.Bigint:
    case NodeKind.String:
    case NodeKind.True:
    case NodeKind.False:
    case NodeKind.Null:
      return true
    case NodeKind.Unary:
      return (
        init.text === "-" &&
        init.children.length === 1 &&
        (init.children[0].kind === NodeKind.Number || init.children[0].kind === NodeKind.Bigint)
      )
    case NodeKind.Template:
      return init.children.length <= 1
    case NodeKind.Ident:
      return earlier.indexOf(init.text) >= 0
    case NodeKind.Member:
      return init.children.length === 1 && init.children[0].kind === NodeKind.Ident
    default:
      return false
  }
}

/** The position of the last default of `params` that is not a constant, or -1 when the function needs no wrapper. */
const lastEvaluated = (decl: Node): i32 => {
  const params = decl.children[1].children
  const earlier: string[] = []
  let last = -1
  let i = 0
  while (i < params.length) {
    const param = params[i]
    if (param.kind !== NodeKind.Param || param.children[0].kind !== NodeKind.Ident) {
      return -1
    }
    if ((param.flags & FLAG_REST) !== 0 || param.children[1].kind === NodeKind.Empty) {
      return -1
    }
    if (param.children[1].kind === NodeKind.TypeFunction) {
      return -1
    }
    if ((param.flags & FLAG_DEFAULT) !== 0 && !isConstantDefault(param.children[2], earlier)) {
      last = i
    }
    earlier.push(param.children[0].text)
    i = i + 1
  }
  // An `x?` before the last such default would become a parameter a wrapper
  // passes on with no value to give it, so the function keeps its refusal.
  i = 0
  while (i < last && i < params.length) {
    if ((params[i].flags & FLAG_OPTIONAL) !== 0) {
      return -1
    }
    i = i + 1
  }
  return last
}

/** Whether `decl` is a top-level function a wrapper can stand in front of. */
const takesWrappers = (decl: Node): boolean =>
  decl.kind === NodeKind.FunctionDecl &&
  decl.children[0].kind === NodeKind.Ident &&
  decl.children[3].kind === NodeKind.Block &&
  decl.children[2].kind !== NodeKind.Empty &&
  (decl.flags & (FLAG_FOREIGN | FLAG_ASYNC | FLAG_GENERATOR | FLAG_DEFAULT)) === 0 &&
  decl.children.length > 4 &&
  decl.children[4].children.length === 0

/** The position of the first parameter of `params` with a default, at or before `last`. */
const firstDefault = (params: Node[], last: i32): i32 => {
  let first = 0
  while (first < last && first < params.length && (params[first].flags & FLAG_DEFAULT) === 0) {
    first = first + 1
  }
  return first
}

/** Whether `file` writes a signature with no body for `name`, which makes the function overloaded. */
const isOverloaded = (file: Node, name: string): boolean => {
  for (const stmt of file.children) {
    if (
      stmt.kind === NodeKind.FunctionDecl &&
      stmt.children.length > 3 &&
      stmt.children[0].kind === NodeKind.Ident &&
      stmt.children[0].text === name &&
      stmt.children[3].kind !== NodeKind.Block
    ) {
      return true
    }
  }
  return false
}

/**
 * Whether the feature lifts the defaults of `decl` up to parameter `last`:
 * the function is neither exported nor overloaded, and every parameter from
 * the first default to `last` has one.
 */
const admits = (file: Node, decl: Node, last: i32): boolean => {
  if ((decl.flags & FLAG_EXPORTED) !== 0 || isOverloaded(file, decl.children[0].text)) {
    return false
  }
  const params = decl.children[1].children
  let i = firstDefault(params, last)
  while (i >= 0 && i <= last && i < params.length) {
    if ((params[i].flags & FLAG_DEFAULT) === 0) {
      return false
    }
    i = i + 1
  }
  return true
}

/**
 * Give each `x?` under `node` the `null` a call that leaves it out passes: a
 * node of its own, so that the checker can record its type for the walks
 * that read a default. Only a build that allows `optional-params` has one.
 */
const markOptional = (parser: Parser, node: Node): void => {
  if (
    node.kind === NodeKind.Param &&
    (node.flags & (FLAG_OPTIONAL | FLAG_DEFAULT)) === FLAG_OPTIONAL &&
    node.children.length === 2
  ) {
    node.children.push(parser.node(NodeKind.Null, node.end, node.end))
  }
  for (const child of node.children) {
    markOptional(parser, child)
  }
}

/** The name of the wrapper of `name` that takes `arity` arguments. */
const wrapperName = (name: string, arity: i32): string => `${name}__default${arity}`

/** An identifier node reading `name`, spanning `at`. */
const ident = (parser: Parser, name: string, at: Node): Node => {
  const made = parser.node(NodeKind.Ident, at.start, at.end)
  made.text = name
  return made
}

/** The wrapper of `decl` that takes its first `arity` parameters, evaluates default `arity` and calls `next`. */
const buildWrapper = (parser: Parser, decl: Node, arity: i32, next: string): Node => {
  const params = decl.children[1].children
  const moved = params[arity]
  const wrapper = parser.node(NodeKind.FunctionDecl, decl.start, decl.end)
  wrapper.children.push(ident(parser, wrapperName(decl.children[0].text, arity), decl.children[0]))
  const list = parser.list()
  let i = 0
  while (i >= 0 && i < arity && i < params.length) {
    const source = params[i]
    const param = parser.node(NodeKind.Param, source.start, source.end)
    param.flags = FLAG_SIGNATURE
    param.children.push(cloneTree(parser, source.children[0]))
    param.children.push(cloneTree(parser, source.children[1]))
    list.children.push(param)
    i = i + 1
  }
  wrapper.children.push(parser.closeList(list))
  wrapper.children.push(cloneTree(parser, decl.children[2]))
  const body = parser.node(NodeKind.Block, moved.start, moved.end)
  const local = parser.node(NodeKind.Var, moved.start, moved.end)
  local.flags = FLAG_CONST
  const decls = parser.list()
  const binding = parser.node(NodeKind.VarDecl, moved.start, moved.end)
  binding.children.push(cloneTree(parser, moved.children[0]))
  binding.children.push(cloneTree(parser, moved.children[1]))
  binding.children.push(moved.children[2])
  decls.children.push(binding)
  local.children.push(parser.closeList(decls))
  body.children.push(local)
  const call = parser.node(NodeKind.Call, moved.start, moved.end)
  call.children.push(ident(parser, next, decl.children[0]))
  const args = parser.list()
  i = 0
  while (i <= arity && i < params.length) {
    args.children.push(ident(parser, params[i].children[0].text, moved))
    i = i + 1
  }
  call.children.push(parser.closeList(args))
  const returned = decl.children[2]
  const isVoid = returned.kind === NodeKind.TypeRef && returned.text === "void"
  const stmt = parser.node(isVoid ? NodeKind.ExprStmt : NodeKind.Return, moved.start, moved.end)
  stmt.children.push(call)
  body.children.push(stmt)
  wrapper.children.push(body)
  wrapper.children.push(parser.list())
  return wrapper
}

/**
 * Give each top-level function of `file` with a default that is not a
 * constant its wrappers, and make the defaults they evaluate required
 * parameters of the function. Run before the checker is made, so the nodes
 * it builds are numbered with the rest; `allowed` is whether the build allows
 * `optional-params`. Without it the tree is left as written, and the
 * parameters a wrapper would evaluate are recorded, so that their refusal
 * names the feature; with it, so are those of a function `admits` leaves out.
 */
export const liftDefaults = (parser: Parser, file: Node, allowed: boolean): DefaultWrappers => {
  const made = new DefaultWrappers()
  if (!allowed) {
    for (const stmt of file.children) {
      if (takesWrappers(stmt)) {
        const last = lastEvaluated(stmt)
        const params = stmt.children[1].children
        let i = 0
        while (i <= last && i < params.length) {
          made.lifted.push(params[i])
          i = i + 1
        }
      }
    }
    return made
  }
  markOptional(parser, file)
  const kept: Node[] = []
  for (const stmt of file.children) {
    kept.push(stmt)
    if (!takesWrappers(stmt)) {
      continue
    }
    const last = lastEvaluated(stmt)
    if (last < 0) {
      continue
    }
    const params = stmt.children[1].children
    if (!admits(file, stmt, last)) {
      let i = 0
      while (i <= last && i < params.length) {
        made.lifted.push(params[i])
        i = i + 1
      }
      continue
    }
    const first = firstDefault(params, last)
    const name = stmt.children[0].text
    let arity = first
    while (arity <= last) {
      const next = arity < last ? wrapperName(name, arity + 1) : name
      const wrapper = buildWrapper(parser, stmt, arity, next)
      kept.push(wrapper)
      made.impls.push(stmt)
      made.arities.push(arity)
      made.wrappers.push(wrapper)
      arity = arity + 1
    }
    let i = first
    while (i >= 0 && i <= last && i < params.length) {
      const param = params[i]
      param.flags = param.flags & ~FLAG_DEFAULT
      param.children = [param.children[0], param.children[1]]
      i = i + 1
    }
  }
  file.children = kept
  return made
}

/**
 * The function a call to `sig` that writes `count` arguments goes to: the
 * wrapper that evaluates the defaults it leaves out, or `sig` itself.
 */
export const defaultTarget = (ctx: CheckContext, sig: FunctionSig, count: i32): FunctionSig => {
  let i = 0
  while (i < ctx.defaultImpls.length) {
    if (ctx.defaultImpls[i] === sig.decl && ctx.defaultArities[i] === count) {
      const wrapper = ctx.defaultWrappers[i]
      for (const candidate of ctx.program.functions) {
        if (candidate.decl === wrapper) {
          return candidate
        }
      }
    }
    i = i + 1
  }
  return sig
}
