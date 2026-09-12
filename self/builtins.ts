// Builtins for stage1 (`src/checker/builtins.ts`, `math.ts`, `io.ts` and the
// dotted-call table of `strings.ts`; docs/wp14-selfhost.md milestone S3,
// pass 2): the functions that exist without a declaration.
//
// Two families. **Dotted callees** (`console.log`, `Math.sqrt`,
// `process.exit`, `Arena.reset`, `String.fromCharCode`) are told from method
// calls by whether the receiver is a value; **plain callees** (`toI32`,
// `parseInt`, `readFileSync`, `panic`) are consulted only when no user
// function of that name is in scope, so a user definition always wins.
//
// `requireStatementPosition` is the one place the missing parent pointers
// show: stage0 asks whether the call's parent is an expression statement, and
// here `checkStatement` records the expression it is about to check so the
// builtin can compare against it. One field instead of a parent chain.

import { CheckContext } from "./context";
import { checkExpression } from "./expressions";
import { N_CALL, N_IDENT, N_MEMBER, N_PAREN, Node } from "./nodes";
import { Scope } from "./symbols";
import {
  isNumeric,
  T_BOOL,
  T_ERROR,
  T_F32,
  T_F64,
  T_I32,
  T_I64,
  T_STRING,
  T_U16,
  T_U32,
  T_U64,
  T_U8,
  T_VOID,
} from "./types";

/** `Math.sqrt` and friends: one `f64` in, one `f64` out. */
function isF64Unary(name: string): boolean {
  return (
    name === "sqrt" ||
    name === "floor" ||
    name === "ceil" ||
    name === "trunc" ||
    name === "round" ||
    name === "sin" ||
    name === "cos" ||
    name === "exp" ||
    name === "log"
  );
}

/** Whether a bare identifier names a builtin namespace rather than a value. */
export function isNamespace(name: string): boolean {
  return name === "console" || name === "Math" || name === "process" || name === "String" || name === "Arena";
}

/** The type a plain-identifier builtin converts to, or -1 when the name is not one. */
function conversionTarget(name: string): i32 {
  if (name === "toI32") {
    return T_I32;
  }
  if (name === "toI64") {
    return T_I64;
  }
  if (name === "toU8") {
    return T_U8;
  }
  if (name === "toU16") {
    return T_U16;
  }
  if (name === "toU32") {
    return T_U32;
  }
  if (name === "toU64") {
    return T_U64;
  }
  if (name === "toF32") {
    return T_F32;
  }
  if (name === "toF64") {
    return T_F64;
  }
  return -1;
}

export function isBuiltinFunction(name: string): boolean {
  if (conversionTarget(name) >= 0) {
    return true;
  }
  return (
    name === "f64ToBits" ||
    name === "bitsToF64" ||
    name === "parseInt" ||
    name === "parseFloat" ||
    name === "Number" ||
    name === "readFileSync" ||
    name === "readFileSyncOrNull" ||
    name === "writeFileSync" ||
    name === "appendFileSync" ||
    name === "write" ||
    name === "writeError" ||
    name === "panic" ||
    name === "mkdirSync" ||
    name === "spawnSync" ||
    name === "spawnSyncTo" ||
    name === "readdirSync" ||
    name === "monotonicNanos" ||
    name === "isDirectorySync" ||
    name === "getenv"
  );
}

/** `console.log(x)`, `write(s)` and the rest accept these and nothing else. */
function isStringifiable(type: i32): boolean {
  return isNumeric(type) || type === T_BOOL || type === T_STRING;
}

/**
 * The arity wording every builtin and every array or string method uses:
 * "expects exactly 1 argument". A *user* method says "expects 1 argument(s)"
 * instead (`checkMethodArguments`), and both are pinned by `.err` goldens.
 */
export function checkBuiltinArity(
  ctx: CheckContext,
  call: Node,
  name: string,
  args: Node,
  arity: i32
): boolean {
  if (args.children.length === arity) {
    return true;
  }
  const plural = arity === 1 ? "" : "s";
  ctx.error(call, `\`${name}\` expects exactly ${arity} argument${plural}, got ${args.children.length}`);
  return false;
}

/** A `void` builtin used as a value; the check stage0 makes against the parent node. */
function requireStatementPosition(ctx: CheckContext, call: Node, name: string): void {
  const statement = ctx.statementExpression;
  if (statement === null || statement !== call) {
    ctx.error(call, `\`${name}\` returns void and can only be used as a statement`);
  }
}

function checkArgumentType(ctx: CheckContext, arg: Node, scope: Scope, name: string, want: i32): void {
  const got = checkExpression(ctx, arg, scope, want);
  if (got !== T_ERROR && got !== want) {
    // "an argument of type" rather than the bare type, so the message has a
    // literal run a diagnostic code can be derived from; stage0 words it the
    // same way in `src/checker/builtins.ts` and `src/checker/math.ts`.
    ctx.error(arg, `\`${name}\` expects an argument of type ${ctx.table.typeName(want)}, got ${ctx.table.typeName(got)}`);
  }
}

// ---- Namespace properties -----------------------------------------------------------

/** `Math.PI`, `Math.E`, `process.argv`, `process.platform`, `process.arch`. */
export function checkNamespaceProperty(
  ctx: CheckContext,
  expr: Node,
  namespace: string,
  member: string
): i32 {
  if (namespace === "Math" && (member === "PI" || member === "E")) {
    return T_F64;
  }
  if (namespace === "process" && member === "argv") {
    if (!ctx.entryHasMain) {
      return ctx.errorType(
        expr,
        "`process.argv` requires a `main` entry point (this program has no `export function main`)"
      );
    }
    ctx.program.usesArgv = true;
    return ctx.table.arrayOf(T_STRING);
  }
  // WP14 §7a. What machine the *program* runs on, and unlike `process.argv`
  // there is nothing for an entry wrapper to build, so no rule is attached: a
  // library without a `main` may read them too. They exist because
  // `--target host` has to ask the machine what it is and nothing else in the
  // language does; the spellings are Node's, so `self/target.ts` composes the
  // triple from them exactly as `src/codegen/target.ts` does.
  if (namespace === "process" && (member === "platform" || member === "arch")) {
    return T_STRING;
  }
  if (!isNamespace(namespace)) {
    return ctx.errorType(expr.children[0], `Unknown identifier \`${namespace}\``);
  }
  return ctx.errorType(expr, `Unknown builtin \`${namespace}.${member}\``);
}

// ---- Dotted calls -------------------------------------------------------------------

/** `console.log(x)`, `Math.sqrt(x)`, `process.exit(n)`, `Arena.reset()`, ... */
/**
 * Every dotted builtin, in the order `src/checker/strings.ts` builds its
 * `builtinCalls` table — `Object.keys` there, so the order is the table's and
 * the string is the tail of the one refusal stage0 has for an unknown one.
 * stage1 refused in four places with four shorter sentences and named the
 * receiver rather than the call when the namespace itself was unknown, so
 * `foo.bar(1)` was `Unknown identifier \`foo\`` here and
 * `Unknown builtin \`foo.bar\` (supported: …)` there (WP19 §A3,
 * `tests/cases/reject_unknown_builtin`).
 */
const SUPPORTED_BUILTINS: string =
  "console.log, console.error, String.fromCharCode, Math.sqrt, Math.floor, Math.ceil, Math.trunc, " +
  "Math.round, Math.sin, Math.cos, Math.exp, Math.log, Math.pow, Math.abs, Math.min, Math.max, " +
  "Math.random, process.exit, Arena.reset, Arena.mark, Arena.release, Arena.used";

/** stage0's one sentence for a call whose dotted name is not a builtin. */
function unknownBuiltin(ctx: CheckContext, at: Node, name: string): i32 {
  return ctx.errorType(at, `Unknown builtin \`${name}\` (supported: ${SUPPORTED_BUILTINS})`);
}

export function checkBuiltinCall(ctx: CheckContext, call: Node, scope: Scope): i32 {
  const access = call.children[0];
  const receiver = access.children[0];
  const args = call.children[1];
  if (receiver.kind !== N_IDENT) {
    return ctx.errorType(call, "Only direct calls to named functions are supported");
  }
  const namespace = receiver.text;
  const member = access.text;
  const name = `${namespace}.${member}`;
  if (!isNamespace(namespace)) {
    // stage0 looks the whole dotted name up in one table and names the call,
    // not the receiver: the callee is what was not found.
    return unknownBuiltin(ctx, call.children[0], name);
  }
  if (namespace === "console") {
    return checkConsole(ctx, call, args, name, member, scope);
  }
  if (namespace === "Math") {
    return checkMath(ctx, call, args, name, member, scope);
  }
  if (namespace === "process") {
    return checkProcess(ctx, call, args, name, member, scope);
  }
  if (namespace === "Arena") {
    return checkArena(ctx, call, args, name, member, scope);
  }
  if (member === "fromCharCode") {
    if (checkBuiltinArity(ctx, call, "String.fromCharCode", args, 1)) {
      const got = checkExpression(ctx, args.children[0], scope, ctx.numberType());
      if (got !== T_ERROR && !isNumeric(got)) {
        ctx.error(
          args.children[0],
          `\`String.fromCharCode\` expects a number index, got ${ctx.table.typeName(got)}`
        );
      }
    }
    return T_STRING;
  }
  return unknownBuiltin(ctx, call.children[0], name);
}

function checkConsole(
  ctx: CheckContext,
  call: Node,
  args: Node,
  name: string,
  member: string,
  scope: Scope
): i32 {
  if (member !== "log" && member !== "error") {
    return unknownBuiltin(ctx, call.children[0], name);
  }
  if (args.children.length !== 1) {
    return ctx.errorType(call, `\`${name}\` expects exactly 1 argument, got ${args.children.length}`);
  }
  const got = checkExpression(ctx, args.children[0], scope, -1);
  if (got !== T_ERROR && !isStringifiable(got)) {
    ctx.error(
      args.children[0],
      `\`${name}\` accepts string, number, or boolean, got ${ctx.table.typeName(got)}`
    );
  }
  requireStatementPosition(ctx, call, name);
  return T_VOID;
}

function checkMath(
  ctx: CheckContext,
  call: Node,
  args: Node,
  name: string,
  member: string,
  scope: Scope
): i32 {
  if (isF64Unary(member) || member === "pow") {
    const arity = member === "pow" ? 2 : 1;
    if (checkBuiltinArity(ctx, call, name, args, arity)) {
      for (const arg of args.children) {
        requireF64(ctx, name, arg, scope);
      }
    }
    return T_F64;
  }
  if (member === "abs") {
    if (!checkBuiltinArity(ctx, call, name, args, 1)) {
      return T_F64;
    }
    const got = checkExpression(ctx, args.children[0], scope, ctx.numberType());
    if (got !== T_ERROR && !isNumeric(got)) {
      return ctx.errorType(args.children[0], `\`Math.abs\` expects a number, got ${ctx.table.typeName(got)}`);
    }
    return got;
  }
  if (member === "min" || member === "max") {
    if (!checkBuiltinArity(ctx, call, name, args, 2)) {
      return T_ERROR;
    }
    const a = checkExpression(ctx, args.children[0], scope, -1);
    const b = checkExpression(ctx, args.children[1], scope, a);
    if (a === T_ERROR || b === T_ERROR) {
      return T_ERROR;
    }
    if (!isNumeric(a) || a !== b) {
      const x = ctx.table.typeName(a);
      return ctx.errorType(
        call,
        `\`${name}\` requires two operands of the same numeric type, got ${x} and ${ctx.table.typeName(b)}`
      );
    }
    return a;
  }
  if (member === "random") {
    checkBuiltinArity(ctx, call, name, args, 0);
    return T_F64;
  }
  return unknownBuiltin(ctx, call.children[0], name);
}

function requireF64(ctx: CheckContext, name: string, arg: Node, scope: Scope): void {
  const got = checkExpression(ctx, arg, scope, T_F64);
  if (got === T_F64 || got === T_ERROR) {
    return;
  }
  if (isNumeric(got)) {
    ctx.error(
      arg,
      `\`${name}\` requires an f64 argument, got ${ctx.table.typeName(got)} (use --number-mode f64 or toF64(x))`
    );
    return;
  }
  ctx.error(arg, `\`${name}\` expects f64, got ${ctx.table.typeName(got)}`);
}

function checkProcess(
  ctx: CheckContext,
  call: Node,
  args: Node,
  name: string,
  member: string,
  scope: Scope
): i32 {
  if (member !== "exit") {
    return unknownBuiltin(ctx, call.children[0], name);
  }
  if (checkBuiltinArity(ctx, call, name, args, 1)) {
    checkArgumentType(ctx, args.children[0], scope, name, T_I32);
  }
  requireStatementPosition(ctx, call, name);
  return T_VOID;
}

function checkArena(
  ctx: CheckContext,
  call: Node,
  args: Node,
  name: string,
  member: string,
  scope: Scope
): i32 {
  if (member === "mark" || member === "used") {
    checkBuiltinArity(ctx, call, name, args, 0);
    return T_I64;
  }
  if (member === "reset") {
    checkBuiltinArity(ctx, call, name, args, 0);
    requireStatementPosition(ctx, call, name);
    return T_VOID;
  }
  if (member === "release") {
    if (checkBuiltinArity(ctx, call, name, args, 1)) {
      checkArgumentType(ctx, args.children[0], scope, name, T_I64);
    }
    requireStatementPosition(ctx, call, name);
    return T_VOID;
  }
  return unknownBuiltin(ctx, call.children[0], name);
}

// ---- Plain calls ----------------------------------------------------------------------

/** `toI32(x)`, `parseInt(s)`, `readFileSync(p)`, `panic(m)`, ... */
export function checkBuiltinFunction(ctx: CheckContext, call: Node, scope: Scope): i32 {
  const name = call.children[0].text;
  const args = call.children[1];

  const target = conversionTarget(name);
  if (target >= 0) {
    if (checkBuiltinArity(ctx, call, name, args, 1)) {
      // `toF32(2.75)` and `toF64(3)` give the literal the target type, so they
      // read naturally in i32 mode; `toI32`/`toI64` leave an integer alone.
      const literal = target === T_F32 || target === T_F64 ? target : -1;
      const got = checkExpression(ctx, args.children[0], scope, literal);
      if (got !== T_ERROR && !isNumeric(got)) {
        ctx.error(
          args.children[0],
          `\`${name}\` expects a number (i32, i64, u8, u16, u32, u64, f32, or f64), got ${ctx.table.typeName(got)}`
        );
      }
    }
    return target;
  }
  if (name === "f64ToBits" || name === "bitsToF64") {
    const from = name === "f64ToBits" ? T_F64 : T_I64;
    if (checkBuiltinArity(ctx, call, name, args, 1)) {
      checkArgumentType(ctx, args.children[0], scope, name, from);
    }
    return name === "f64ToBits" ? T_I64 : T_F64;
  }
  if (name === "parseInt" || name === "parseFloat") {
    if (checkBuiltinArity(ctx, call, name, args, 1)) {
      const got = checkExpression(ctx, args.children[0], scope, T_STRING);
      if (got !== T_ERROR && got !== T_STRING) {
        ctx.error(args.children[0], `\`${name}\` expects a string, got ${ctx.table.typeName(got)}`);
      }
    }
    return name === "parseInt" ? T_I32 : T_F64;
  }
  if (name === "Number") {
    if (checkBuiltinArity(ctx, call, name, args, 1)) {
      const got = checkExpression(ctx, args.children[0], scope, T_F64);
      if (got !== T_ERROR && !isStringifiable(got)) {
        ctx.error(
          args.children[0],
          `\`Number\` expects a string, number, or boolean, got ${ctx.table.typeName(got)}`
        );
      }
    }
    return T_F64;
  }
  if (name === "readFileSync" || name === "readFileSyncOrNull") {
    if (checkBuiltinArity(ctx, call, name, args, 1)) {
      checkArgumentType(ctx, args.children[0], scope, name, T_STRING);
    }
    return name === "readFileSync" ? T_STRING : ctx.table.nullableOf(T_STRING);
  }
  if (name === "writeFileSync" || name === "appendFileSync") {
    if (checkBuiltinArity(ctx, call, name, args, 2)) {
      checkArgumentType(ctx, args.children[0], scope, name, T_STRING);
      checkArgumentType(ctx, args.children[1], scope, name, T_STRING);
    }
    requireStatementPosition(ctx, call, name);
    return T_VOID;
  }
  if (name === "write" || name === "writeError") {
    if (checkBuiltinArity(ctx, call, name, args, 1)) {
      checkArgumentType(ctx, args.children[0], scope, name, T_STRING);
    }
    requireStatementPosition(ctx, call, name);
    return T_VOID;
  }
  if (name === "panic") {
    if (checkBuiltinArity(ctx, call, name, args, 1)) {
      checkArgumentType(ctx, args.children[0], scope, name, T_STRING);
    }
    requireStatementPosition(ctx, call, name);
    return T_VOID;
  }
  // WP14 D4. `mkdirSync` answers a boolean rather than exiting, for the reason
  // `readFileSyncOrNull` answers null: there are no exceptions, so the driver
  // has to be able to phrase its own diagnostic.
  if (name === "mkdirSync") {
    if (checkBuiltinArity(ctx, call, name, args, 1)) {
      checkArgumentType(ctx, args.children[0], scope, name, T_STRING);
    }
    return T_BOOL;
  }
  // `spawnSync` is checked down to the element type — a `number[]` is not a
  // command line — which an interned type id gives for nothing here and cost
  // `src/checker/builtins.ts` a change from comparing kinds to `sameType`.
  if (name === "spawnSync") {
    if (checkBuiltinArity(ctx, call, name, args, 1)) {
      checkArgumentType(ctx, args.children[0], scope, name, ctx.table.arrayOf(T_STRING));
    }
    return ctx.numberType();
  }
  // `spawnSyncTo` is that same run with a stream sent to a file, and it is a
  // second builtin rather than two more parameters on the first because the
  // language has no optional parameters. The vector is checked down to its
  // element type exactly as above; the two paths are plain strings, and that an
  // empty one leaves the stream inherited is a fact about the value rather than
  // about the type, so it is stated in `docs/LANGUAGE.md` and not here.
  if (name === "spawnSyncTo") {
    if (checkBuiltinArity(ctx, call, name, args, 3)) {
      checkArgumentType(ctx, args.children[0], scope, name, ctx.table.arrayOf(T_STRING));
      checkArgumentType(ctx, args.children[1], scope, name, T_STRING);
      checkArgumentType(ctx, args.children[2], scope, name, T_STRING);
    }
    return ctx.numberType();
  }
  // A directory's entries, or null when it cannot be read. Nullable for the
  // reason `readFileSyncOrNull` is nullable — there are no exceptions, so the
  // caller has to be able to phrase its own diagnostic — and an empty directory
  // is an empty array, which is a different answer from that null. The runtime
  // sorts the listing and drops `.` and `..`, neither of which this phase can
  // say anything about.
  if (name === "readdirSync") {
    if (checkBuiltinArity(ctx, call, name, args, 1)) {
      checkArgumentType(ctx, args.children[0], scope, name, T_STRING);
    }
    return ctx.table.nullableOf(ctx.table.arrayOf(T_STRING));
  }
  // The monotonic clock, an `i64` in either number mode rather than
  // `ctx.numberType()`: the default `number` is an `i32` and would overflow
  // inside a tenth of a second, and an f64 stops counting whole nanoseconds
  // after about 104 days of uptime. The name carries what the type cannot, that
  // only the difference between two reads means anything. Zero arguments, which
  // `checkBuiltinArity` words the way `Math.random` already does.
  if (name === "monotonicNanos") {
    checkBuiltinArity(ctx, call, name, args, 0);
    return T_I64;
  }
  // WP14 §7a. One `stat`, answering the one question a driver asks of a path
  // it was handed: is `-o out` a directory that is already there? A value like
  // `mkdirSync`'s, never an exit.
  if (name === "isDirectorySync") {
    if (checkBuiltinArity(ctx, call, name, args, 1)) {
      checkArgumentType(ctx, args.children[0], scope, name, T_STRING);
    }
    return T_BOOL;
  }
  // WP19 R1. One environment variable, or null when it is unset — nullable
  // rather than an empty string because "unset" and "set to nothing" are
  // different answers and a driver acts on the difference. A call and not
  // `process.env.NAME`: member access on a key chosen at runtime is what
  // Phase 0 refuses.
  if (name === "getenv") {
    if (checkBuiltinArity(ctx, call, name, args, 1)) {
      checkArgumentType(ctx, args.children[0], scope, name, T_STRING);
    }
    return ctx.table.nullableOf(T_STRING);
  }
  return ctx.errorType(call.children[0], `Unknown function \`${name}\``);
}

/**
 * Whether an expression statement ends the path: `process.exit(n)` and
 * `panic(m)` do, exactly as `return` does, which is what lets a non-`void`
 * function end with one.
 */
export function terminatesControlFlow(ctx: CheckContext, expr: Node): boolean {
  if (expr.kind !== N_CALL) {
    return false;
  }
  const callee = expr.children[0];
  if (callee.kind === N_IDENT) {
    return callee.text === "panic" && ctx.signature("panic") === null;
  }
  if (callee.kind !== N_MEMBER || callee.children[0].kind !== N_IDENT) {
    return false;
  }
  return callee.children[0].text === "process" && callee.text === "exit";
}

/**
 * Whether an expression *is* `process.argv`. The array is built once by the
 * `@main` wrapper and lives outside the arena, so a program may read it any
 * way it likes and may not write it: a store, a `push` or a `pop` would
 * change what every other module sees and would outlive an `Arena.reset`.
 */
export function isArgvExpression(ctx: CheckContext, expr: Node, scope: Scope): boolean {
  // `(process.argv).push(...)` is the same write as `process.argv.push(...)`,
  // so the parentheses are stepped through rather than hiding it.
  let inner = expr;
  while (inner.kind === N_PAREN) {
    inner = inner.children[0];
  }
  if (inner.kind !== N_MEMBER || inner.text !== "argv") {
    return false;
  }
  const receiver = inner.children[0];
  if (receiver.kind !== N_IDENT || receiver.text !== "process") {
    return false;
  }
  // A local called `process` shadows the namespace, as it would in TypeScript.
  return scope.lookup("process") === null && ctx.program.constant("process") === null;
}
