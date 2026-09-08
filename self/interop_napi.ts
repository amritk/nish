// `--emit-napi <shim.c>`: a Node-API (N-API) shim that turns every external
// function whose types JS can carry into a JS function
// (`src/interop/napi.ts`, WP8).
//
// The shim is plain C against node_api.h (Node's stable ABI, so the addon
// survives Node upgrades without a rebuild). Per function it:
//   1. reads the arguments (`napi_get_cb_info`) and checks the count,
//   2. type-checks and converts each one:
//        number   a JS number; ToInt32 semantics in i32 mode (like `x | 0`)
//        boolean  a JS boolean
//        i64      a JS bigint (`napi_get_value_bigint_int64`)
//        string   a JS string, copied into an arena `sts_str`
//                 (`napi_get_value_string_utf8`, measured first, then copied)
//        Int32Array / Float64Array / BigInt64Array (i32[] / f64[] / i64[])
//                 a JS typed array of exactly that kind, *borrowed*: the
//                 `sts_array` header is built on the C stack over the typed
//                 array's own bytes (`napi_get_typedarray_info`), so nothing
//                 is copied and writes through the parameter land in the
//                 caller's buffer. The callee must not retain the pointer
//                 beyond the call (the arena does not own it), and a `push`
//                 that grows the array moves it into the arena, invisibly to JS.
//   3. calls the compiled function through its C ABI,
//   4. boxes the result: `napi_create_int32` / `napi_create_double` /
//      `napi_get_boolean` / `napi_create_bigint_int64`, `undefined` for void,
//      `napi_create_string_utf8` for a string, and a fresh typed array
//      (`napi_create_arraybuffer` + memcpy + `napi_create_typedarray`) for an
//      array, so the JS value never aliases the arena.
// A violated check throws a TypeError naming the function and parameter.
//
// Functions that touch the arena (a string or array parameter or result)
// bracket the call with `sts_arena_mark` / `sts_arena_release`: every arena
// string or array made for the call is recycled before the wrapper returns,
// so a host never has to reset the arena for bridged calls. `sts_reset_arena`
// / `sts_free_arena` are still exported for hosts that want to.
//
// This is the most host-shaped of the five generators, because `src/` models
// a reader and a boxer as records of closures. Closures are what the language
// does not have, so a `Reader` and a `Boxer` here are **data with a kind**,
// and `napiReaderLines` / `napiBoxerCall` switch on that kind to write the same lines.
// The generated C is identical to the character; the difference is only in
// which side of the record holds the code.
//
// Build: scripts/build.sh <modules.ll> runtime/runtime.c <shim.c> -o x.node --profile napi

import { CLI, LANGUAGE, RUNTIME_HEADER } from "./branding";
import { Compilation } from "./compilation";
import {
  banner,
  cFunctionName,
  cParamName,
  cPrototype,
  cResultWord,
  cType,
  ExternalFunction,
  POS_PARAM,
  POS_RETURN,
  pushAll,
  resultDefinitions,
  spaceAfter,
  tsSignature,
  TypedView,
  typedView,
} from "./interop_abi";
import { K_RESULT, T_BOOL, T_F64, T_I32, T_I64, T_STRING, T_VOID, TypeTable } from "./types";

/** `a Float64Array`, `an Int32Array`. */
export function withArticle(noun: string): string {
  return `${napiStartsWithVowel(noun) ? "an" : "a"} ${noun}`;
}

function napiStartsWithVowel(noun: string): boolean {
  if (noun.length === 0) {
    return false;
  }
  const first = noun.substring(0, 1);
  return (
    first === "a" ||
    first === "e" ||
    first === "i" ||
    first === "o" ||
    first === "u" ||
    first === "A" ||
    first === "E" ||
    first === "I" ||
    first === "O" ||
    first === "U"
  );
}

// How a JS value becomes a parameter of this type. `src/` writes the lines
// with a closure per shape; here the shape is a tag and the switch in
// `readerLines` writes them.
const READ_SCALAR: i32 = 0;
const READ_STRING: i32 = 1;
const READ_RESULT: i32 = 2;
const READ_VIEW: i32 = 3;

/** The four scalars N-API reads directly: the JS type, its tag, its getter, its C type. */
export class ScalarReader {
  jsType: string;
  tag: string;
  getter: string;
  c: string;

  constructor(jsType: string, tag: string, getter: string, c: string) {
    this.jsType = jsType;
    this.tag = tag;
    this.getter = getter;
    this.c = c;
  }
}

/**
 * `SCALAR_READERS` in `src/`, which is a record keyed by type kind. `null`
 * for every other type, which is what keeps an unsigned or `f32` parameter
 * out of this shim (the `TODO(WP8)` in `src/interop/abi.ts`).
 */
function napiScalarReader(table: TypeTable, t: i32): ScalarReader | null {
  switch (table.kindOf(t)) {
    case T_I32:
      return new ScalarReader("number", "napi_number", "napi_get_value_int32", "int32_t");
    case T_F64:
      return new ScalarReader("number", "napi_number", "napi_get_value_double", "double");
    case T_BOOL:
      return new ScalarReader("boolean", "napi_boolean", "napi_get_value_bool", "bool");
    case T_I64:
      return new ScalarReader("bigint", "napi_bigint", "napi_get_value_bigint_int64", "int64_t");
    default:
      return null;
  }
}

export class Reader {
  kind: i32;
  /** The JS type named in the TypeError. */
  jsType: string;
  /** Needs the shared `napi_valuetype type` local. */
  usesTypeof: boolean;
  /** Allocates in the arena or borrows JS memory: the call is arena-scoped. */
  arena: boolean;
  /** `READ_SCALAR`: the getter and the C declaration. */
  scalar: ScalarReader | null;
  /** `READ_SCALAR` for `i64`: the getter takes a `&lossless` out-parameter. */
  lossless: boolean;
  /** `READ_VIEW`: the typed array, and the `const sts_array *` the callee takes. */
  view: TypedView | null;
  cDecl: string;
  /** `READ_RESULT`: the packed word, and the getter for each arm. */
  word: string;
  okGetter: string;
  errGetter: string;

  constructor(kind: i32, jsType: string, usesTypeof: boolean, arena: boolean) {
    this.kind = kind;
    this.jsType = jsType;
    this.usesTypeof = usesTypeof;
    this.arena = arena;
    this.scalar = null;
    this.lossless = false;
    this.view = null;
    this.cDecl = "";
    this.word = "";
    this.okGetter = "";
    this.errGetter = "";
  }
}

function napiReader(table: TypeTable, t: i32, written: boolean): Reader | null {
  const scalar = napiScalarReader(table, t);
  if (scalar !== null) {
    const out = new Reader(READ_SCALAR, scalar.jsType, true, false);
    out.scalar = scalar;
    out.lossless = table.kindOf(t) === T_I64;
    return out;
  }
  if (table.kindOf(t) === T_STRING) {
    return new Reader(READ_STRING, "string", true, true);
  }
  // WP17: a `Result` the ABI packs is read from the object JS models it with,
  // `{ ok: true, value }` / `{ ok: false, error }` — the same shape the shim
  // hands back. Only the arm `ok` selects is read, because only that one is
  // meaningful; the other stays whatever the initialiser left.
  if (table.kindOf(t) === K_RESULT && table.resultByValue(t)) {
    return napiResultReader(table, t);
  }
  const view = typedView(table, t);
  if (view !== null) {
    const out = new Reader(READ_VIEW, view.ctor, false, true);
    out.view = view;
    out.cDecl = cType(table, t, POS_PARAM, written);
    return out;
  }
  return null;
}

function napiResultReader(table: TypeTable, t: i32): Reader | null {
  const ok = table.okOf(t);
  const err = table.errOf(t);
  const isVoidOk = table.kindOf(ok) === T_VOID;
  const error = napiScalarReader(table, err);
  if (error === null) {
    return null;
  }
  let value: ScalarReader | null = null;
  if (!isVoidOk) {
    value = napiScalarReader(table, ok);
    if (value === null) {
      return null;
    }
  }
  if (table.kindOf(err) === T_I64 || (!isVoidOk && table.kindOf(ok) === T_I64)) {
    return null; // needs `lossless`
  }
  const out = new Reader(READ_RESULT, "Result object", false, false);
  out.word = cResultWord(table, t);
  // `napi_ok` is the no-op arm for `Result<void, E>`: there is nothing to read.
  if (value !== null) {
    out.okGetter = value.getter;
  }
  out.errGetter = error.getter;
  return out;
}

/** The failing return of one wrapper: an arena-scoped call releases first. */
function napiFailCall(scoped: boolean, message: string): string {
  return scoped ? `sts_napi_fail_at(env, mark, "${message}")` : `sts_napi_fail(env, "${message}")`;
}

/**
 * Declaration and conversion lines for parameter `c` read from `argv[i]`.
 * `what` is `<fn>: argument <n> (<name>)`, which every message here opens with.
 */
function napiReaderLines(r: Reader, c: string, i: i32, what: string, scoped: boolean): string[] {
  const lines: string[] = [];
  switch (r.kind) {
    case READ_SCALAR: {
      const scalar = r.scalar;
      if (scalar === null) {
        panic("internal error: scalar reader without a scalar");
      }
      const convert = r.lossless
        ? `${scalar.getter}(env, argv[${i}], &${c}, &lossless)`
        : `${scalar.getter}(env, argv[${i}], &${c})`;
      lines.push(`${scalar.c} ${c};`);
      lines.push(`if (napi_typeof(env, argv[${i}], &type) != napi_ok || type != ${scalar.tag})`);
      lines.push(`  return ${napiFailCall(scoped, `${what} must be a ${scalar.jsType}`)};`);
      lines.push(`if (${convert} != napi_ok)`);
      lines.push(`  return ${napiFailCall(scoped, `${what} could not be converted`)};`);
      return lines;
    }
    case READ_STRING: {
      lines.push(`const sts_str *${c};`);
      lines.push(`if (napi_typeof(env, argv[${i}], &type) != napi_ok || type != napi_string)`);
      lines.push(`  return ${napiFailCall(scoped, `${what} must be a string`)};`);
      lines.push(`if ((${c} = sts_napi_string_arg(env, argv[${i}])) == NULL)`);
      lines.push(`  return ${napiFailCall(scoped, `${what} could not be converted`)};`);
      return lines;
    }
    case READ_RESULT: {
      const shape = `${what} must be { ok: true, value } or { ok: false, error }`;
      const readArm = `${c}_flag ? ${r.okGetter.length > 0 ? `${r.okGetter}(env, ${c}_arm, &${c}.as.value)` : "napi_ok"} : ${r.errGetter}(env, ${c}_arm, &${c}.as.error)`;
      lines.push(`napi_value ${c}_ok, ${c}_arm;`);
      lines.push(`bool ${c}_flag;`);
      lines.push(`if (napi_get_named_property(env, argv[${i}], "ok", &${c}_ok) != napi_ok ||`);
      lines.push(`    napi_get_value_bool(env, ${c}_ok, &${c}_flag) != napi_ok)`);
      lines.push(`  return ${napiFailCall(scoped, shape)};`);
      lines.push(`${r.word} ${c};`);
      lines.push(`${c}.ok = ${c}_flag;`);
      lines.push(
        `if (napi_get_named_property(env, argv[${i}], ${c}_flag ? "value" : "error", &${c}_arm) != napi_ok)`
      );
      lines.push(`  return ${napiFailCall(scoped, shape)};`);
      lines.push(`if ((${readArm}) != napi_ok)`);
      lines.push(`  return ${napiFailCall(scoped, `${what} could not be converted`)};`);
      return lines;
    }
    default: {
      const view = r.view;
      if (view === null) {
        panic("internal error: view reader without a view");
      }
      lines.push(`sts_array ${c}_hdr; /* borrowed: the ${view.ctor}'s own bytes, for this call only */`);
      lines.push(`if (!sts_napi_array_arg(env, argv[${i}], ${view.napiType}, &${c}_hdr))`);
      lines.push(`  return ${napiFailCall(scoped, `${what} must be ${withArticle(view.ctor)}`)};`);
      lines.push(`${r.cDecl}${c} = &${c}_hdr;`);
      return lines;
    }
  }
}

// How a returned value becomes a JS value.
const BOX_SCALAR: i32 = 0;
const BOX_STRING: i32 = 1;
const BOX_VIEW: i32 = 2;
const BOX_RESULT: i32 = 3;

export class Boxer {
  kind: i32;
  arena: boolean;
  /** `BOX_SCALAR`: the napi constructor, `napi_get_undefined` for `void`. */
  scalar: string;
  view: TypedView | null;
  /** `BOX_RESULT`: the constructor for each arm; `""` for a `void` success arm. */
  okBox: string;
  errBox: string;

  constructor(kind: i32, arena: boolean) {
    this.kind = kind;
    this.arena = arena;
    this.scalar = "";
    this.view = null;
    this.okBox = "";
    this.errBox = "";
  }
}

/**
 * The napi constructor for a scalar, or `""` when the kind has none. `void`
 * answers `napi_get_undefined`, which takes no value; `scalarBoxCall` is
 * where that difference is spelled.
 */
function napiScalarBox(table: TypeTable, t: i32): string {
  switch (table.kindOf(t)) {
    case T_I32:
      return "napi_create_int32";
    case T_F64:
      return "napi_create_double";
    case T_BOOL:
      return "napi_get_boolean";
    case T_I64:
      return "napi_create_bigint_int64";
    case T_VOID:
      return "napi_get_undefined";
    default:
      return "";
  }
}

function napiScalarBoxCall(box: string, value: string, dest: string): string {
  return box === "napi_get_undefined" ? `napi_get_undefined(env, ${dest})` : `${box}(env, ${value}, ${dest})`;
}

/** The boxing plan for a result of this type, or `null` when it cannot cross. */
function napiBoxer(table: TypeTable, t: i32): Boxer | null {
  const scalar = napiScalarBox(table, t);
  if (scalar.length > 0) {
    const out = new Boxer(BOX_SCALAR, false);
    out.scalar = scalar;
    return out;
  }
  if (table.kindOf(t) === T_STRING) {
    return new Boxer(BOX_STRING, true);
  }
  const view = typedView(table, t);
  if (view !== null) {
    const out = new Boxer(BOX_VIEW, true);
    out.view = view;
    return out;
  }
  // WP17: a `Result` returned in a register becomes the tagged object JS
  // already models — `{ ok: true, value }` or `{ ok: false, error }`. Only the
  // arm the discriminant selects is boxed, because only that one was written.
  // A `Result` that comes back as an arena pointer stays out: handing JS a
  // pointer whose memory the next call recycles is not a bridge.
  if (table.kindOf(t) === K_RESULT && table.resultByValue(t)) {
    return napiResultBoxer(table, t);
  }
  return null;
}

/**
 * `{ ok: true, value }` / `{ ok: false, error }`: box the arm the discriminant
 * selects into `payload`, then wrap it with `sts_napi_result`. `null` when
 * either payload has no scalar constructor — the same gap that keeps an
 * unsigned or `f32` parameter out of this shim.
 */
function napiResultBoxer(table: TypeTable, t: i32): Boxer | null {
  const isVoidOk = table.kindOf(table.okOf(t)) === T_VOID;
  const value = isVoidOk ? "" : napiScalarBox(table, table.okOf(t));
  const error = napiScalarBox(table, table.errOf(t));
  if (error.length === 0 || (!isVoidOk && value.length === 0)) {
    return null;
  }
  const out = new Boxer(BOX_RESULT, false);
  out.okBox = value;
  out.errBox = error;
  return out;
}

/** The napi call that puts the value in `&out`. */
function napiBoxerCall(box: Boxer, value: string): string {
  switch (box.kind) {
    case BOX_SCALAR:
      return napiScalarBoxCall(box.scalar, value, "&out");
    case BOX_STRING:
      return `napi_create_string_utf8(env, ${value}->data, ${value}->len, &out)`;
    case BOX_RESULT:
      return `sts_napi_result(env, ${value}.ok != 0, payload, &out)`;
    default: {
      const view = box.view;
      if (view === null) {
        panic("internal error: view boxer without a view");
      }
      return `sts_napi_array_result(env, ${value}, ${view.napiType}, ${view.elemSize}, &out)`;
    }
  }
}

/** Lines to emit before the boxing call (WP17: a `Result` boxes its payload first). */
function napiBoxerPre(box: Boxer, value: string): string[] {
  const lines: string[] = [];
  if (box.kind !== BOX_RESULT) {
    return lines;
  }
  const okArm =
    box.okBox.length > 0
      ? napiScalarBoxCall(box.okBox, `${value}.as.value`, "&payload")
      : "napi_get_undefined(env, &payload)";
  lines.push("napi_value payload;");
  lines.push(
    `if ((${value}.ok ? ${okArm} : ${napiScalarBoxCall(box.errBox, `${value}.as.error`, "&payload")}) != napi_ok)`
  );
  return lines;
}

/** What one function needs from the shim's shared helpers. */
export class Plan {
  fn: ExternalFunction;
  readers: Reader[];
  box: Boxer;
  /** Strings or arrays cross: bracket the call with an arena mark/release. */
  scoped: boolean;

  constructor(fn: ExternalFunction, readers: Reader[], box: Boxer, scoped: boolean) {
    this.fn = fn;
    this.readers = readers;
    this.box = box;
    this.scoped = scoped;
  }
}

function napiPlan(table: TypeTable, fn: ExternalFunction): Plan | null {
  const readers: Reader[] = [];
  let i = 0;
  while (i < fn.sig.paramTypes.length) {
    const r = napiReader(table, fn.sig.paramTypes[i], fn.writtenParams.has(fn.sig.paramNames[i]));
    if (r === null) {
      return null;
    }
    readers.push(r);
    i = i + 1;
  }
  const box = napiBoxer(table, fn.sig.returnType);
  if (box === null) {
    return null;
  }
  let scoped = box.arena;
  for (const r of readers) {
    if (r.arena) {
      scoped = true;
    }
  }
  return new Plan(fn, readers, box, scoped);
}

function napiWrapper(table: TypeTable, p: Plan): string[] {
  const sig = p.fn.sig;
  const name = sig.name;
  const n = sig.paramNames.length;
  const scoped = p.scoped;
  const lines: string[] = [];
  lines.push(`static napi_value sts_napi_${name}(napi_env env, napi_callback_info info) {`);
  if (n === 0) {
    lines.push("  (void)info;");
  } else {
    lines.push(`  size_t argc = ${n};`);
    lines.push(`  napi_value argv[${n}];`);
    lines.push("  if (napi_get_cb_info(env, info, &argc, argv, NULL, NULL) != napi_ok)");
    lines.push(`    return sts_napi_fail(env, "${name}: cannot read arguments");`);
    lines.push(`  if (argc < ${n})`);
    lines.push(`    return sts_napi_fail(env, "${name} expects ${n} argument${n === 1 ? "" : "s"}");`);
    let usesTypeof = false;
    for (const r of p.readers) {
      if (r.usesTypeof) {
        usesTypeof = true;
      }
    }
    if (usesTypeof) {
      lines.push("  napi_valuetype type;");
    }
    let usesLossless = false;
    let i = 0;
    while (i < sig.paramTypes.length) {
      if (table.kindOf(sig.paramTypes[i]) === T_I64) {
        usesLossless = true;
      }
      i = i + 1;
    }
    if (usesLossless) {
      lines.push("  bool lossless;");
    }
  }
  if (scoped) {
    lines.push(
      "  uint64_t mark = sts_arena_mark(); /* arena strings/arrays made for this call are released on return */"
    );
  }
  let i = 0;
  while (i < p.readers.length) {
    const what = `${name}: argument ${i + 1} (${sig.paramNames[i]})`;
    for (const line of napiReaderLines(p.readers[i], cParamName(sig.paramNames[i]), i, what, scoped)) {
      lines.push(`  ${line}`);
    }
    i = i + 1;
  }

  const args: string[] = [];
  i = 0;
  while (i < sig.paramNames.length) {
    args.push(cParamName(sig.paramNames[i]));
    i = i + 1;
  }
  const call = `${cFunctionName(name).ident}(${args.join(", ")})`;
  lines.push("  napi_value out;");
  if (table.kindOf(sig.returnType) === T_VOID) {
    lines.push(`  ${call};`);
  } else {
    const ret = cType(table, sig.returnType, POS_RETURN, false);
    lines.push(`  ${ret}${spaceAfter(ret)}result = ${call};`);
  }
  const pre = napiBoxerPre(p.box, "result");
  if (pre.length > 0) {
    for (const line of pre) {
      lines.push(`  ${line}`);
    }
    lines.push(`    return ${napiFailCall(scoped, `${name}: cannot create the result`)};`);
  }
  lines.push(`  if (${napiBoxerCall(p.box, "result")} != napi_ok)`);
  lines.push(`    return ${napiFailCall(scoped, `${name}: cannot create the result`)};`);
  if (scoped) {
    lines.push("  sts_arena_release(mark);");
  }
  lines.push("  return out;");
  lines.push("}");
  lines.push("");
  return lines;
}

export function generateNapiShim(compilation: Compilation, fns: ExternalFunction[]): string {
  const table = compilation.table;
  const plans: Plan[] = [];
  const skipped: string[] = [];
  for (const fn of fns) {
    const source = `${fn.unit.path}: ${tsSignature(table, fn.sig)}`;
    if (fn.sig.name === "main") {
      skipped.push(`${source} -- not bridged: \`main\` is reserved for a process entry`);
      continue;
    }
    const p = napiPlan(table, fn);
    if (p !== null) {
      plans.push(p);
    } else {
      skipped.push(
        `${source} -- not bridged: only numbers, booleans, i64, strings, Int32Array/Float64Array/BigInt64Array and a Result returned by value over those cross this shim`
      );
    }
  }
  const planned: ExternalFunction[] = [];
  let needsString = false;
  let needsArrayArg = false;
  let needsArrayResult = false;
  let needsScoped = false;
  let needsResult = false;
  for (const p of plans) {
    planned.push(p.fn);
    for (const r of p.readers) {
      if (r.jsType === "string") {
        needsString = true;
      }
      if (r.jsType.endsWith("Array")) {
        needsArrayArg = true;
      }
    }
    if (typedView(table, p.fn.sig.returnType) !== null) {
      needsArrayResult = true;
    }
    if (p.scoped) {
      needsScoped = true;
    }
    if (p.box.kind === BOX_RESULT) {
      needsResult = true;
    }
  }

  const lines: string[] = [];
  lines.push(banner(compilation, "--emit-napi", "/* "));
  lines.push(" *");
  lines.push(" * Build it into an addon together with the compiled module(s) and the runtime:");
  lines.push(
    " *   scripts/build.sh <modules.ll> runtime/runtime.c <this file> -o <name>.node --profile napi"
  );
  lines.push(' * Then `require("./<name>.node")` (or createRequire in ESM) and call the');
  lines.push(" * functions below. Numbers convert with ToInt32 (`x | 0`) in i32 mode; typed");
  lines.push(" * arrays are borrowed for the call (writes through them are visible to JS);");
  lines.push(" * strings and array results are copied, and the arena is released per call.");
  lines.push(" */");
  lines.push("#include <node_api.h>");
  lines.push("#include <stdbool.h>");
  lines.push("#include <stddef.h>");
  lines.push("#include <stdint.h>");
  if (needsArrayResult) {
    lines.push("#include <string.h>");
  }
  lines.push(`#include "${RUNTIME_HEADER}" /* runtime/; the napi profile adds it to the include path */`);
  // WP17: the `Result` types the bridged signatures mention, spelled exactly
  // as --emit-header spells them, since this file declares its own prototypes.
  const noFields: i32[] = [];
  pushAll(lines, resultDefinitions(table, planned, noFields));
  lines.push("");
  lines.push(`/* C ABI of the bridged ${LANGUAGE} functions (identical to --emit-header). */`);
  for (const p of plans) {
    lines.push(`${cPrototype(table, p.fn.sig, p.fn.writtenParams)};`);
  }
  lines.push("");
  for (const s of skipped) {
    lines.push(`/* ${s} */`);
  }
  if (skipped.length > 0) {
    lines.push("");
  }

  if (plans.length > 0) {
    lines.push(
      "/* Throw a TypeError; returning NULL hands `undefined` back while the exception is pending. */"
    );
    lines.push("static napi_value sts_napi_fail(napi_env env, const char *message) {");
    lines.push("  napi_throw_type_error(env, NULL, message);");
    lines.push("  return NULL;");
    lines.push("}");
    lines.push("");
  }
  if (needsScoped) {
    lines.push("/* The same, from a call that already marked the arena: release first. */");
    lines.push("static napi_value sts_napi_fail_at(napi_env env, uint64_t mark, const char *message) {");
    lines.push("  sts_arena_release(mark);");
    lines.push("  return sts_napi_fail(env, message);");
    lines.push("}");
    lines.push("");
  }
  if (needsString) {
    lines.push(
      "/* A JS string as an arena string: the first call measures, the second copies (NUL included). */"
    );
    lines.push("static sts_str *sts_napi_string_arg(napi_env env, napi_value value) {");
    lines.push("  size_t len;");
    lines.push("  if (napi_get_value_string_utf8(env, value, NULL, 0, &len) != napi_ok) return NULL;");
    lines.push("  sts_str *s = (sts_str *)sts_alloc_struct(sizeof(uint64_t) + len + 1);");
    lines.push(
      "  if (napi_get_value_string_utf8(env, value, s->data, len + 1, &len) != napi_ok) return NULL;"
    );
    lines.push("  s->len = len;");
    lines.push("  return s;");
    lines.push("}");
    lines.push("");
  }
  if (needsArrayArg) {
    lines.push("/* A typed array of the expected kind as a borrowed sts_array header over its own bytes. */");
    lines.push(
      "static bool sts_napi_array_arg(napi_env env, napi_value value, napi_typedarray_type want, sts_array *out) {"
    );
    lines.push("  bool is_typedarray;");
    lines.push("  napi_typedarray_type type;");
    lines.push("  size_t len;");
    lines.push("  void *data;");
    lines.push(
      "  if (napi_is_typedarray(env, value, &is_typedarray) != napi_ok || !is_typedarray) return false;"
    );
    lines.push(
      "  if (napi_get_typedarray_info(env, value, &type, &len, &data, NULL, NULL) != napi_ok || type != want) return false;"
    );
    lines.push("  out->len = out->cap = len;");
    lines.push("  out->data = (char *)data;");
    lines.push("  return true;");
    lines.push("}");
    lines.push("");
  }
  if (needsArrayResult) {
    lines.push(
      "/* An arena array as a fresh typed array: copied, because the arena is released when the call returns. */"
    );
    lines.push(
      "static napi_status sts_napi_array_result(napi_env env, const sts_array *a, napi_typedarray_type type, size_t elem_size, napi_value *out) {"
    );
    lines.push("  void *data;");
    lines.push("  napi_value buffer;");
    lines.push("  napi_status status = napi_create_arraybuffer(env, a->len * elem_size, &data, &buffer);");
    lines.push("  if (status != napi_ok) return status;");
    lines.push("  if (a->len) memcpy(data, a->data, a->len * elem_size);");
    lines.push("  return napi_create_typedarray(env, type, a->len, buffer, 0, out);");
    lines.push("}");
    lines.push("");
  }
  if (needsResult) {
    lines.push("/* WP17: a `Result` as the object JS models it with — `{ ok, value }` or");
    lines.push(" * `{ ok, error }`. The dead arm is never written, so it is never read. */");
    lines.push(
      "static napi_status sts_napi_result(napi_env env, bool ok, napi_value payload, napi_value *out) {"
    );
    lines.push("  napi_value obj, flag;");
    lines.push("  napi_status status = napi_create_object(env, &obj);");
    lines.push("  if (status != napi_ok) return status;");
    lines.push("  status = napi_get_boolean(env, ok, &flag);");
    lines.push("  if (status != napi_ok) return status;");
    lines.push('  status = napi_set_named_property(env, obj, "ok", flag);');
    lines.push("  if (status != napi_ok) return status;");
    lines.push('  status = napi_set_named_property(env, obj, ok ? "value" : "error", payload);');
    lines.push("  if (status != napi_ok) return status;");
    lines.push("  *out = obj;");
    lines.push("  return napi_ok;");
    lines.push("}");
    lines.push("");
  }
  lines.push("static napi_value sts_napi_undefined(napi_env env) {");
  lines.push("  napi_value out;");
  lines.push("  return napi_get_undefined(env, &out) == napi_ok ? out : NULL;");
  lines.push("}");
  lines.push("");
  lines.push(
    "/* sts_reset_arena(): recycle every string/object the module allocated since the last reset. */"
  );
  lines.push("static napi_value sts_napi_reset_arena(napi_env env, napi_callback_info info) {");
  lines.push("  (void)info;");
  lines.push("  sts_reset_arena();");
  lines.push("  return sts_napi_undefined(env);");
  lines.push("}");
  lines.push("");
  lines.push("/* sts_free_arena(): release every arena chunk back to the OS. */");
  lines.push("static napi_value sts_napi_free_arena(napi_env env, napi_callback_info info) {");
  lines.push("  (void)info;");
  lines.push("  sts_free_arena();");
  lines.push("  return sts_napi_undefined(env);");
  lines.push("}");
  lines.push("");
  for (const p of plans) {
    lines.push(`/* ${p.fn.unit.path}: ${tsSignature(table, p.fn.sig)} */`);
    pushAll(lines, napiWrapper(table, p));
  }

  lines.push("static const struct {");
  lines.push("  const char *name;");
  lines.push("  napi_callback callback;");
  lines.push("} sts_napi_exports[] = {");
  for (const p of plans) {
    lines.push(`  {"${p.fn.sig.sourceName}", sts_napi_${p.fn.sig.name}},`);
  }
  lines.push('  {"sts_reset_arena", sts_napi_reset_arena},');
  lines.push('  {"sts_free_arena", sts_napi_free_arena},');
  lines.push("};");
  lines.push("");
  lines.push("NAPI_MODULE_INIT() {");
  lines.push("  for (size_t i = 0; i < sizeof sts_napi_exports / sizeof sts_napi_exports[0]; i++) {");
  lines.push("    napi_value fn;");
  lines.push(
    "    if (napi_create_function(env, sts_napi_exports[i].name, NAPI_AUTO_LENGTH, sts_napi_exports[i].callback, NULL, &fn) != napi_ok ||"
  );
  lines.push("        napi_set_named_property(env, exports, sts_napi_exports[i].name, fn) != napi_ok) {");
  lines.push(`      napi_throw_error(env, NULL, "${CLI}: cannot register the addon exports");`);
  lines.push("      return NULL;");
  lines.push("    }");
  lines.push("  }");
  lines.push("  return exports;");
  lines.push("}");
  lines.push("");
  return lines.join("\n");
}
