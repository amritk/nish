// `--emit-napi <shim.c>`: a Node-API (N-API) shim that turns every external
// function whose types JS can carry into a JS function
// (`src/interop/napi.ts`, WP8).
//
// The shim is plain C against node_api.h (Node's stable ABI, so the addon
// survives Node upgrades without a rebuild). Per function it:
//   1. reads the arguments (`napi_get_cb_info`) and checks the count,
//   2. type-checks and converts each one:
//        number   a JS number; ToInt32 semantics in i32 mode (like `x | 0`)
//        u8 u16 u32  a JS number through ToUint32 (`napi_get_value_uint32`),
//                 then the width's own modulus, so 300 reaches a `u8` as 44
//                 exactly as `new Uint8Array([300])[0]` does
//        f32      a JS number rounded to nearest through `nish_napi_f32`
//        boolean  a JS boolean
//        i64 u64  a JS bigint (`napi_get_value_bigint_{int,uint}64`)
//        string   a JS string, copied into an arena `nish_str`
//                 (`napi_get_value_string_utf8`, measured first, then copied)
//        Int32Array / Float32Array / Float64Array / BigInt64Array
//                 a JS typed array of exactly that kind, *borrowed*: the
//                 `nish_array` header is built on the C stack over the typed
//                 array's own bytes (`napi_get_typedarray_info`), so nothing
//                 is copied and writes through the parameter land in the
//                 caller's buffer. The callee must not retain the pointer
//                 beyond the call (the arena does not own it), and a `push`
//                 that grows the array moves it into the arena, invisibly to JS.
//   3. calls the compiled function through its C ABI,
//   4. boxes the result: `napi_create_int32` / `napi_create_uint32` (so a `u32`
//      above 2^31 arrives positive) / `napi_create_double` /
//      `napi_get_boolean` / `napi_create_bigint_{int,uint}64`, `undefined` for
//      void, `napi_create_string_utf8` for a string, and a fresh typed array
//      (`napi_create_arraybuffer` + memcpy + `napi_create_typedarray`) for an
//      array, so the JS value never aliases the arena.
// A violated check throws a TypeError naming the function and parameter.
//
// Functions that touch the arena (a string or array parameter or result)
// bracket the call with `nish_arena_mark` / `nish_arena_release`: every arena
// string or array made for the call is recycled before the wrapper returns,
// so a host never has to reset the arena for bridged calls. `nish_reset_arena`
// / `nish_free_arena` are still exported for hosts that want to.
//
// This is the most host-shaped of the five generators, because `src/` models
// a reader and a boxer as records of closures. Closures are what the language
// does not have, so a `Reader` and a `Boxer` here are **data with a kind**,
// and `napiReaderLines` / `napiBoxerCall` switch on that kind to write the same lines.
// The generated C is identical to the character; the difference is only in
// which side of the record holds the code.
//
// Build: scripts/build.sh <modules.ll> runtime/runtime.c <shim.c> -o x.node --profile napi

import { internalError } from "./ice";
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
  tsKeyword,
  tsSignature,
  TypedView,
  typedView,
} from "./interop_abi";
import {
  K_RESULT,
  T_BOOL,
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
  TypeTable,
} from "./types";

/** `a Float64Array`, `an Int32Array`. */
export const withArticle = (noun: string): string => `${napiStartsWithVowel(noun) ? "an" : "a"} ${noun}`;

const napiStartsWithVowel = (noun: string): boolean => {
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
};

// How a JS value becomes a parameter of this type. `src/` writes the lines
// with a closure per shape; here the shape is a tag and the switch in
// `readerLines` writes them.
const READ_SCALAR: i32 = 0;
const READ_STRING: i32 = 1;
const READ_RESULT: i32 = 2;
const READ_VIEW: i32 = 3;

/** The double-to-float conversion: a call rather than a cast, defined by the shim itself. */
const F32_HELPER: string = "nish_napi_f32";

/**
 * How N-API reads one scalar, and how what it wrote becomes a C variable of
 * the parameter's own type.
 *
 * `raw` is the type the getter writes, and it differs from `c` exactly where
 * N-API has no getter of that width: `napi_get_value_uint32` is the only
 * unsigned getter for a JS number, so `u8` and `u16` are read as a `uint32_t`
 * and then narrowed by `open` / `close`, and `f32` is read as a `double`. An
 * empty `open` means the getter already writes `c`.
 *
 * Out-of-range JS numbers truncate, they do not throw: 300 reaches a `u8`
 * parameter as 44 and -1 reaches a `u32` as 4294967295, which is what
 * JavaScript itself does storing a number into a typed array. The reasoning is
 * written out over `ScalarReader` in `src/interop/napi.ts`.
 */
export class ScalarReader {
  jsType: string;
  tag: string;
  getter: string;
  /** C type of the parameter itself. */
  c: string;
  /** C type the getter writes; the same as `c` when nothing is narrowed. */
  raw: string;
  /** `open` + the raw temporary + `close` is the value as a `c`; empty `open` means no temporary. */
  open: string;
  close: string;
  /** The bigint getters take a trailing `bool *lossless`. */
  lossless: boolean;

  constructor(
    jsType: string,
    tag: string,
    getter: string,
    c: string,
    raw: string,
    open: string,
    close: string,
    lossless: boolean
  ) {
    this.jsType = jsType;
    this.tag = tag;
    this.getter = getter;
    this.c = c;
    this.raw = raw;
    this.open = open;
    this.close = close;
    this.lossless = lossless;
  }
}

/** A getter that writes the parameter's own type: no temporary, no narrowing. */
const napiDirectReader = (jsType: string, tag: string, getter: string, c: string, lossless: boolean): ScalarReader => new ScalarReader(jsType, tag, getter, c, c, "", "", lossless);

/** `napi_get_value_uint32` writes a `uint32_t`; `u8` and `u16` are one cast away from it. */
const napiUnsignedReader = (c: string): ScalarReader => {
  const open = c === "uint32_t" ? "" : `(${c})`;
  return new ScalarReader("number", "napi_number", "napi_get_value_uint32", c, "uint32_t", open, "", false);
};

/**
 * `SCALAR_READERS` in `src/`, which is a record keyed by type kind. `null` for
 * a type N-API has no getter for at all — a class, an array, a nullable — and
 * that is what keeps such a parameter out of this shim.
 */
const napiScalarReader = (table: TypeTable, t: i32): ScalarReader | null => {
  switch (table.kindOf(t)) {
    case T_I32:
      return napiDirectReader("number", "napi_number", "napi_get_value_int32", "int32_t", false);
    case T_F64:
      return napiDirectReader("number", "napi_number", "napi_get_value_double", "double", false);
    case T_BOOL:
      return napiDirectReader("boolean", "napi_boolean", "napi_get_value_bool", "bool", false);
    case T_I64:
      return napiDirectReader("bigint", "napi_bigint", "napi_get_value_bigint_int64", "int64_t", true);
    case T_U64:
      return napiDirectReader("bigint", "napi_bigint", "napi_get_value_bigint_uint64", "uint64_t", true);
    case T_U8:
      return napiUnsignedReader("uint8_t");
    case T_U16:
      return napiUnsignedReader("uint16_t");
    case T_U32:
      return napiUnsignedReader("uint32_t");
    case T_F32:
      // C leaves a double-to-float conversion undefined when the value is out
      // of range, so `f32` goes through the helper rather than a bare cast.
      return new ScalarReader(
        "number",
        "napi_number",
        "napi_get_value_double",
        "float",
        "double",
        `${F32_HELPER}(`,
        ")",
        false
      );
    default:
      return null;
  }
};

/** `napi_get_value_int32(env, <value>, <dest>)`, plus the `&lossless` the bigint getters take. */
const napiScalarGet = (s: ScalarReader, value: string, dest: string): string => {
  if (s.lossless) {
    return `${s.getter}(env, ${value}, ${dest}, &lossless)`;
  }
  return `${s.getter}(env, ${value}, ${dest})`;
};

export class Reader {
  kind: i32;
  /** The JS type named in the TypeError. */
  jsType: string;
  /** Needs the shared `napi_valuetype type` local. */
  usesTypeof: boolean;
  /** Allocates in the arena or borrows JS memory: the call is arena-scoped. */
  arena: boolean;
  /** Reads an `f32` somewhere, so the shim needs the `nish_napi_f32` helper. */
  usesF32: boolean;
  /** `READ_SCALAR`: the getter and the C declaration. */
  scalar: ScalarReader | null;
  /** `READ_VIEW`: the typed array, and the `const nish_array *` the callee takes. */
  view: TypedView | null;
  cDecl: string;
  /** `READ_RESULT`: the packed word, and the reader for each arm (`null` ok arm = `Result<void, E>`). */
  word: string;
  okScalar: ScalarReader | null;
  errScalar: ScalarReader | null;

  constructor(kind: i32, jsType: string, usesTypeof: boolean, arena: boolean) {
    this.kind = kind;
    this.jsType = jsType;
    this.usesTypeof = usesTypeof;
    this.arena = arena;
    this.usesF32 = false;
    this.scalar = null;
    this.view = null;
    this.cDecl = "";
    this.word = "";
    this.okScalar = null;
    this.errScalar = null;
  }
}

const napiReader = (table: TypeTable, t: i32, written: boolean): Reader | null => {
  const scalar = napiScalarReader(table, t);
  if (scalar !== null) {
    const out = new Reader(READ_SCALAR, scalar.jsType, true, false);
    out.scalar = scalar;
    out.usesF32 = table.kindOf(t) === T_F32;
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
};

/**
 * The reader for a packed `Result` argument. Each arm is read with its own
 * scalar getter, straight into the union member when the getter writes that
 * member's type and through a temporary when it does not — a `u8` error or an
 * `f32` value narrows exactly as the same payload does at a plain parameter.
 */
const napiResultReader = (table: TypeTable, t: i32): Reader | null => {
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
  // A bigint payload would need the `lossless` out-parameter, and a 64-bit
  // payload is too wide for the packed word to begin with.
  if (error.lossless) {
    return null;
  }
  if (value !== null && value.lossless) {
    return null;
  }
  const out = new Reader(READ_RESULT, "Result object", false, false);
  out.word = cResultWord(table, t);
  // A `null` ok arm is the no-op of `Result<void, E>`: there is nothing to read.
  out.okScalar = value;
  out.errScalar = error;
  out.usesF32 = table.kindOf(ok) === T_F32 || table.kindOf(err) === T_F32;
  return out;
};

// How a wrapper gives up: throw, release the arena and throw, or -- once it has
// handed a promise back -- reject that promise. `src/` picks this with a closure
// per wrapper; a mode is what the language has instead, and the three spell the
// same three failing returns.
const FAIL_THROW: i32 = 0;
const FAIL_RELEASE: i32 = 1;
const FAIL_REJECT: i32 = 2;

const napiFailCall = (mode: i32, message: string): string => {
  if (mode === FAIL_RELEASE) {
    return `nish_napi_fail_at(env, mark, "${message}")`;
  }
  if (mode === FAIL_REJECT) {
    return `nish_napi_reject(env, nish_deferred, nish_promise, "${message}")`;
  }
  return `nish_napi_fail(env, "${message}")`;
};

/**
 * Declaration and conversion lines for parameter `c` read from `argv[i]`.
 * `what` is `<fn>: argument <n> (<name>)`, which every message here opens with.
 */
const napiReaderLines = (r: Reader, c: string, i: i32, what: string, mode: i32): string[] => {
  const lines: string[] = [];
  switch (r.kind) {
    case READ_SCALAR: {
      const scalar = r.scalar;
      if (scalar === null) {
        process.exit(internalError("napi: scalar reader without a scalar"));
      }
      // The getter writes the parameter itself unless its width is not one
      // N-API has a getter for, and then a temporary carries the raw value.
      const narrows = scalar.open.length > 0;
      const dest = narrows ? `${c}_raw` : c;
      lines.push(`${scalar.raw} ${dest};`);
      lines.push(`if (napi_typeof(env, argv[${i}], &type) != napi_ok || type != ${scalar.tag})`);
      lines.push(`  return ${napiFailCall(mode, `${what} must be a ${scalar.jsType}`)};`);
      lines.push(`if (${napiScalarGet(scalar, `argv[${i}]`, `&${dest}`)} != napi_ok)`);
      lines.push(`  return ${napiFailCall(mode, `${what} could not be converted`)};`);
      if (narrows) {
        lines.push(`${scalar.c} ${c} = ${scalar.open}${dest}${scalar.close};`);
      }
      return lines;
    }
    case READ_STRING: {
      lines.push(`const nish_str *${c};`);
      lines.push(`if (napi_typeof(env, argv[${i}], &type) != napi_ok || type != napi_string)`);
      lines.push(`  return ${napiFailCall(mode, `${what} must be a string`)};`);
      lines.push(`if ((${c} = nish_napi_string_arg(env, argv[${i}])) == NULL)`);
      lines.push(`  return ${napiFailCall(mode, `${what} could not be converted`)};`);
      return lines;
    }
    case READ_RESULT: {
      const shape = `${what} must be { ok: true, value } or { ok: false, error }`;
      const errScalar = r.errScalar;
      if (errScalar === null) {
        process.exit(internalError("napi: result reader without an error arm"));
      }
      // Each arm reads into its union member, or into a temporary the
      // narrowing below turns into that member's own type.
      const okScalar = r.okScalar;
      let readOk = "napi_ok";
      let okTemp = "";
      let okAssign = "";
      if (okScalar !== null) {
        if (okScalar.open.length > 0) {
          readOk = napiScalarGet(okScalar, `${c}_arm`, `&${c}_value_raw`);
          okTemp = `${okScalar.raw} ${c}_value_raw = 0;`;
          okAssign = `if (${c}_flag) ${c}.as.value = ${okScalar.open}${c}_value_raw${okScalar.close};`;
        } else {
          readOk = napiScalarGet(okScalar, `${c}_arm`, `&${c}.as.value`);
        }
      }
      let readErr = napiScalarGet(errScalar, `${c}_arm`, `&${c}.as.error`);
      let errTemp = "";
      let errAssign = "";
      if (errScalar.open.length > 0) {
        readErr = napiScalarGet(errScalar, `${c}_arm`, `&${c}_error_raw`);
        errTemp = `${errScalar.raw} ${c}_error_raw = 0;`;
        errAssign = `if (!${c}_flag) ${c}.as.error = ${errScalar.open}${c}_error_raw${errScalar.close};`;
      }
      lines.push(`napi_value ${c}_ok, ${c}_arm;`);
      lines.push(`bool ${c}_flag;`);
      lines.push(`if (napi_get_named_property(env, argv[${i}], "ok", &${c}_ok) != napi_ok ||`);
      lines.push(`    napi_get_value_bool(env, ${c}_ok, &${c}_flag) != napi_ok)`);
      lines.push(`  return ${napiFailCall(mode, shape)};`);
      lines.push(`${r.word} ${c};`);
      lines.push(`${c}.ok = ${c}_flag;`);
      lines.push(
        `if (napi_get_named_property(env, argv[${i}], ${c}_flag ? "value" : "error", &${c}_arm) != napi_ok)`
      );
      lines.push(`  return ${napiFailCall(mode, shape)};`);
      // Only the arm the discriminant selects is read, so the temporary of the
      // other one is never written: give both a value so neither is read cold.
      if (okTemp.length > 0) {
        lines.push(okTemp);
      }
      if (errTemp.length > 0) {
        lines.push(errTemp);
      }
      lines.push(`if ((${c}_flag ? ${readOk} : ${readErr}) != napi_ok)`);
      lines.push(`  return ${napiFailCall(mode, `${what} could not be converted`)};`);
      if (okAssign.length > 0) {
        lines.push(okAssign);
      }
      if (errAssign.length > 0) {
        lines.push(errAssign);
      }
      return lines;
    }
    default: {
      const view = r.view;
      if (view === null) {
        process.exit(internalError("napi: view reader without a view"));
      }
      lines.push(`nish_array ${c}_hdr; /* borrowed: the ${view.ctor}'s own bytes, for this call only */`);
      lines.push(`if (!nish_napi_array_arg(env, argv[${i}], ${view.napiType}, &${c}_hdr))`);
      lines.push(`  return ${napiFailCall(mode, `${what} must be ${withArticle(view.ctor)}`)};`);
      lines.push(`${r.cDecl}${c} = &${c}_hdr;`);
      return lines;
    }
  }
};

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
const napiScalarBox = (table: TypeTable, t: i32): string => {
  switch (table.kindOf(t)) {
    case T_I32:
      return "napi_create_int32";
    case T_F64:
      return "napi_create_double";
    case T_BOOL:
      return "napi_get_boolean";
    case T_I64:
      return "napi_create_bigint_int64";
    // WP15: every unsigned width below 64 bits fits a JS number exactly, so it
    // goes back as one. `napi_create_uint32` is what keeps a `u32` above 2^31
    // positive; `napi_create_int32` would hand JS the negative twin of the same
    // bits. A `uint8_t` / `uint16_t` widens to the `uint32_t` it takes without
    // changing value, so one constructor serves all three.
    case T_U8:
      return "napi_create_uint32";
    case T_U16:
      return "napi_create_uint32";
    case T_U32:
      return "napi_create_uint32";
    case T_U64:
      return "napi_create_bigint_uint64";
    // An `f32` widens to a double exactly, so JS sees the value the module
    // holds rather than a rounded one.
    case T_F32:
      return "napi_create_double";
    case T_VOID:
      return "napi_get_undefined";
    default:
      return "";
  }
};

const napiScalarBoxCall = (box: string, value: string, dest: string): string => box === "napi_get_undefined" ? `napi_get_undefined(env, ${dest})` : `${box}(env, ${value}, ${dest})`;

/** The boxing plan for a result of this type, or `null` when it cannot cross. */
const napiBoxer = (table: TypeTable, t: i32): Boxer | null => {
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
};

/**
 * `{ ok: true, value }` / `{ ok: false, error }`: box the arm the discriminant
 * selects into `payload`, then wrap it with `nish_napi_result`. `null` when
 * either payload has no scalar constructor, which now means only a payload
 * that is not a scalar at all: every numeric width has one.
 */
const napiResultBoxer = (table: TypeTable, t: i32): Boxer | null => {
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
};

/** The napi call that puts the value in `&out`. */
const napiBoxerCall = (box: Boxer, value: string): string => {
  switch (box.kind) {
    case BOX_SCALAR:
      return napiScalarBoxCall(box.scalar, value, "&out");
    case BOX_STRING:
      return `napi_create_string_utf8(env, ${value}->data, ${value}->len, &out)`;
    case BOX_RESULT:
      return `nish_napi_result(env, ${value}.ok != 0, payload, &out)`;
    default: {
      const view = box.view;
      if (view === null) {
        process.exit(internalError("napi: view boxer without a view"));
      }
      return `nish_napi_array_result(env, ${value}, ${view.napiType}, ${view.elemSize}, &out)`;
    }
  }
};

/** Lines to emit before the boxing call (WP17: a `Result` boxes its payload first). */
const napiBoxerPre = (box: Boxer, value: string): string[] => {
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
};

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

const napiPlan = (table: TypeTable, fn: ExternalFunction): Plan | null => {
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
};

/**
 * Why `napiPlan` refused this function, naming the position and the type that
 * did it. The shim writes this next to the signature instead of dropping the
 * function without a word: an omission a reader cannot see is exactly how the
 * unsigned widths sat unbridged behind a reader table nobody had extended.
 */
const napiSkipReason = (table: TypeTable, fn: ExternalFunction): string => {
  let i = 0;
  while (i < fn.sig.paramTypes.length) {
    const r = napiReader(table, fn.sig.paramTypes[i], fn.writtenParams.has(fn.sig.paramNames[i]));
    if (r === null) {
      const shown = tsKeyword(table, fn.sig.paramTypes[i]);
      return `parameter ${i + 1} (${fn.sig.paramNames[i]}) is ${shown}`;
    }
    i = i + 1;
  }
  if (napiBoxer(table, fn.sig.returnType) === null) {
    return `it returns ${tsKeyword(table, fn.sig.returnType)}`;
  }
  // Unreachable while `napiPlan` refuses only for a parameter or the result,
  // and still better than a comment that names nothing if that ever changes.
  return "one of its types does not cross";
};

/**
 * Why this function gets no asynchronous export, or `null` when it gets one.
 * Only a signature whose every parameter and result is a scalar reaches the
 * thread pool, and the reason is the arena rather than the types.
 *
 * The arena is thread-local (WP20 T0), so a `nish_arena_mark` taken on the JS
 * thread cannot be released on the libuv one, and an arena string built for
 * the call by the JS thread would belong to the wrong thread's allocator for
 * the whole of the call that reads it. A borrowed typed array is worse still:
 * the shim holds a pointer into the JS `ArrayBuffer`, and N-API promises that
 * pointer is good only for the callback that read it -- an asynchronous call
 * outlives that callback by design, and the buffer can be detached while the
 * worker is running. Marshalling either one through a `malloc`ed copy is the
 * shape that would lift this, and it is deliberately not in the first cut.
 *
 * A function named here keeps its synchronous wrapper: it is still exported,
 * still callable, and only its promise-returning twin is missing.
 */
const napiAsyncSkipReason = (table: TypeTable, p: Plan): string | null => {
  const sig = p.fn.sig;
  let i = 0;
  while (i < p.readers.length) {
    if (p.readers[i].arena) {
      const shown = tsKeyword(table, sig.paramTypes[i]);
      return `parameter ${i + 1} (${sig.paramNames[i]}) is ${shown}, which the call would borrow across threads`;
    }
    i = i + 1;
  }
  if (p.box.arena) {
    return `it returns ${tsKeyword(table, sig.returnType)}, which lives in the worker thread's arena`;
  }
  // A by-value `Result` could cross -- it is scalars in a register -- but its
  // boxing is several `napi_*` calls deep, so it waits for a second cut rather
  // than being the one untested shape in the first.
  if (p.box.kind === BOX_RESULT) {
    const shown = tsKeyword(table, sig.returnType);
    return `it returns ${shown}, and a by-value \`Result\` is not bridged asynchronously yet`;
  }
  return null;
};

/**
 * The asynchronous twin of `napiWrapper` (WP24 §5.1, A1): the same argument
 * reading on the JS thread, then `napi_create_async_work` so that the compiled
 * function runs on one of libuv's thread-pool threads and JavaScript gets a
 * promise instead of a blocked event loop.
 *
 * **The compiled function is not changed in any way.** It is exactly as
 * synchronous as it was; every piece of the asynchrony is in the C below,
 * which is the whole reason this item has no language surface.
 *
 * Three things about the shape are load-bearing:
 *
 *   - **The promise is created before the arguments are read**, so that every
 *     failure from that point on rejects it. A promise-returning function that
 *     threw synchronously for a bad argument would be the one shape a JS
 *     caller cannot reach with `.catch`, and `await` would surface it from the
 *     call rather than from the settle.
 *   - **The arena bracket is taken and released inside `execute`**, on the one
 *     thread that allocates in it. A libuv worker is reused across calls, so
 *     without the bracket whatever the call allocated would stay in that
 *     thread's arena until the process exited.
 *   - **`execute` never touches `env`.** N-API forbids reaching the JS engine
 *     off the loop thread, so the arguments are plain C by then and the result
 *     is boxed back in `complete`, which runs on the JS thread again.
 */
const napiAsyncWrapper = (table: TypeTable, p: Plan): string[] => {
  const sig = p.fn.sig;
  const name = sig.name;
  const jsName = `${sig.sourceName}Async`;
  const n = sig.paramNames.length;
  const work = `nish_napi_work_${name}`;
  const isVoid = table.kindOf(sig.returnType) === T_VOID;
  const lines: string[] = [];

  lines.push("typedef struct {");
  lines.push("  napi_async_work work;");
  lines.push("  napi_deferred deferred;");
  let i = 0;
  while (i < n) {
    const t = cType(table, sig.paramTypes[i], POS_PARAM, false);
    lines.push(`  ${t}${spaceAfter(t)}${cParamName(sig.paramNames[i])};`);
    i = i + 1;
  }
  if (!isVoid) {
    const ret = cType(table, sig.returnType, POS_RETURN, false);
    lines.push(`  ${ret}${spaceAfter(ret)}result;`);
  }
  lines.push(`} ${work};`);
  lines.push("");

  const args: string[] = [];
  i = 0;
  while (i < n) {
    args.push(`nish_w->${cParamName(sig.paramNames[i])}`);
    i = i + 1;
  }
  lines.push(`static void nish_napi_exec_${name}(napi_env env, void *data) {`);
  lines.push("  (void)env; /* N-API forbids reaching the JS engine here: this runs off the loop thread. */");
  lines.push(`  ${work} *nish_w = (${work} *)data;`);
  lines.push("  /* The arena is thread-local (WP20 T0), so the mark and the release are");
  lines.push("   * both this worker's. A pool thread is reused, so the bracket is what");
  lines.push("   * keeps its arena flat across calls instead of growing for the process's");
  lines.push("   * whole life. */");
  lines.push("  uint64_t nish_mark = nish_arena_mark();");
  const assign = isVoid ? "" : "nish_w->result = ";
  lines.push(`  ${assign}${cFunctionName(name).ident}(${args.join(", ")});`);
  lines.push("  nish_arena_release(nish_mark);");
  lines.push("}");
  lines.push("");

  lines.push(`static void nish_napi_done_${name}(napi_env env, napi_status status, void *data) {`);
  lines.push(`  ${work} *nish_w = (${work} *)data;`);
  lines.push("  napi_value out;");
  lines.push("  if (status != napi_ok)");
  lines.push(`    nish_napi_reject_at(env, nish_w->deferred, "${jsName}: the call did not run");`);
  lines.push(`  else if (${napiBoxerCall(p.box, isVoid ? "0" : "nish_w->result")} != napi_ok)`);
  lines.push(`    nish_napi_reject_at(env, nish_w->deferred, "${jsName}: cannot create the result");`);
  lines.push("  else");
  lines.push("    napi_resolve_deferred(env, nish_w->deferred, out);");
  lines.push("  napi_delete_async_work(env, nish_w->work);");
  lines.push("  free(nish_w);");
  lines.push("}");
  lines.push("");

  lines.push(`static napi_value nish_napi_async_${name}(napi_env env, napi_callback_info info) {`);
  lines.push("  napi_value nish_promise;");
  lines.push("  napi_deferred nish_deferred;");
  lines.push("  if (napi_create_promise(env, &nish_deferred, &nish_promise) != napi_ok)");
  lines.push(`    return nish_napi_fail(env, "${jsName}: cannot create the promise");`);
  if (n === 0) {
    lines.push("  (void)info;");
  } else {
    lines.push(`  size_t argc = ${n};`);
    lines.push(`  napi_value argv[${n}];`);
    lines.push("  if (napi_get_cb_info(env, info, &argc, argv, NULL, NULL) != napi_ok)");
    lines.push(`    return ${napiFailCall(FAIL_REJECT, `${jsName}: cannot read arguments`)};`);
    lines.push(`  if (argc < ${n})`);
    const plural = n === 1 ? "" : "s";
    lines.push(`    return ${napiFailCall(FAIL_REJECT, `${jsName} expects ${n} argument${plural}`)};`);
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
    i = 0;
    while (i < sig.paramTypes.length) {
      const sc = napiScalarReader(table, sig.paramTypes[i]);
      if (sc !== null && sc.lossless) {
        usesLossless = true;
      }
      i = i + 1;
    }
    if (usesLossless) {
      lines.push("  bool lossless;");
    }
  }
  i = 0;
  while (i < p.readers.length) {
    const what = `${jsName}: argument ${i + 1} (${sig.paramNames[i]})`;
    for (const line of napiReaderLines(p.readers[i], cParamName(sig.paramNames[i]), i, what, FAIL_REJECT)) {
      lines.push(`  ${line}`);
    }
    i = i + 1;
  }
  lines.push(`  ${work} *nish_w = (${work} *)malloc(sizeof *nish_w);`);
  lines.push("  if (nish_w == NULL)");
  lines.push(`    return ${napiFailCall(FAIL_REJECT, `${jsName}: out of memory`)};`);
  lines.push("  nish_w->deferred = nish_deferred;");
  i = 0;
  while (i < n) {
    const v = cParamName(sig.paramNames[i]);
    lines.push(`  nish_w->${v} = ${v};`);
    i = i + 1;
  }
  lines.push("  napi_value nish_name;");
  lines.push(`  if (napi_create_string_utf8(env, "${jsName}", NAPI_AUTO_LENGTH, &nish_name) != napi_ok ||`);
  lines.push(
    `      napi_create_async_work(env, NULL, nish_name, nish_napi_exec_${name}, nish_napi_done_${name}, nish_w, &nish_w->work) != napi_ok) {`
  );
  lines.push("    free(nish_w);");
  lines.push(`    return ${napiFailCall(FAIL_REJECT, `${jsName}: cannot create the async work`)};`);
  lines.push("  }");
  lines.push("  if (napi_queue_async_work(env, nish_w->work) != napi_ok) {");
  lines.push("    napi_delete_async_work(env, nish_w->work);");
  lines.push("    free(nish_w);");
  lines.push(`    return ${napiFailCall(FAIL_REJECT, `${jsName}: cannot queue the async work`)};`);
  lines.push("  }");
  lines.push("  return nish_promise;");
  lines.push("}");
  lines.push("");
  return lines;
};

const napiWrapper = (table: TypeTable, p: Plan): string[] => {
  const sig = p.fn.sig;
  const name = sig.name;
  const n = sig.paramNames.length;
  const scoped = p.scoped;
  const mode = scoped ? FAIL_RELEASE : FAIL_THROW;
  const lines: string[] = [];
  lines.push(`static napi_value nish_napi_${name}(napi_env env, napi_callback_info info) {`);
  if (n === 0) {
    lines.push("  (void)info;");
  } else {
    lines.push(`  size_t argc = ${n};`);
    lines.push(`  napi_value argv[${n}];`);
    lines.push("  if (napi_get_cb_info(env, info, &argc, argv, NULL, NULL) != napi_ok)");
    lines.push(`    return nish_napi_fail(env, "${name}: cannot read arguments");`);
    lines.push(`  if (argc < ${n})`);
    lines.push(`    return nish_napi_fail(env, "${name} expects ${n} argument${n === 1 ? "" : "s"}");`);
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
      const s = napiScalarReader(table, sig.paramTypes[i]);
      if (s !== null && s.lossless) {
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
      "  uint64_t mark = nish_arena_mark(); /* arena strings/arrays made for this call are released on return */"
    );
  }
  let i = 0;
  while (i < p.readers.length) {
    const what = `${name}: argument ${i + 1} (${sig.paramNames[i]})`;
    for (const line of napiReaderLines(p.readers[i], cParamName(sig.paramNames[i]), i, what, mode)) {
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
    lines.push(`    return ${napiFailCall(mode, `${name}: cannot create the result`)};`);
  }
  lines.push(`  if (${napiBoxerCall(p.box, "result")} != napi_ok)`);
  lines.push(`    return ${napiFailCall(mode, `${name}: cannot create the result`)};`);
  if (scoped) {
    lines.push("  nish_arena_release(mark);");
  }
  lines.push("  return out;");
  lines.push("}");
  lines.push("");
  return lines;
};

export const generateNapiShim = (
  compilation: Compilation,
  fns: ExternalFunction[],
  asyncExports: boolean
): string => {
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
      skipped.push(`${source} -- not bridged: ${napiSkipReason(table, fn)}`);
    }
  }
  // WP24 A1: `--emit-napi-async` adds a promise-returning `<name>Async` beside
  // every synchronous export that can cross a thread boundary. It is additive
  // on purpose -- the synchronous wrapper is what the WP8 batching benchmark
  // calls, and a host that wants the answer now still wants it -- so a host
  // chooses per call site rather than per build, and the two can be measured
  // against each other inside one addon.
  const asyncPlans: Plan[] = [];
  const asyncSkipped: string[] = [];
  if (asyncExports) {
    for (const p of plans) {
      const source = `${p.fn.unit.path}: ${tsSignature(table, p.fn.sig)}`;
      const jsName = `${p.fn.sig.sourceName}Async`;
      // `<name>Async` is a name in the same export namespace, so a program that
      // already exports it wins: an export the program asked for is not
      // shadowed by one this flag invented.
      let taken = false;
      for (const other of plans) {
        if (other.fn.sig.sourceName === jsName) {
          taken = true;
        }
      }
      const why = taken ? `\`${jsName}\` is already an export of this module` : napiAsyncSkipReason(table, p);
      if (why === null) {
        asyncPlans.push(p);
      } else {
        asyncSkipped.push(`${source} -- no \`${jsName}\`: ${why}`);
      }
    }
  }
  const needsAsync = asyncPlans.length > 0;
  const planned: ExternalFunction[] = [];
  let needsString = false;
  let needsArrayArg = false;
  let needsArrayResult = false;
  let needsScoped = false;
  let needsResult = false;
  let needsF32 = false;
  for (const p of plans) {
    planned.push(p.fn);
    for (const r of p.readers) {
      if (r.jsType === "string") {
        needsString = true;
      }
      if (r.jsType.endsWith("Array")) {
        needsArrayArg = true;
      }
      if (r.usesF32) {
        needsF32 = true;
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
  lines.push(banner(compilation, asyncExports ? "--emit-napi-async" : "--emit-napi", "/* "));
  lines.push(" *");
  lines.push(" * Build it into an addon together with the compiled module(s) and the runtime:");
  lines.push(
    " *   scripts/build.sh <modules.ll> runtime/runtime.c <this file> -o <name>.node --profile napi"
  );
  lines.push(' * Then `require("./<name>.node")` (or createRequire in ESM) and call the');
  lines.push(" * functions below. Numbers convert with ToInt32 (`x | 0`) in i32 mode; typed");
  lines.push(" * arrays are borrowed for the call (writes through them are visible to JS);");
  lines.push(" * strings and array results are copied, and the arena is released per call.");
  if (needsAsync) {
    lines.push(" *");
    lines.push(" * Every function below that carries only numbers, booleans and bigints also");
    lines.push(" * has a `<name>Async` twin: the same call on libuv's thread pool, answering");
    lines.push(" * a promise, so a long call does not block Node's event loop. The compiled");
    lines.push(" * function is unchanged and still exported synchronously under its own name;");
    lines.push(" * `<name>Async` rejects rather than throws, a bad argument included.");
  }
  lines.push(" */");
  if (needsAsync) {
    lines.push("");
    lines.push("/* An asynchronous export allocates on a libuv thread while the JS thread runs,");
    lines.push(" * so the arena has to be the thread-local one. Without -DNISH_THREADS it is a");
    lines.push(" * single process-wide bump allocator and the two threads would race it -- a");
    lines.push(" * silent heap corruption rather than a visible failure, so it is a build error");
    lines.push(" * instead. `scripts/build.sh --threads` (from `nish --threads`) sets the macro");
    lines.push(" * on every input, which is what keeps this file and runtime.c in step. */");
    lines.push("#if !defined(NISH_THREADS)");
    lines.push(
      '#error "--emit-napi-async needs the thread-local arena: build with scripts/build.sh --threads"'
    );
    lines.push("#endif");
    lines.push("");
  }
  lines.push("#include <node_api.h>");
  if (needsF32) {
    lines.push("#include <math.h>");
  }
  lines.push("#include <stdbool.h>");
  lines.push("#include <stddef.h>");
  lines.push("#include <stdint.h>");
  if (needsAsync) {
    lines.push("#include <stdlib.h>");
  }
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
  // Every external function is either wrapped below or named here with the
  // reason. A function that simply vanished from the addon would be a bug a
  // host could only find by calling it.
  if (skipped.length > 0) {
    lines.push("/* Not bridged, and why. This shim carries numbers (i32, u8, u16, u32, f32,");
    lines.push(" * f64), booleans, i64 and u64 as bigints, strings, Int32Array /");
    lines.push(" * Float32Array / Float64Array / BigInt64Array, and a `Result` passed or");
    lines.push(" * returned by value over those; anything else needs a host that can follow");
    lines.push(" * an arena pointer, which JavaScript is not. */");
    for (const s of skipped) {
      lines.push(`/* ${s} */`);
    }
    lines.push("");
  }

  if (plans.length > 0) {
    lines.push(
      "/* Throw a TypeError; returning NULL hands `undefined` back while the exception is pending. */"
    );
    lines.push("static napi_value nish_napi_fail(napi_env env, const char *message) {");
    lines.push("  napi_throw_type_error(env, NULL, message);");
    lines.push("  return NULL;");
    lines.push("}");
    lines.push("");
  }
  if (needsScoped) {
    lines.push("/* The same, from a call that already marked the arena: release first. */");
    lines.push("static napi_value nish_napi_fail_at(napi_env env, uint64_t mark, const char *message) {");
    lines.push("  nish_arena_release(mark);");
    lines.push("  return nish_napi_fail(env, message);");
    lines.push("}");
    lines.push("");
  }
  if (needsF32) {
    lines.push("/* A JS number as an f32, rounded to nearest as `toF32` rounds it.");
    lines.push(" * C leaves a double-to-float conversion undefined when the value is out of");
    lines.push(" * the float range, so the two overflow cases are decided here rather than");
    lines.push(" * left to the compiler: 0x1.ffffffp127 is the midpoint between FLT_MAX and");
    lines.push(" * 2^128, and round-to-nearest-even sends everything from there upwards to");
    lines.push(" * an infinity. NaN and the infinities themselves convert directly. */");
    lines.push(`static float ${F32_HELPER}(double value) {`);
    lines.push("  if (value >= 0x1.ffffffp127) return INFINITY;");
    lines.push("  if (value <= -0x1.ffffffp127) return -INFINITY;");
    lines.push("  return (float)value;");
    lines.push("}");
    lines.push("");
  }
  if (needsString) {
    lines.push(
      "/* A JS string as an arena string: the first call measures, the second copies (NUL included). */"
    );
    lines.push("static nish_str *nish_napi_string_arg(napi_env env, napi_value value) {");
    lines.push("  size_t len;");
    lines.push("  if (napi_get_value_string_utf8(env, value, NULL, 0, &len) != napi_ok) return NULL;");
    lines.push("  nish_str *s = (nish_str *)nish_alloc_struct(sizeof(uint64_t) + len + 1);");
    lines.push(
      "  if (napi_get_value_string_utf8(env, value, s->data, len + 1, &len) != napi_ok) return NULL;"
    );
    lines.push("  s->len = len;");
    lines.push("  return s;");
    lines.push("}");
    lines.push("");
  }
  if (needsArrayArg) {
    lines.push("/* A typed array of the expected kind as a borrowed nish_array header over its own bytes. */");
    lines.push(
      "static bool nish_napi_array_arg(napi_env env, napi_value value, napi_typedarray_type want, nish_array *out) {"
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
      "static napi_status nish_napi_array_result(napi_env env, const nish_array *a, napi_typedarray_type type, size_t elem_size, napi_value *out) {"
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
      "static napi_status nish_napi_result(napi_env env, bool ok, napi_value payload, napi_value *out) {"
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
  lines.push("static napi_value nish_napi_undefined(napi_env env) {");
  lines.push("  napi_value out;");
  lines.push("  return napi_get_undefined(env, &out) == napi_ok ? out : NULL;");
  lines.push("}");
  lines.push("");
  lines.push(
    "/* nish_reset_arena(): recycle every string/object the module allocated since the last reset. */"
  );
  lines.push("static napi_value nish_napi_reset_arena(napi_env env, napi_callback_info info) {");
  lines.push("  (void)info;");
  lines.push("  nish_reset_arena();");
  lines.push("  return nish_napi_undefined(env);");
  lines.push("}");
  lines.push("");
  lines.push("/* nish_free_arena(): release every arena chunk back to the OS. */");
  lines.push("static napi_value nish_napi_free_arena(napi_env env, napi_callback_info info) {");
  lines.push("  (void)info;");
  lines.push("  nish_free_arena();");
  lines.push("  return nish_napi_undefined(env);");
  lines.push("}");
  lines.push("");
  if (needsAsync) {
    lines.push("/* Settle a promise the call already committed to answering: reject it with a");
    lines.push(" * TypeError rather than throwing, because the caller is holding it by then. */");
    lines.push(
      "static void nish_napi_reject_at(napi_env env, napi_deferred deferred, const char *message) {"
    );
    lines.push("  napi_value text, error;");
    lines.push("  if (napi_create_string_utf8(env, message, NAPI_AUTO_LENGTH, &text) == napi_ok &&");
    lines.push("      napi_create_type_error(env, NULL, text, &error) == napi_ok)");
    lines.push("    napi_reject_deferred(env, deferred, error);");
    lines.push("  else");
    lines.push("    /* The engine cannot even build the error. Settle it anyway: an unsettled");
    lines.push("     * promise is an `await` that never comes back. */");
    lines.push("    napi_reject_deferred(env, deferred, nish_napi_undefined(env));");
    lines.push("}");
    lines.push("");
    lines.push("/* The same, as the failing `return` of a wrapper that has a promise to answer. */");
    lines.push(
      "static napi_value nish_napi_reject(napi_env env, napi_deferred deferred, napi_value promise, const char *message) {"
    );
    lines.push("  nish_napi_reject_at(env, deferred, message);");
    lines.push("  return promise;");
    lines.push("}");
    lines.push("");
  }
  for (const p of plans) {
    lines.push(`/* ${p.fn.unit.path}: ${tsSignature(table, p.fn.sig)} */`);
    pushAll(lines, napiWrapper(table, p));
  }
  // Every function that asked for an asynchronous export and did not get one is
  // named with the reason, for the reason the unbridged ones are: a host
  // reaching for `<name>Async` and finding `undefined` should be able to read
  // why in the file that did not write it.
  if (asyncExports && asyncSkipped.length > 0) {
    lines.push("/* Not bridged asynchronously, and why. An asynchronous export carries only");
    lines.push(" * what the work item can hold by value -- numbers, booleans and bigints --");
    lines.push(" * because the arena is per-thread and a borrowed typed array belongs to the");
    lines.push(" * JS thread that lent it. Each of these is still exported synchronously");
    lines.push(" * under its own name. */");
    for (const skip of asyncSkipped) {
      lines.push(`/* ${skip} */`);
    }
    lines.push("");
  }
  for (const p of asyncPlans) {
    const shown = tsSignature(table, p.fn.sig);
    lines.push(`/* ${p.fn.unit.path}: ${shown} -- asynchronously, as \`${p.fn.sig.sourceName}Async\` */`);
    pushAll(lines, napiAsyncWrapper(table, p));
  }

  lines.push("static const struct {");
  lines.push("  const char *name;");
  lines.push("  napi_callback callback;");
  lines.push("} nish_napi_exports[] = {");
  for (const p of plans) {
    lines.push(`  {"${p.fn.sig.sourceName}", nish_napi_${p.fn.sig.name}},`);
  }
  for (const p of asyncPlans) {
    lines.push(`  {"${p.fn.sig.sourceName}Async", nish_napi_async_${p.fn.sig.name}},`);
  }
  lines.push('  {"nish_reset_arena", nish_napi_reset_arena},');
  lines.push('  {"nish_free_arena", nish_napi_free_arena},');
  lines.push("};");
  lines.push("");
  lines.push("NAPI_MODULE_INIT() {");
  lines.push("  for (size_t i = 0; i < sizeof nish_napi_exports / sizeof nish_napi_exports[0]; i++) {");
  lines.push("    napi_value fn;");
  lines.push(
    "    if (napi_create_function(env, nish_napi_exports[i].name, NAPI_AUTO_LENGTH, nish_napi_exports[i].callback, NULL, &fn) != napi_ok ||"
  );
  lines.push("        napi_set_named_property(env, exports, nish_napi_exports[i].name, fn) != napi_ok) {");
  lines.push(`      napi_throw_error(env, NULL, "${CLI}: cannot register the addon exports");`);
  lines.push("      return NULL;");
  lines.push("    }");
  lines.push("  }");
  lines.push("  return exports;");
  lines.push("}");
  lines.push("");
  return lines.join("\n");
};
