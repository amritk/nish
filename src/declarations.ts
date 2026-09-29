// Top-level declarations for stage1 (stage0's `src/checker/declarations.ts`,
// docs/wp14-selfhost.md milestone S3): function signatures, `export`,
// `import`, and the entry point.
//
// The forms of TypeScript the language forbids are parsed into the nodes they
// resemble and refused where their rule is owned (WP33 R1, `src/nodes.ts`):
// every import form but `import { a, b as c } from "..."` is refused here, in
// `collectImports`, in the order stage0 asked, and the rest of this file is
// the semantic half: names, types, arity and the rules about `main`.

import { refuseTopLevelForm } from "./checker"
import { CheckContext } from "./context"
import { isNishSpecifier, nishModuleNames } from "./nish-modules"
import { STD_PREFIX } from "./branding"
import { parseBareSpecifier } from "./packages"
import { rejectForeignPointer, resolveType } from "./annotations"
import { functionTypeHereMessage, isFunctionParameter } from "./generics"
import { isThreadsSource } from "./parallel"
import { FLAG_COMPUTED, FLAG_EXPORTED, FLAG_TYPE_ONLY, N_EMPTY, N_IDENT, N_LIST, Node } from "./nodes"
import { FunctionSig, ImportBinding, ROLE_FUNCTION } from "./program"
import { isForeignType, T_ERROR, T_I32, T_VOID } from "./types"

/** Symbol the entry module's `export function main` is emitted under. */
const ENTRY_MAIN_SYMBOL: string = "nish_main"

export const isExported = (node: Node): boolean => (node.flags & FLAG_EXPORTED) !== 0

/**
 * The parameters of a function, method or constructor, appended to `sig`.
 * `owner` is the type of `this` for a member and -1 for a free function; a
 * member's `this` is `params[0]`, which is the calling convention the whole
 * emitter is written against.
 */
export const collectParams = (
  ctx: CheckContext,
  sig: FunctionSig,
  list: Node,
  owner: i32,
  /**
   * A `declare function`'s parameters, which are the one place a `CPtr` is
   * welcome (WP27 S2). The flag is here rather than a guard at each caller
   * because this is the single list every signature is built from, so a new
   * spelling of a function cannot arrive without answering the question.
   */
  foreign: boolean
): void => {
  if (owner >= 0) {
    sig.paramNames.push("this")
    sig.paramTypes.push(owner)
  }
  for (const param of list.children) {
    const name = param.children[0].text
    // WP29: a function-typed parameter is resolved at each call rather than
    // here — it names a callee, not a type — so it takes its position and no
    // more. Only a top-level function may have one; everywhere else the
    // parameter is refused by what it belongs to.
    if (isFunctionParameter(param)) {
      // One method may take one: `ThreadScope.spawn` in `nish/threads`, whose
      // task is named at the call like a data-parallel body (WP29 P2).
      if ((owner >= 0 && !isThreadsSource(ctx.program)) || foreign) {
        const what = foreign ? "a `declare function`" : "a method or a constructor"
        ctx.error(param.children[1], functionTypeHereMessage(name, what))
        continue
      }
      if (sig.paramNames.indexOf(name) >= 0) {
        ctx.error(param, `Duplicate parameter \`${name}\``)
        continue
      }
      while (sig.compileTime.length < sig.paramNames.length) {
        sig.compileTime.push(false)
      }
      sig.compileTime.push(true)
      sig.paramNames.push(name)
      sig.paramTypes.push(T_VOID)
      continue
    }
    const type = resolveType(param.children[1], ctx)
    let duplicate = false
    for (const seen of sig.paramNames) {
      if (seen === name) {
        duplicate = true
      }
    }
    if (duplicate) {
      ctx.error(param, `Duplicate parameter \`${name}\``)
      continue
    }
    if (!foreign) {
      rejectForeignPointer(ctx, type, "a parameter of a function this program defines", param.children[1])
    }
    sig.paramNames.push(name)
    sig.paramTypes.push(type)
  }
}

/**
 * One `function` declaration's signature. The body is not looked at: pass 2
 * checks bodies once every callee in the program is known, which is what lets
 * functions call each other in any order.
 */
export const collectFunctionSignature = (ctx: CheckContext, decl: Node): FunctionSig => {
  const name = decl.children[0].text
  const sig = new FunctionSig(name, name, decl)
  sig.origin = ctx.source
  sig.exported = isExported(decl)
  sig.role = ROLE_FUNCTION
  if (name.startsWith("nish_")) {
    ctx.error(decl.children[0], "Function names starting with `nish_` are reserved for the runtime")
  }
  const foreign = sig.foreign()
  collectParams(ctx, sig, decl.children[1], -1, foreign)
  const returnAnnotation = decl.children[2]
  if (returnAnnotation.kind === N_EMPTY) {
    // The pass 1 sweep has refused it (NL2096, `refuseUnsupportedForms`).
    sig.returnType = T_ERROR
  } else {
    sig.returnType = resolveType(returnAnnotation, ctx)
  }
  if (foreign) {
    checkForeignSignature(ctx, sig, decl, name)
  } else {
    // WP27 S2: a foreign pointer never crosses a boundary this compiler
    // describes. `--emit-header`, `--emit-dts` and `--emit-napi` all render an
    // exported signature, and none of the three has a spelling for an address
    // whose provenance and lifetime are unknown — so rather than teach three
    // generators to skip it, the type is refused where it would reach them.
    // The parameters were answered for by `collectParams` above.
    rejectForeignPointer(
      ctx,
      sig.returnType,
      "the return type of a function this program defines",
      returnAnnotation
    )
  }
  return sig
}

/**
 * The rules a `declare function` adds (WP27 S1, widened by S2): no body, not
 * exported, and a scalar or a `CPtr` in every position.
 *
 * The rule is what makes this sound rather than merely small, and S2 does not
 * weaken it: no pointer *this compiler allocated* crosses the boundary in
 * either direction, so there is still nothing for the escape analysis to be
 * wrong about. What S2 adds is a pointer coming back that the compiler must
 * never mistake for one of its own (`docs/wp27-ffi.md` §2, §3).
 */
const checkForeignSignature = (ctx: CheckContext, sig: FunctionSig, decl: Node, name: string): void => {
  if (sig.body() !== null) {
    ctx.error(decl, "`declare function` declares a C function this program calls, so it must have no body")
  }
  if (sig.exported) {
    ctx.error(
      decl.children[0],
      `\`declare function ${name}\` cannot be exported: it is a C function this program calls, not one it defines`
    )
  }
  let i = 0
  while (i < sig.paramTypes.length) {
    if (ctx.table.isRanged(sig.paramTypes[i])) {
      refuseForeignRange(ctx, decl, name, `takes \`${sig.paramNames[i]}\` as`, sig.paramTypes[i])
    } else if (!isForeignType(ctx.table, sig.paramTypes[i])) {
      const spelled = ctx.table.typeName(sig.paramTypes[i])
      ctx.error(
        decl,
        `Parameter \`${sig.paramNames[i]}\` of \`declare function ${name}\` is ${spelled}, and a declared C function takes scalars and \`CPtr\` only`
      )
    } else if (ctx.table.isNullable(sig.paramTypes[i])) {
      // A parameter cannot be `CPtr | null`, and the asymmetry with the return
      // type is the rule §3 states as "`null` only from a foreign call": the
      // callee is the only thing that can say "no address", so `null` arrives
      // from C and is narrowed before it goes back. Without this a program
      // could hand C a null it never got from C, which is the one thing the
      // narrowing was there to stop.
      ctx.error(
        decl,
        `Parameter \`${sig.paramNames[i]}\` of \`declare function ${name}\` cannot be nullable: a foreign pointer is narrowed with \`!== null\` before it is passed back, because only the C function it came from can hand out a null one`
      )
    }
    i = i + 1
  }
  if (ctx.table.isRanged(sig.returnType)) {
    refuseForeignRange(ctx, decl.children[2], name, "returns", sig.returnType)
  } else if (!isForeignType(ctx.table, sig.returnType)) {
    const spelled = ctx.table.typeName(sig.returnType)
    ctx.error(
      decl.children[2],
      `\`declare function ${name}\` returns ${spelled}, and a declared C function returns a scalar or \`CPtr\` only`
    )
  }
}

/**
 * A ranged integer in a `declare function` (WP31 §9). The C side never
 * promised the range, so writing it would be a claim this compiler cannot
 * check on the way in and would trust on the way out — the objection
 * `docs/wp27-ffi.md` makes to every attribute on a foreign callee. `i32` is the
 * spelling, and the value enters a range with a check once it is back.
 */
const refuseForeignRange = (ctx: CheckContext, at: Node, name: string, what: string, type: i32): void => {
  ctx.error(
    at,
    `\`declare function ${name}\` ${what} ${ctx.table.typeName(type)}, and a range is a promise the C side never made: declare it \`i32\``
  )
}

/**
 * The entry module's `export function main`, renamed to `@nish_main` so the
 * emitter's C-ABI wrapper can own `@main`. The wrapper hands an `i32` to the
 * OS, so `main` returns `void` or an `i32`-lowered number.
 */
export const markEntryMain = (ctx: CheckContext, sig: FunctionSig): void => {
  if (sig.paramTypes.length > 0) {
    // Against the first parameter, as stage0 hands `sig.decl.parameters[0]` to
    // the error (`markEntryMain` in stage0's `src/checker/declarations.ts`), not against
    // the whole declaration.
    ctx.error(
      sig.decl.children[1].children[0],
      "`main` cannot take parameters (command-line arguments are not supported yet)"
    )
  }
  if (sig.returnType !== T_VOID && sig.returnType !== T_I32 && sig.returnType !== T_ERROR) {
    const spelled = ctx.table.typeName(sig.returnType)
    const hint =
      ctx.table.typeName(sig.returnType) === "f64" ? "; under --number-mode f64 declare `main(): i32`" : ""
    ctx.error(
      sig.decl.children[2],
      `\`main\` must return void or an i32 number (the process exit code), not ${spelled}${hint}`
    )
  }
  if (ctx.errored) {
    // A rejected `main` is not the entry's `main`: stage0 throws from here and
    // never records it, so a *second* module declaring one is not yet a second
    // (`tests/link/main_in_import` in f64 mode reported both there and one
    // here).
    return
  }
  sig.name = ENTRY_MAIN_SYMBOL
  ctx.program.entryMain = sig
}

/**
 * One binding per name in an `import`. Every form but `import { a, b as c }
 * from "..."` is refused first, once, in the order stage0 asked and the source
 * writes them — `export import` (NL2226), a specifier that is not a string literal (NL2212), the
 * specifier rule, a side-effect import (NL2033), `import type` (NL2243), a
 * default import (NL2190), a namespace import (NL2119), and then per name a
 * type-only one (NL2243) or `default as x`, which is the default import by
 * another spelling — so a refused import binds nothing and loads nothing.
 */
export const collectImports = (ctx: CheckContext, decl: Node): void => {
  if (isExported(decl)) {
    refuseTopLevelForm(ctx, decl)
    return
  }
  if ((decl.flags & FLAG_COMPUTED) !== 0) {
    ctx.error(decl, "Import specifier must be a string literal")
    return
  }
  const specifier = decl.text
  // Four forms are legal. `nish:` names a builtin and resolves to no file, so
  // it is let through here and validated in pass 1b, where an unknown one reads
  // as a bad module instead of a missing file; `nish/` names a standard-library
  // module, which is ordinary source resolved from beside the compiler; `./x`
  // and `../x` name a file; and since WP21 S2 a package name resolves through
  // `node_modules` and the `nish` export condition (wp21 §5b). What is left is
  // a specifier that is none of them — an absolute path, a URL scheme, a scope
  // with no package after it — and the message lists the four rather than
  // naming the one thing it refused, because the mistake is almost always a
  // form the reader thought was legal.
  if (
    !isNishSpecifier(specifier) &&
    !specifier.startsWith(STD_PREFIX) &&
    !specifier.startsWith("./") &&
    !specifier.startsWith("../") &&
    parseBareSpecifier(specifier) === null
  ) {
    ctx.errorAtSpecifier(
      decl,
      `Import specifier \`${specifier}\` must be relative (\`./x\`, \`../x\`), a package name (\`hash\`, \`@scope/hash\`), or one of ${nishModuleNames()} and ${STD_PREFIX}<module>`
    )
    return
  }
  const specs = decl.children[0]
  const defaultName: Node | null = decl.children.length > 1 ? decl.children[1] : null
  if (specs.kind === N_EMPTY && defaultName === null) {
    ctx.error(
      decl,
      `Side-effect imports (\`import "${specifier}"\`) are not supported; modules have no top-level code`
    )
    return
  }
  if ((decl.flags & FLAG_TYPE_ONLY) !== 0) {
    ctx.error(decl, "Type-only imports are not supported")
    return
  }
  if (defaultName !== null) {
    refuseDefaultImport(ctx, defaultName, defaultName.text, specifier)
    return
  }
  if (specs.kind === N_IDENT) {
    ctx.error(
      specs,
      `Namespace imports (\`import * as ${specs.text}\`) are not supported; import functions by name`
    )
    return
  }
  if (specs.kind !== N_LIST || specs.children.length === 0) {
    ctx.error(decl, "Empty import list")
    return
  }
  for (const spec of specs.children) {
    if ((spec.flags & FLAG_TYPE_ONLY) !== 0) {
      ctx.error(spec, "Type-only imports are not supported")
      return
    }
    if (spec.children[0].kind === N_IDENT && spec.children[0].text === "default") {
      refuseDefaultImport(ctx, spec, spec.text, specifier)
      return
    }
  }
  for (const spec of specs.children) {
    const importedName = spec.children[0].text
    ctx.program.imports.push(new ImportBinding(specifier, importedName, spec.text, spec, decl))
    // An imported name may be written as a type before pass 1b can say what
    // it is; `resolveType` resolves it provisionally and binding rejects the
    // ones that turn out to be functions or constants.
    ctx.program.typeNames.add(spec.text)
  }
}

/** A default import, `import d from` or `import { default as d } from`, naming the spelling that works (NL2190). */
const refuseDefaultImport = (ctx: CheckContext, at: Node, name: string, specifier: string): void => {
  ctx.error(at, `Default imports are not supported; use \`import { ${name} } from "${specifier}"\``)
}
