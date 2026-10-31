// Top-level declarations for stage1 (stage0's `src/checker/declarations.ts`,
// docs/wp14-selfhost.md milestone S3): function signatures, `export`,
// `import`, and the entry point.
//
// The forms of TypeScript the language forbids are parsed into the nodes they
// resemble and refused where their rule is owned (WP33 R1, `src/nodes.ts`):
// every import form but `import { a, b as c } from "..."` is refused here, in
// `collectImports`, in the order stage0 asked, and the rest of this file is
// the semantic half: names, types, arity and the rules about `main`.

import { refuseTopLevelForm, skipBlanks } from "./checker"
import { CheckContext } from "./context"
import { Edit } from "./diagnostics"
import { Lexer } from "./lexer"
import { isNishSpecifier, nishModuleNames } from "./nish-modules"
import { STD_PREFIX } from "./branding"
import { parseBareSpecifier } from "./packages"
import { rejectForeignPointer, resolveType } from "./annotations"
import { annotationSpelling } from "./arrays"
import { functionTypeHereMessage, isFunctionParameter } from "./generics"
import { isThreadsSource } from "./parallel"
import {
  FLAG_COMPUTED,
  FLAG_DEFAULT,
  FLAG_EXPORTED,
  FLAG_GATHERED,
  FLAG_REST,
  FLAG_SIGNATURE,
  FLAG_TYPE_ONLY,
  N_ARRAY,
  N_EMPTY,
  N_IDENT,
  N_LIST,
  N_NUMBER,
  N_UNARY,
  Node,
} from "./nodes"
import { FieldInfo, FunctionSig, ImportBinding, ROLE_FUNCTION } from "./program"
import { checkLiteralInitializer } from "./structs"
import {
  isForeignBuffer,
  isForeignType,
  isNumeric,
  K_ARRAY,
  T_BOOL,
  T_ERROR,
  T_I32,
  T_STRING,
  T_U64,
  T_VOID,
} from "./types"

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
      if ((param.flags & (FLAG_DEFAULT | FLAG_REST)) !== 0 && (param.flags & FLAG_SIGNATURE) !== 0) {
        // Reported, and the parameter kept, so the signature still lines up
        // with the arguments each call is matched against.
        ctx.error(param, functionParameterFormMessage(name))
      } else if ((param.flags & FLAG_SIGNATURE) !== 0 && sig.defaults.length > 0) {
        ctx.error(param, followsDefaultMessage(name))
      }
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
    // A default without an annotation is refused by `collectParamForm`, which
    // names the form to write; the empty annotation is no type to resolve.
    const untypedDefault =
      param.children[1].kind === N_EMPTY &&
      (param.flags & (FLAG_DEFAULT | FLAG_SIGNATURE)) === (FLAG_DEFAULT | FLAG_SIGNATURE)
    const type = untypedDefault ? T_ERROR : resolveType(param.children[1], ctx)
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
    if ((param.flags & FLAG_SIGNATURE) !== 0) {
      collectParamForm(ctx, sig, param, type, list)
    }
  }
  refuseMixedForms(ctx, sig, list)
}

/**
 * What a parameter of a declaration that may have them says beyond its name
 * and type: a default, recorded in `sig.defaults` for each call that omits
 * the argument to pass, or `...`, recorded as `sig.restIndex` for each call
 * to gather its trailing arguments into an array (`docs/LANGUAGE.md`,
 * "Default and rest parameters"). `type` is the one just pushed.
 */
const collectParamForm = (ctx: CheckContext, sig: FunctionSig, param: Node, type: i32, list: Node): void => {
  const name = param.children[0].text
  const position = sig.paramNames.length - 1
  if ((param.flags & FLAG_REST) !== 0) {
    if (param !== list.children[list.children.length - 1]) {
      ctx.error(param, `Rest parameter \`${name}\` must be the last parameter`)
    } else if ((param.flags & FLAG_DEFAULT) !== 0) {
      ctx.error(
        param.children[2],
        `Rest parameter \`${name}\` cannot have a default: a call that passes nothing for it passes \`[]\``
      )
    } else if (type !== T_ERROR && !ctx.table.isArray(type)) {
      ctx.error(param.children[1], `Rest parameter \`${name}\` must have an array type, \`...${name}: T[]\``)
    } else {
      sig.restIndex = position
    }
    return
  }
  if ((param.flags & FLAG_DEFAULT) === 0) {
    if (sig.defaults.length > 0 && type !== T_ERROR) {
      ctx.error(param, followsDefaultMessage(name))
    }
    return
  }
  const init = param.children[2]
  if (param.children[1].kind === N_EMPTY) {
    ctx.error(
      param,
      `Parameter \`${name}\` has a default and no type annotation; write its type before the default, \`${name}: T = ${spellingOf(ctx, init)}\``
    )
    return
  }
  if (type === T_ERROR) {
    return
  }
  if (mentionsBound(ctx, param.children[1])) {
    ctx.error(
      init,
      `Parameter \`${name}\` has a type parameter's type, so a default cannot be one value: the type is the caller's, and TypeScript refuses a constant for it too`
    )
    return
  }
  if (!isScalarDefault(ctx, type) && type !== T_STRING) {
    ctx.error(
      init,
      `Parameter \`${name}\` is \`${spellingOf(ctx, param.children[1])}\` and cannot have a default in this version: a default is a number, a \`boolean\`, a \`string\` or an enum member`
    )
    return
  }
  while (sig.defaults.length < position) {
    const none: FieldInfo | null = null
    sig.defaults.push(none)
  }
  const value = new FieldInfo(name, type, param)
  value.initializer = init
  value.index = -1
  sig.defaults.push(value)
  // A default is checked here and not by `checkExpression`, so its type is
  // recorded here for the walks that read it (`--emit-ts` writes `5` at
  // `i64` as `5n`).
  ctx.program.nodeTypes[init.id] = type
  if (init.kind === N_UNARY && init.children.length > 0) {
    ctx.program.nodeTypes[init.children[0].id] = type
  }
  const notLiteral = `Default of parameter \`${name}\`: a default is a literal, an enum member or the name of an earlier parameter of the same number, \`boolean\` or enum type, because each call that leaves the argument out passes it as a constant`
  if (init.kind === N_IDENT) {
    const source = sig.paramNames.indexOf(init.text)
    if (source < 0 || source >= position || init.text === "this" || sig.isCompileTime(source)) {
      ctx.error(init, notLiteral)
    } else if (sig.paramTypes[source] !== type || !isScalarDefault(ctx, type)) {
      ctx.error(init, notLiteral)
    } else {
      value.index = source
    }
    return
  }
  // A number is a value of a number type only: the literal check takes a
  // number as the type it is written for, which a field's own check relies on.
  const numeral =
    init.kind === N_NUMBER ||
    (init.kind === N_UNARY && init.children.length > 0 && init.children[0].kind === N_NUMBER)
  if (numeral && !isNumeric(type) && !ctx.table.isRanged(type)) {
    ctx.error(init, `Parameter \`${name}\` is ${ctx.table.typeName(type)} but its initializer is a number`)
    return
  }
  checkLiteralInitializer(ctx, value, init, `Parameter \`${name}\``, notLiteral, true)
}

/**
 * Whether an earlier parameter of `type` may be another's default: a number,
 * a `boolean` or an enum, a value the call passes twice with no second name
 * for anything the callee could write through.
 */
const isScalarDefault = (ctx: CheckContext, type: i32): boolean =>
  isNumeric(type) ||
  type === T_BOOL ||
  ctx.table.isEnum(type) ||
  ctx.table.isEnumMemberType(type) ||
  ctx.table.isRanged(type)

/**
 * A signature with both a default and a rest parameter: a call that writes
 * fewer arguments than there are parameters could mean either, and the
 * checker that gathers the rest and the emitter that fills the defaults each
 * read the arguments as one or the other.
 */
const refuseMixedForms = (ctx: CheckContext, sig: FunctionSig, list: Node): void => {
  if (sig.restIndex < 0 || sig.defaults.length === 0) {
    return
  }
  ctx.error(
    list.children[list.children.length - 1],
    `\`${sig.sourceName}\` has both a parameter with a default and a rest parameter, which this version does not combine: write every argument before the rest, or pass the rest as an array`
  )
  sig.restIndex = -1
}

/** Whether an annotation names a type parameter bound for the instance being collected. */
const mentionsBound = (ctx: CheckContext, annotation: Node): boolean => {
  if (ctx.typeBindings.size() === 0) {
    return false
  }
  if (annotation.text !== "" && ctx.typeBindings.has(annotation.text)) {
    return true
  }
  for (const child of annotation.children) {
    if (mentionsBound(ctx, child)) {
      return true
    }
  }
  return false
}

/**
 * Hold a call's arguments to `sig`'s parameters, whose first `skip` (`this`)
 * the call does not write: from the parameters before the first default to
 * all of them, and with a rest parameter any number from it on, which are
 * gathered here into the array literal the call passes (`gatherRest`). The
 * message is the one an exact count always had when the signature has
 * neither. `false` when it reported.
 */
export const fitArguments = (
  ctx: CheckContext,
  call: Node,
  args: Node,
  sig: FunctionSig,
  skip: i32,
  shown: string
): boolean => {
  const written = sig.writtenArity() - skip
  const got = args.children.length
  if (sig.restIndex >= 0) {
    const fixed = sig.restIndex - skip
    if (got < fixed) {
      ctx.error(call, `\`${shown}\` expects at least ${fixed} argument(s), got ${got}`)
      return false
    }
    gatherRest(call, args, fixed)
    return true
  }
  const least = sig.requiredArity() - skip
  if (got >= least && got <= written) {
    return true
  }
  const count = least === written ? `${written}` : `${least} to ${written}`
  ctx.error(call, `\`${shown}\` expects ${count} argument(s), got ${got}`)
  return false
}

/**
 * `fitArguments` for a call to a generic template, read from its parameter
 * list, since the signature with the defaults and the rest is the instance's
 * and the instance is chosen from the arguments.
 */
export const fitTemplateArguments = (
  ctx: CheckContext,
  call: Node,
  args: Node,
  parameters: Node,
  shown: string
): boolean => {
  const written = parameters.children.length
  const got = args.children.length
  if (
    written > 0 &&
    (parameters.children[written - 1].flags & (FLAG_REST | FLAG_SIGNATURE)) === (FLAG_REST | FLAG_SIGNATURE)
  ) {
    if (got < written - 1) {
      ctx.error(call, `\`${shown}\` expects at least ${written - 1} argument(s), got ${got}`)
      return false
    }
    gatherRest(call, args, written - 1)
    return true
  }
  let least = 0
  while (
    least < written &&
    (parameters.children[least].flags & (FLAG_DEFAULT | FLAG_SIGNATURE)) !== (FLAG_DEFAULT | FLAG_SIGNATURE)
  ) {
    least = least + 1
  }
  if (got >= least && got <= written) {
    return true
  }
  const count = least === written ? `${written}` : `${least} to ${written}`
  ctx.error(call, `\`${shown}\` expects ${count} argument(s), got ${got}`)
  return false
}

/**
 * Move the arguments from `from` on into one array literal, the call's last
 * argument, under the id the parser reserved after the list's
 * (`parseArguments`). An empty one sits on the call's `)`. Asked again for
 * the same call — a generic body is checked once per instance — it finds the
 * literal already there.
 */
const gatherRest = (call: Node, args: Node, from: i32): void => {
  if (args.children.length === from + 1 && args.children[from].id === args.id + 1) {
    return
  }
  const elements: Node[] = []
  const kept: Node[] = []
  for (const arg of args.children) {
    if (kept.length < from) {
      kept.push(arg)
    } else {
      elements.push(arg)
    }
  }
  const start = elements.length > 0 ? elements[0].start : call.end - 1
  const end = elements.length > 0 ? elements[elements.length - 1].end : call.end - 1
  const array = new Node(N_ARRAY, start, end)
  array.id = args.id + 1
  array.flags = FLAG_GATHERED
  array.children = elements
  kept.push(array)
  args.children = kept
}

/** The source text of `node`, for a message that shows the fix. */
const spellingOf = (ctx: CheckContext, node: Node): string => ctx.source.text.slice(node.start, node.end)

/** A parameter with no default after one with a default. */
const followsDefaultMessage = (name: string): string =>
  `Parameter \`${name}\` follows a parameter with a default, so it needs a default too: a call leaves out arguments only from the end`

/** A function-typed parameter with a default or `...`. */
const functionParameterFormMessage = (name: string): string =>
  `Function parameter \`${name}\` cannot have a default or be a rest parameter: a call names the function it passes, and that is what instantiates the callee`

/**
 * `x?: T` on a parameter that could have a default (NL2233's form with a
 * fix): the language has no `undefined`, so an argument a call may leave out
 * is one with a value to stand in for it.
 */
export const optionalParameterMessage = (ctx: CheckContext, param: Node): string => {
  const name = param.children[0].text
  const type = param.children[1].kind === N_EMPTY ? "T" : spellingOf(ctx, param.children[1])
  return `Optional parameters are not supported: give \`${name}\` a default instead, \`${name}: ${type} = <default>\`, which a call that leaves it out passes`
}

/** A default or `...` where the parameter list is not a declaration's own (NL2233, NL2235). */
export const parameterFormHereMessage = (rest: boolean): string =>
  rest
    ? "Rest parameters are not supported here: only a function, a method with a body or a constructor ends in one, not an arrow passed as an argument, a function type, an interface or object method, an accessor or a `declare function`"
    : "Optional/default parameters are not supported here: only a function, a method with a body or a constructor gives a parameter a default, not an arrow passed as an argument, a function type, an interface or object method, an accessor or a `declare function`"

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
    sig.returnSpelling = annotationSpelling(ctx, true, returnAnnotation)
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
 * The rules a `declare function` adds (WP27 S1, widened by S2, S3.1 and S3.2):
 * no body, not exported, a scalar or a `CPtr` in every position, and a
 * `string` or `string | null` as a parameter or as the result.
 *
 * S2 adds a pointer coming back that the compiler must never mistake for one
 * of its own (`docs/wp27-ffi.md` §2, §3). S3.1 is the first pointer this
 * compiler allocated to cross the boundary, and it crosses under a decision
 * rather than a proof: C borrows a string for the length of the call and may
 * not keep it (§8b), which is what `src/escape.ts` reads a foreign argument as.
 *
 * WP40 B1.1 adds a `u8[]` or `readonly u8[]` parameter, in a run of one or more
 * that a single `u64` closes: the count C may touch in every buffer of the run
 * (`docs/wp40-ffi-buffers-handles.md` §3a). `syscall` is refused by its name
 * (§10 Q11(a)), because no fixed arity declares a variadic C function soundly.
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
  if (name === "syscall") {
    ctx.error(
      decl.children[0],
      "`declare function syscall` is refused: `syscall` is variadic in C and bypasses libc, so declare the libc function that wraps the system call instead"
    )
  }
  // The buffers of the run not yet closed by a count, and the last one's
  // name, which the refusal of a run left open names.
  let run = 0
  let lastBuffer = ""
  let i = 0
  while (i < sig.paramTypes.length) {
    if (isForeignBuffer(ctx.table, sig.paramTypes[i])) {
      run = run + 1
      lastBuffer = sig.paramNames[i]
      i = i + 1
      continue
    }
    // What the refused parameter breaks, or "" when it crosses. The refusals
    // share one message built once below, so the type is spelled at one site.
    let rule = ""
    const bare = ctx.table.stripNull(sig.paramTypes[i])
    if (bare !== sig.paramTypes[i] && isForeignBuffer(ctx.table, bare)) {
      // A null buffer has no length to hold the count to, and the `NULL, 0`
      // C allows is a `CPtr | null` parameter's literal `null` (§3b). It is
      // tested before the run's count, so a nullable buffer after a buffer is
      // refused for its null and leaves the run open for the count after it.
      rule =
        "a buffer a declared C function takes is never null: it has no length to hold the count to, so a C function that accepts `NULL, 0` is declared with a `CPtr | null` parameter"
    } else if (run > 0) {
      // The parameter after a run is its count whatever else it might be, so
      // a `CPtr` or a `string` there is refused rather than read as the next
      // parameter and the run reported as missing its count.
      if (sig.paramTypes[i] !== T_U64) {
        rule = "the parameter after a run of `u8[]` buffers is their byte count, a `u64`"
      }
      run = 0
    } else if (bare === T_STRING) {
      // S3.1: C's `const char *`, borrowed for the call (`docs/wp27-ffi.md`
      // §8b), and `string | null` passes `NULL`. Unlike a `CPtr`'s, this null
      // is the program's to give: it names no address, so there is no
      // provenance for C to be wrong about.
    } else if (ctx.table.isRanged(sig.paramTypes[i])) {
      refuseForeignRange(ctx, decl, name, `takes \`${sig.paramNames[i]}\` as`, sig.paramTypes[i])
    } else if (bare >= 0 && ctx.table.kindOf(bare) === K_ARRAY) {
      rule =
        "the only array a declared C function takes is a `u8[]` or a `readonly u8[]`, whose bytes have one layout on every target"
    } else if (!isForeignType(ctx.table, sig.paramTypes[i])) {
      // S3.3: `CPtr | null` passes, because the call site is where a null is
      // held to the literal one (`refuseForeignNullable` in `expressions.ts`,
      // `docs/wp27-ffi.md` §8g): the declaration cannot tell `realpath(p, null)`
      // from handing C back a null it gave out.
      rule =
        "a declared C function takes scalars, `CPtr`, a `string` it borrows as `const char *` and a `u8[]` buffer followed by its `u64` count"
    }
    if (rule !== "") {
      ctx.error(
        decl,
        `Parameter \`${sig.paramNames[i]}\` of \`declare function ${name}\` is ${ctx.table.typeName(sig.paramTypes[i])}, and ${rule}`
      )
    }
    i = i + 1
  }
  if (run > 0) {
    ctx.error(
      decl,
      `\`declare function ${name}\` takes the buffer \`${lastBuffer}\` with no count after it: a run of \`u8[]\` parameters is followed by one \`u64\`, the byte count C may touch in each`
    )
  }
  if (ctx.table.stripNull(sig.returnType) === T_STRING) {
    // S3.2: C's `const char *`, copied into the arena at the call
    // (`docs/wp27-ffi.md` §8d), so the string is the program's from then on
    // and C keeps its own. `string | null` answers `null` for `NULL`, and a
    // `string` panics on one (`ffi-null`).
    return
  }
  if (ctx.table.isRanged(sig.returnType)) {
    refuseForeignRange(ctx, decl.children[2], name, "returns", sig.returnType)
  } else if (!isForeignType(ctx.table, sig.returnType)) {
    const spelled = ctx.table.typeName(sig.returnType)
    ctx.error(
      decl.children[2],
      `\`declare function ${name}\` returns ${spelled}, and a declared C function returns a scalar, a \`CPtr\` or a \`string\` it copies from a \`const char *\``
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
 * The fix for `import type { T } from "./m"` (NL2243): delete the `type`, and
 * the blanks after it, so the names are imported as values are. What is
 * imported is the same declarations under the same names, and a name used
 * only as a type reads the same either way, to this compiler and to
 * TypeScript. Empty, so no fix, unless the import is a braces list and nothing
 * else: without `type`, `import type T from` is a default import and
 * `import type * as m from` a namespace one, each refused in its turn.
 */
const typeOnlyImportFix = (ctx: CheckContext, decl: Node, defaultName: Node | null): Edit[] => {
  const edits: Edit[] = []
  const text = ctx.source.text
  if (
    decl.children[0].kind !== N_LIST ||
    defaultName !== null ||
    text.substring(decl.start, decl.start + 6) !== "import"
  ) {
    return edits
  }
  const scan = new Lexer(text)
  scan.pos = decl.start + 6
  scan.skipTrivia()
  const at = scan.pos
  if (text.substring(at, at + 4) !== "type") {
    return edits
  }
  edits.push(ctx.edit(at, skipBlanks(text, at + 4), ""))
  return edits
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
    ctx.errorFix(decl, "Type-only imports are not supported", typeOnlyImportFix(ctx, decl, defaultName))
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
