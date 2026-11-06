// The entry module's top-level code (docs/LANGUAGE.md → "Top-level code").
//
// An entry module that declares no `main` may hold statements at the top
// level, the way a script does. They run as the program's `main`, so this
// pass moves them into one: a synthesized `export const main = (): void =>
// { ... }` whose block holds them, in order, and which carries FLAG_SCRIPT.
// Every pass after the parser then sees an ordinary entry point, which is why
// the native program costs nothing over writing `main` by hand.
//
// What moves:
//
//   - every statement the parser read where a declaration stands, except
//     `return`, `break` and `continue`, which TypeScript refuses outside a
//     function and which stay behind for the checker to refuse as it always has;
//   - every top-level `let`;
//   - every top-level `const` that no declaration names. A `const` a function,
//     a class or another module constant names stays a module constant, with
//     its rules (an annotation, a value the compiler computes), because a
//     function cannot read a local of `main`. That leaves `const xs = [1, 2]`
//     free to be what a script means by it.
//
// A module that declares a `main` of any spelling is left alone, so its
// top-level statements keep the refusal they had. So is one with nothing but
// constants to move: constants alone are a module, not a script.

import { Parser } from "./parser"
import { StringMap, StringSet } from "./map"
import {
  FLAG_CONST,
  FLAG_EXPORTED,
  FLAG_FOREIGN,
  FLAG_SCRIPT,
  FLAG_VAR,
  N_BLOCK,
  N_CLASS,
  N_DO,
  N_ENUM,
  N_EXPR_STMT,
  N_FOR,
  N_FOR_OF,
  N_FUNCTION,
  N_IDENT,
  N_IF,
  N_LABELED,
  N_MODULE_CONST,
  N_SWITCH,
  N_THROW,
  N_TRY,
  N_TYPE_REF,
  N_VAR,
  N_WHILE,
  N_WITH,
  Node,
} from "./nodes"

/** Whether `stmt` is a statement the parser read at the top level and that moves into `main`. */
const isTopLevelStatement = (stmt: Node): boolean => {
  switch (stmt.kind) {
    case N_EXPR_STMT:
    case N_IF:
    case N_WHILE:
    case N_DO:
    case N_FOR:
    case N_FOR_OF:
    case N_SWITCH:
    case N_BLOCK:
    case N_LABELED:
    case N_THROW:
    case N_TRY:
    case N_WITH:
      return true
    default:
      return false
  }
}

/** A top-level `let`: a module constant node with neither `const` nor `var`. */
const isTopLevelLet = (stmt: Node): boolean =>
  stmt.kind === N_MODULE_CONST && (stmt.flags & (FLAG_CONST | FLAG_VAR | FLAG_EXPORTED)) === 0

/** A top-level `const` that is not exported, which moves unless a declaration names it. */
const isLocalCandidate = (stmt: Node): boolean =>
  stmt.kind === N_MODULE_CONST && (stmt.flags & FLAG_CONST) !== 0 && (stmt.flags & FLAG_EXPORTED) === 0

/** Every name `node` spells, into `names`. Shadowing is not resolved: a name a function only shadows still counts, which keeps a constant a constant, never the reverse. */
const collectSpelledNames = (node: Node, names: StringSet): void => {
  if (node.kind === N_IDENT) {
    names.add(node.text)
  }
  for (const child of node.children) {
    collectSpelledNames(child, names)
  }
}

/** Whether `stmt`'s declarations bind any name in `names`. */
const bindsAny = (stmt: Node, names: StringSet): boolean => {
  for (const decl of stmt.children[0].children) {
    if (decl.children[0].kind === N_IDENT && names.has(decl.children[0].text)) {
      return true
    }
  }
  return false
}

/** Whether the module declares a function called `main` in any spelling. */
const declaresMain = (file: Node): boolean => {
  for (const stmt of file.children) {
    if (stmt.kind === N_FUNCTION && stmt.children[0].kind === N_IDENT && stmt.children[0].text === "main") {
      return true
    }
  }
  return false
}

/**
 * Move the entry module's top-level code into a synthesized `main`. The new
 * nodes come from `parser` so their ids stay dense, and take the span of the
 * code they hold; the name and the return type, which nobody wrote, are empty
 * spans at its start.
 */
export const liftScript = (parser: Parser, file: Node): void => {
  if (declaresMain(file)) {
    return
  }
  let code = false
  for (const stmt of file.children) {
    if (isTopLevelStatement(stmt) || isTopLevelLet(stmt)) {
      code = true
    }
  }
  if (!code) {
    return
  }
  // Which constants stay: those a declaration names, then those a staying
  // constant's initializer names, until nothing new stays.
  const named = new StringSet()
  for (const stmt of file.children) {
    if (!isTopLevelStatement(stmt) && stmt.kind !== N_MODULE_CONST) {
      collectSpelledNames(stmt, named)
    }
  }
  const stays: boolean[] = []
  for (const stmt of file.children) {
    stays.push(!isLocalCandidate(stmt))
  }
  let changed = true
  while (changed) {
    changed = false
    let i = 0
    while (i < file.children.length) {
      const stmt = file.children[i]
      if (i < stays.length && !stays[i] && bindsAny(stmt, named)) {
        stays[i] = true
        collectSpelledNames(stmt, named)
        changed = true
      }
      i = i + 1
    }
  }
  const body = parser.node(N_BLOCK, 0, 0)
  const main = parser.node(N_FUNCTION, 0, 0)
  const kept: Node[] = []
  let i = 0
  while (i < file.children.length) {
    const stmt = file.children[i]
    const moves =
      isTopLevelStatement(stmt) ||
      isTopLevelLet(stmt) ||
      (isLocalCandidate(stmt) && i < stays.length && !stays[i])
    if (moves) {
      if (body.children.length === 0) {
        body.start = stmt.start
        kept.push(main)
      }
      // A module constant and a `let`/`const` statement share their layout,
      // a LIST of VAR_DECL, so the node changes kind and keeps its children.
      if (stmt.kind === N_MODULE_CONST) {
        stmt.kind = N_VAR
      }
      body.children.push(stmt)
      body.end = stmt.end
    } else {
      kept.push(stmt)
    }
    i = i + 1
  }
  main.start = body.start
  main.end = body.end
  main.flags = FLAG_EXPORTED | FLAG_SCRIPT
  const name = parser.node(N_IDENT, body.start, body.start)
  name.text = "main"
  main.children.push(name)
  main.children.push(parser.list())
  const returns = parser.node(N_TYPE_REF, body.start, body.start)
  returns.text = "void"
  returns.children.push(parser.list())
  main.children.push(returns)
  main.children.push(body)
  main.children.push(parser.list())
  file.children = kept
}

/** The synthesized `main` of a script entry, or null when the module has none. */
export const scriptMain = (file: Node): Node | null => {
  for (const stmt of file.children) {
    if (stmt.kind === N_FUNCTION && (stmt.flags & FLAG_SCRIPT) !== 0) {
      return stmt
    }
  }
  return null
}

/**
 * Whether `stmt`, a top-level declaration, exists when the module runs under
 * Node, so that a statement above it would find it not yet made: a function,
 * a class, an enum or a module constant. Types, interfaces, imports and
 * `declare function` have no value to wait for.
 */
const isRuntimeDeclaration = (stmt: Node): boolean => {
  switch (stmt.kind) {
    case N_FUNCTION:
      return (stmt.flags & (FLAG_FOREIGN | FLAG_SCRIPT)) === 0
    case N_CLASS:
      return (stmt.flags & FLAG_FOREIGN) === 0
    case N_ENUM:
    case N_MODULE_CONST:
      return true
    default:
      return false
  }
}

/** The name node a runtime declaration is reported at: a constant's first binding, anything else's own name. */
export const declarationName = (stmt: Node): Node =>
  stmt.kind === N_MODULE_CONST ? stmt.children[0].children[0].children[0] : stmt.children[0]

/** A statement of the top-level code that reaches a declaration standing below it. */
export class LateUse {
  /** The statement of the code, inside the synthesized `main`. */
  stmt: Node
  /** The top-level declaration it reaches before Node has made it. */
  decl: Node

  constructor(stmt: Node, decl: Node) {
    this.stmt = stmt
    this.decl = decl
  }
}

/**
 * Every runtime declaration the top-level code reaches before it exists under
 * Node: a statement names it, or names a declaration whose body does, and it
 * stands below that statement. Natively every declaration exists before
 * `main` runs, so this is what would differ. Shadowing is not resolved, so a
 * name only shadowed still counts, which errs toward the refusal.
 */
export const lateUses = (file: Node, main: Node): LateUse[] => {
  const index = new StringMap()
  let i = 0
  while (i < file.children.length) {
    const stmt = file.children[i]
    if (isRuntimeDeclaration(stmt)) {
      if (stmt.kind === N_MODULE_CONST) {
        for (const decl of stmt.children[0].children) {
          if (decl.children[0].kind === N_IDENT) {
            index.add(decl.children[0].text, i)
          }
        }
      } else if (stmt.children[0].kind === N_IDENT) {
        index.add(stmt.children[0].text, i)
      }
    }
    i = i + 1
  }
  const found: LateUse[] = []
  const reported = new StringSet()
  for (const stmt of main.children[3].children) {
    const seen = new StringSet()
    const pending: Node[] = [stmt]
    let next = 0
    while (next < pending.length) {
      const names = new StringSet()
      collectSpelledNames(pending[next], names)
      next = next + 1
      let k = 0
      while (k < names.size()) {
        const name = names.at(k)
        k = k + 1
        const at = index.get(name, -1)
        if (at < 0 || seen.has(name)) {
          continue
        }
        seen.add(name)
        const decl = file.children[at]
        if (decl.start > stmt.start) {
          if (reported.add(name)) {
            found.push(new LateUse(stmt, decl))
          }
        } else {
          pending.push(decl)
        }
      }
    }
  }
  return found
}

/**
 * The module's top-level nodes as the source spells them: the synthesized
 * `main` gives way to the statements it holds, each back where it was
 * written. `--emit-ts` writes a script back out this way, since Node runs the
 * code where it stands.
 */
export const sourceOrder = (file: Node): Node[] => {
  const main = scriptMain(file)
  if (main === null) {
    return file.children
  }
  const lifted = main.children[3].children
  const ordered: Node[] = []
  let j = 0
  for (const stmt of file.children) {
    if (stmt === main) {
      continue
    }
    while (j < lifted.length && lifted[j].start < stmt.start) {
      ordered.push(lifted[j])
      j = j + 1
    }
    ordered.push(stmt)
  }
  while (j < lifted.length) {
    ordered.push(lifted[j])
    j = j + 1
  }
  return ordered
}
