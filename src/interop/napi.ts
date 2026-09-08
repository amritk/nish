/**
 * `--emit-napi <shim.c>`: a Node-API (N-API) shim that turns every external
 * function whose types JS can carry into a JS function.
 *
 * The shim is plain C against node_api.h (Node's stable ABI, so the addon
 * survives Node upgrades without a rebuild). Per function it:
 *   1. reads the arguments (`napi_get_cb_info`) and checks the count,
 *   2. type-checks and converts each one:
 *        number   a JS number; ToInt32 semantics in i32 mode (like `x | 0`)
 *        u8 u16 u32  a JS number through ToUint32 (`napi_get_value_uint32`),
 *                 then the width's own modulus, so 300 reaches a `u8` as 44
 *                 exactly as `new Uint8Array([300])[0]` does
 *        f32      a JS number rounded to nearest through `amrit_napi_f32`
 *        boolean  a JS boolean
 *        i64 u64  a JS bigint (`napi_get_value_bigint_{int,uint}64`)
 *        string   a JS string, copied into an arena `amrit_str`
 *                 (`napi_get_value_string_utf8`, measured first, then copied)
 *        Int32Array / Float32Array / Float64Array / BigInt64Array
 *                 a JS typed array of exactly that kind, *borrowed*: the
 *                 `amrit_array` header is built on the C stack over the typed
 *                 array's own bytes (`napi_get_typedarray_info`), so nothing
 *                 is copied and writes through the parameter land in the
 *                 caller's buffer. The callee must not retain the pointer
 *                 beyond the call (the arena does not own it), and a `push`
 *                 that grows the array moves it into the arena, invisibly to JS.
 *   3. calls the compiled function through its C ABI,
 *   4. boxes the result: `napi_create_int32` / `napi_create_uint32` (so a `u32`
 *      above 2^31 arrives positive) / `napi_create_double` /
 *      `napi_get_boolean` / `napi_create_bigint_{int,uint}64`, `undefined` for
 *      void, `napi_create_string_utf8` for a string, and a fresh typed array
 *      (`napi_create_arraybuffer` + memcpy + `napi_create_typedarray`) for an
 *      array, so the JS value never aliases the arena.
 * A violated check throws a TypeError naming the function and parameter.
 *
 * Functions that touch the arena (a string or array parameter or result)
 * bracket the call with `amrit_arena_mark` / `amrit_arena_release`: every arena
 * string or array made for the call is recycled before the wrapper returns,
 * so a host never has to reset the arena for bridged calls. `amrit_reset_arena`
 * / `amrit_free_arena` are still exported for hosts that want to.
 *
 * Build: scripts/build.sh <modules.ll> runtime/runtime.c <shim.c> -o x.node --profile napi
 */
import { CLI, LANGUAGE, RUNTIME_HEADER } from "../branding";
import { Compilation } from "../compilation";
import { ResultType, StaticType, resultByValue } from "../types";
import {
  banner,
  cFunctionName,
  cResultWord,
  cParamName,
  cPrototype,
  cType,
  externalFunctions,
  ExternalFunction,
  kindOf,
  resultDefinitions,
  tsKeyword,
  tsSignature,
  typedView,
} from "./abi";

/** `a Float64Array`, `an Int32Array`. */
export function withArticle(noun: string): string {
  return `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
}

/** How a JS value becomes a parameter of this type: check, getter, C declaration. */
interface Reader {
  /** The JS type named in the TypeError. */
  jsType: string;
  /** Declaration and conversion lines for parameter `c` read from `argv[i]`; `fail(msg)` is the failing return. */
  lines(c: string, i: number, fail: (msg: string) => string): string[];
  /** Needs the shared `napi_valuetype type` local. */
  usesTypeof: boolean;
  /** Allocates in the arena or borrows JS memory: the call is arena-scoped. */
  arena: boolean;
  /** Reads an `f32` somewhere, so the shim needs the `amrit_napi_f32` helper. */
  usesF32: boolean;
}

/**
 * How N-API reads one scalar, and how what it wrote becomes a C variable of
 * the parameter's own type.
 *
 * `raw` is the type the getter writes, and it differs from `c` exactly where
 * N-API has no getter of that width: `napi_get_value_uint32` is the only
 * unsigned getter for a JS number, so `u8` and `u16` are read as a `uint32_t`
 * and then narrowed by `open` / `close`, and `f32` is read as a `double`. An
 * empty `open` means the getter already writes `c` and the shim reads straight
 * into the parameter.
 *
 * **Out-of-range JS numbers truncate, they do not throw.** The narrowing is
 * the one JavaScript itself performs when a number is stored into a typed
 * array: `napi_get_value_uint32` is ToUint32 and the cast to `uint8_t` /
 * `uint16_t` is the further modulus C defines for every unsigned type, so 300
 * reaches a `u8` parameter as 44 — exactly `new Uint8Array([300])[0]` — and -1
 * reaches a `u32` as 4294967295. That is the rule the shim's other numeric
 * readers already follow (`napi_get_value_int32` is ToInt32, so 2^31 reaches
 * an `i32` as -2^31, the same as `x | 0`), and a bridge that refused 300 for
 * a `u8` while quietly wrapping 2^31 for an `i32` would be the surprising one.
 * A host that wants a range error checks before it calls.
 */
type ScalarReader = {
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
};

/** The double-to-float conversion: a call rather than a cast, defined by the shim itself. */
const F32_HELPER = "amrit_napi_f32";

const directReader = (jsType: string, tag: string, getter: string, c: string, lossless = false): ScalarReader => ({
  jsType,
  tag,
  getter,
  c,
  raw: c,
  open: "",
  close: "",
  lossless,
});

/** `napi_get_value_uint32` writes a `uint32_t`; `u8` and `u16` are one cast away from it. */
const unsignedReader = (c: string): ScalarReader => ({
  jsType: "number",
  tag: "napi_number",
  getter: "napi_get_value_uint32",
  c,
  raw: "uint32_t",
  open: c === "uint32_t" ? "" : `(${c})`,
  close: "",
  lossless: false,
});

const SCALAR_READERS: Record<string, ScalarReader> = {
  i32: directReader("number", "napi_number", "napi_get_value_int32", "int32_t"),
  f64: directReader("number", "napi_number", "napi_get_value_double", "double"),
  bool: directReader("boolean", "napi_boolean", "napi_get_value_bool", "bool"),
  i64: directReader("bigint", "napi_bigint", "napi_get_value_bigint_int64", "int64_t", true),
  u64: directReader("bigint", "napi_bigint", "napi_get_value_bigint_uint64", "uint64_t", true),
  u8: unsignedReader("uint8_t"),
  u16: unsignedReader("uint16_t"),
  u32: unsignedReader("uint32_t"),
  // C leaves a double-to-float conversion undefined when the value is out of
  // range, so `f32` goes through the helper rather than through a bare cast.
  f32: {
    jsType: "number",
    tag: "napi_number",
    getter: "napi_get_value_double",
    c: "float",
    raw: "double",
    open: `${F32_HELPER}(`,
    close: ")",
    lossless: false,
  },
};

/** `napi_get_value_int32(env, <value>, <dest>)`, plus the `&lossless` the bigint getters take. */
const scalarGet = (s: ScalarReader, value: string, dest: string): string =>
  `${s.getter}(env, ${value}, ${dest}${s.lossless ? ", &lossless" : ""})`;

/** True when reading this type needs the shared `bool lossless` local. */
const needsLossless = (t: StaticType): boolean => SCALAR_READERS[kindOf(t)]?.lossless === true;

function reader(t: StaticType, written: boolean): Reader | undefined {
  const scalar = SCALAR_READERS[kindOf(t)];
  if (scalar) {
    const narrows = scalar.open.length > 0;
    return {
      jsType: scalar.jsType,
      usesTypeof: true,
      arena: false,
      usesF32: kindOf(t) === "f32",
      lines: (c, i, fail) => {
        // The getter writes the parameter itself unless its width is not one
        // N-API has a getter for, and then a temporary carries the raw value.
        const dest = narrows ? `${c}_raw` : c;
        const lines = [
          `${scalar.raw} ${dest};`,
          `if (napi_typeof(env, argv[${i}], &type) != napi_ok || type != ${scalar.tag})`,
          `  return ${fail(`must be a ${scalar.jsType}`)};`,
          `if (${scalarGet(scalar, `argv[${i}]`, `&${dest}`)} != napi_ok)`,
          `  return ${fail("could not be converted")};`,
        ];
        if (narrows) lines.push(`${scalar.c} ${c} = ${scalar.open}${dest}${scalar.close};`);
        return lines;
      },
    };
  }
  if (kindOf(t) === "string") {
    return {
      jsType: "string",
      usesTypeof: true,
      arena: true,
      usesF32: false,
      lines: (c, i, fail) => [
        `const amrit_str *${c};`,
        `if (napi_typeof(env, argv[${i}], &type) != napi_ok || type != napi_string)`,
        `  return ${fail("must be a string")};`,
        `if ((${c} = amrit_napi_string_arg(env, argv[${i}])) == NULL)`,
        `  return ${fail("could not be converted")};`,
      ],
    };
  }
  // WP17: a `Result` the ABI packs is read from the object JS models it with,
  // `{ ok: true, value }` / `{ ok: false, error }` — the same shape the shim
  // hands back. Only the arm `ok` selects is read, because only that one is
  // meaningful; the other stays whatever the initialiser left.
  if (kindOf(t) === "result" && resultByValue(t)) return resultReader(t as ResultType);
  const view = typedView(t);
  if (view) {
    return {
      jsType: view.ctor,
      usesTypeof: false,
      arena: true,
      usesF32: false,
      lines: (c, i, fail) => [
        `amrit_array ${c}_hdr; /* borrowed: the ${view.ctor}'s own bytes, for this call only */`,
        `if (!amrit_napi_array_arg(env, argv[${i}], ${view.napiType}, &${c}_hdr))`,
        `  return ${fail(`must be ${withArticle(view.ctor)}`)};`,
        `${cType(t, "param", written)}${c} = &${c}_hdr;`,
      ],
    };
  }
  return undefined;
}

interface Boxer {
  /** The napi call that puts the value in `&out`. */
  call: (value: string) => string;
  /** Lines to emit before it (WP17: a `Result` boxes its payload first). */
  pre?: (value: string) => string[];
  arena: boolean;
}

/**
 * The napi constructor for a scalar, as a function of the C expression to box
 * and the `napi_value *` to write; `undefined` when the kind has none. It is
 * a function rather than a string because a `Result` boxes its payload into
 * `&payload` while everything else boxes into `&out` (WP17).
 */
function scalarBox(t: StaticType): ((value: string, dest: string) => string) | undefined {
  const scalar: Record<string, string> = {
    i32: "napi_create_int32",
    f64: "napi_create_double",
    bool: "napi_get_boolean",
    i64: "napi_create_bigint_int64",
    // WP15: every unsigned width below 64 bits fits a JS number exactly, so it
    // goes back as one. `napi_create_uint32` is what keeps a `u32` above 2^31
    // positive; `napi_create_int32` would hand JS the negative twin of the same
    // bits. A `uint8_t` / `uint16_t` widens to the `uint32_t` it takes without
    // changing value, so one constructor serves all three.
    u8: "napi_create_uint32",
    u16: "napi_create_uint32",
    u32: "napi_create_uint32",
    u64: "napi_create_bigint_uint64",
    // An `f32` widens to a double exactly, so JS sees the value the module
    // holds rather than a rounded one.
    f32: "napi_create_double",
  };
  const k = kindOf(t);
  if (scalar[k]) return (value, dest) => `${scalar[k]}(env, ${value}, ${dest})`;
  if (k === "void") return (_value, dest) => `napi_get_undefined(env, ${dest})`;
  return undefined;
}

/** The boxing call for a result of this type, or undefined when it cannot cross. */
function boxer(t: StaticType): Boxer | undefined {
  const k = kindOf(t);
  const scalar = scalarBox(t);
  if (scalar) return { call: (v) => scalar(v, "&out"), arena: false };
  if (k === "string") return { call: (v) => `napi_create_string_utf8(env, ${v}->data, ${v}->len, &out)`, arena: true };
  const view = typedView(t);
  if (view) return { call: (v) => `amrit_napi_array_result(env, ${v}, ${view.napiType}, ${view.elemSize}, &out)`, arena: true };
  // WP17: a `Result` returned in a register becomes the tagged object JS
  // already models — `{ ok: true, value }` or `{ ok: false, error }`. Only the
  // arm the discriminant selects is boxed, because only that one was written.
  // A `Result` that comes back as an arena pointer stays out: handing JS a
  // pointer whose memory the next call recycles is not a bridge.
  if (k === "result" && resultByValue(t)) return resultBoxer(t as ResultType);
  return undefined;
}

/**
 * `{ ok: true, value }` / `{ ok: false, error }`: box the arm the discriminant
 * selects into `payload`, then wrap it with `amrit_napi_result`. `undefined`
 * when either payload has no scalar constructor, which now means only a
 * payload that is not a scalar at all: every numeric width has one.
 */
function resultBoxer(t: ResultType): Boxer | undefined {
  const value = t.ok.kind === "void" ? undefined : scalarBox(t.ok);
  const error = scalarBox(t.err);
  if (error === undefined || (t.ok.kind !== "void" && value === undefined)) return undefined;
  const okArm = (v: string) =>
    value ? value(`${v}.as.value`, "&payload") : "napi_get_undefined(env, &payload)";
  return {
    arena: false,
    pre: (v) => [
      "napi_value payload;",
      `if ((${v}.ok ? ${okArm(v)} : ${error(`${v}.as.error`, "&payload")}) != napi_ok)`,
    ],
    call: (v) => `amrit_napi_result(env, ${v}.ok != 0, payload, &out)`,
  };
}

/**
 * The reader for a packed `Result` argument. Each arm is read with its own
 * scalar getter, straight into the union member when the getter writes that
 * member's type and through a temporary when it does not — a `u8` error or an
 * `f32` value narrows exactly as the same payload does at a plain parameter.
 */
function resultReader(t: ResultType): Reader | undefined {
  const value = t.ok.kind === "void" ? undefined : SCALAR_READERS[kindOf(t.ok)];
  const error = SCALAR_READERS[kindOf(t.err)];
  if (error === undefined || (t.ok.kind !== "void" && value === undefined)) return undefined;
  // A bigint payload would need the `lossless` out-parameter, and a 64-bit
  // payload is too wide for the packed word to begin with.
  if (error.lossless || (value !== undefined && value.lossless)) return undefined;
  const okNarrow = value !== undefined && value.open.length > 0 ? value : undefined;
  const errNarrow = error.open.length > 0 ? error : undefined;
  return {
    jsType: "Result object",
    usesTypeof: false,
    arena: false,
    usesF32: kindOf(t.ok) === "f32" || kindOf(t.err) === "f32",
    lines: (c, i, fail) => {
      // `napi_ok` is the no-op arm for `Result<void, E>`: there is nothing to read.
      const readOk = value === undefined
        ? "napi_ok"
        : scalarGet(value, `${c}_arm`, okNarrow ? `&${c}_value_raw` : `&${c}.as.value`);
      const readErr = scalarGet(error, `${c}_arm`, errNarrow ? `&${c}_error_raw` : `&${c}.as.error`);
      const shape = "must be { ok: true, value } or { ok: false, error }";
      const lines = [
        `napi_value ${c}_ok, ${c}_arm;`,
        `bool ${c}_flag;`,
        `if (napi_get_named_property(env, argv[${i}], "ok", &${c}_ok) != napi_ok ||`,
        `    napi_get_value_bool(env, ${c}_ok, &${c}_flag) != napi_ok)`,
        `  return ${fail(shape)};`,
        `${cResultWord(t)} ${c};`,
        `${c}.ok = ${c}_flag;`,
        `if (napi_get_named_property(env, argv[${i}], ${c}_flag ? "value" : "error", &${c}_arm) != napi_ok)`,
        `  return ${fail(shape)};`,
      ];
      // Only the arm the discriminant selects is read, so the temporary of the
      // other one is never written: give both a value so neither is read cold.
      if (okNarrow) lines.push(`${okNarrow.raw} ${c}_value_raw = 0;`);
      if (errNarrow) lines.push(`${errNarrow.raw} ${c}_error_raw = 0;`);
      lines.push(`if ((${c}_flag ? ${readOk} : ${readErr}) != napi_ok)`, `  return ${fail("could not be converted")};`);
      if (okNarrow) lines.push(`if (${c}_flag) ${c}.as.value = ${okNarrow.open}${c}_value_raw${okNarrow.close};`);
      if (errNarrow) lines.push(`if (!${c}_flag) ${c}.as.error = ${errNarrow.open}${c}_error_raw${errNarrow.close};`);
      return lines;
    },
  };
}

/** What one function needs from the shim's shared helpers. */
interface Plan {
  fn: ExternalFunction;
  readers: Reader[];
  box: NonNullable<ReturnType<typeof boxer>>;
  /** Strings or arrays cross: bracket the call with an arena mark/release. */
  scoped: boolean;
}

function plan(fn: ExternalFunction): Plan | undefined {
  const readers: Reader[] = [];
  for (const p of fn.sig.params) {
    const r = reader(p.type, fn.writtenParams.has(p.name));
    if (!r) return undefined;
    readers.push(r);
  }
  const box = boxer(fn.sig.returnType);
  if (!box) return undefined;
  return { fn, readers, box, scoped: box.arena || readers.some((r) => r.arena) };
}

/**
 * Why `plan` refused this function, naming the position and the type that did
 * it. The shim writes this next to the signature instead of dropping the
 * function without a word: an omission a reader cannot see is exactly how the
 * unsigned widths sat unbridged behind a reader table nobody had extended.
 */
const skipReason = (fn: ExternalFunction): string => {
  const { sig } = fn;
  for (let i = 0; i < sig.params.length; i++) {
    const p = sig.params[i];
    if (reader(p.type, fn.writtenParams.has(p.name)) === undefined)
      return `parameter ${i + 1} (${p.name}) is ${tsKeyword(p.type)}`;
  }
  if (boxer(sig.returnType) === undefined) return `it returns ${tsKeyword(sig.returnType)}`;
  // Unreachable while `plan` refuses only for a parameter or the result, and
  // still better than a comment that names nothing if that ever changes.
  return "one of its types does not cross";
};

function wrapper({ fn, readers, box, scoped }: Plan): string[] {
  const { sig } = fn;
  const name = sig.name;
  const n = sig.params.length;
  const fail = (msg: string) => (scoped ? `amrit_napi_fail_at(env, mark, "${msg}")` : `amrit_napi_fail(env, "${msg}")`);
  const lines: string[] = [`static napi_value amrit_napi_${name}(napi_env env, napi_callback_info info) {`];
  if (n === 0) {
    lines.push("  (void)info;");
  } else {
    lines.push(
      `  size_t argc = ${n};`,
      `  napi_value argv[${n}];`,
      "  if (napi_get_cb_info(env, info, &argc, argv, NULL, NULL) != napi_ok)",
      `    return amrit_napi_fail(env, "${name}: cannot read arguments");`,
      `  if (argc < ${n})`,
      `    return amrit_napi_fail(env, "${name} expects ${n} argument${n === 1 ? "" : "s"}");`
    );
    if (readers.some((r) => r.usesTypeof)) lines.push("  napi_valuetype type;");
    if (sig.params.some((p) => needsLossless(p.type))) lines.push("  bool lossless;");
  }
  if (scoped) lines.push("  uint64_t mark = amrit_arena_mark(); /* arena strings/arrays made for this call are released on return */");
  readers.forEach((r, i) => {
    const p = sig.params[i];
    const what = `${name}: argument ${i + 1} (${p.name})`;
    lines.push(...r.lines(cParamName(p.name), i, (msg) => fail(`${what} ${msg}`)).map((l) => `  ${l}`));
  });

  const call = `${cFunctionName(name).ident}(${sig.params.map((p) => cParamName(p.name)).join(", ")})`;
  lines.push("  napi_value out;");
  if (kindOf(sig.returnType) === "void") lines.push(`  ${call};`);
  else lines.push(`  ${cType(sig.returnType, "return")}${cType(sig.returnType, "return")!.endsWith("*") ? "" : " "}result = ${call};`);
  if (box.pre)
    lines.push(
      ...box.pre("result").map((l) => `  ${l}`),
      `    return ${fail(`${name}: cannot create the result`)};`
    );
  lines.push(`  if (${box.call("result")} != napi_ok)`, `    return ${fail(`${name}: cannot create the result`)};`);
  if (scoped) lines.push("  amrit_arena_release(mark);");
  lines.push("  return out;", "}", "");
  return lines;
}

export function generateNapiShim(compilation: Compilation): string {
  const fns = externalFunctions(compilation);
  const plans: Plan[] = [];
  const skipped: string[] = [];
  for (const fn of fns) {
    const source = `${fn.unit.fileName}: ${tsSignature(fn.sig, tsKeyword)}`;
    if (fn.sig.name === "main") {
      skipped.push(`${source} -- not bridged: \`main\` is reserved for a process entry`);
      continue;
    }
    const p = plan(fn);
    if (p) plans.push(p);
    else skipped.push(`${source} -- not bridged: ${skipReason(fn)}`);
  }
  const needs = {
    string: plans.some((p) => p.readers.some((r) => r.jsType === "string")),
    arrayArg: plans.some((p) => p.readers.some((r) => r.jsType.endsWith("Array"))),
    arrayResult: plans.some((p) => typedView(p.fn.sig.returnType) !== undefined),
    scoped: plans.some((p) => p.scoped),
    result: plans.some((p) => p.box.pre !== undefined),
    f32: plans.some((p) => p.readers.some((r) => r.usesF32)),
  };

  const lines: string[] = [
    banner(compilation, "--emit-napi", (t) => `/* ${t}`),
    " *",
    " * Build it into an addon together with the compiled module(s) and the runtime:",
    " *   scripts/build.sh <modules.ll> runtime/runtime.c <this file> -o <name>.node --profile napi",
    " * Then `require(\"./<name>.node\")` (or createRequire in ESM) and call the",
    " * functions below. Numbers convert with ToInt32 (`x | 0`) in i32 mode; typed",
    " * arrays are borrowed for the call (writes through them are visible to JS);",
    " * strings and array results are copied, and the arena is released per call.",
    " */",
    "#include <node_api.h>",
    ...(needs.f32 ? ["#include <math.h>"] : []),
    "#include <stdbool.h>",
    "#include <stddef.h>",
    "#include <stdint.h>",
    ...(needs.arrayResult ? ["#include <string.h>"] : []),
    `#include "${RUNTIME_HEADER}" /* runtime/; the napi profile adds it to the include path */`,
    // WP17: the `Result` types the bridged signatures mention, spelled exactly
    // as --emit-header spells them, since this file declares its own prototypes.
    ...resultDefinitions(plans.map((p) => p.fn)),
    "",
    `/* C ABI of the bridged ${LANGUAGE} functions (identical to --emit-header). */`,
  ];
  for (const p of plans) lines.push(`${cPrototype(p.fn.sig, p.fn.writtenParams)!};`);
  lines.push("");
  // Every external function is either wrapped below or named here with the
  // reason. A function that simply vanished from the addon would be a bug a
  // host could only find by calling it.
  if (skipped.length > 0) {
    lines.push(
      "/* Not bridged, and why. This shim carries numbers (i32, u8, u16, u32, f32,",
      " * f64), booleans, i64 and u64 as bigints, strings, Int32Array /",
      " * Float32Array / Float64Array / BigInt64Array, and a `Result` passed or",
      " * returned by value over those; anything else needs a host that can follow",
      " * an arena pointer, which JavaScript is not. */"
    );
    for (const s of skipped) lines.push(`/* ${s} */`);
    lines.push("");
  }

  if (plans.length > 0) {
    lines.push(
      "/* Throw a TypeError; returning NULL hands `undefined` back while the exception is pending. */",
      "static napi_value amrit_napi_fail(napi_env env, const char *message) {",
      "  napi_throw_type_error(env, NULL, message);",
      "  return NULL;",
      "}",
      ""
    );
  }
  if (needs.scoped) {
    lines.push(
      "/* The same, from a call that already marked the arena: release first. */",
      "static napi_value amrit_napi_fail_at(napi_env env, uint64_t mark, const char *message) {",
      "  amrit_arena_release(mark);",
      "  return amrit_napi_fail(env, message);",
      "}",
      ""
    );
  }
  if (needs.f32) {
    lines.push(
      "/* A JS number as an f32, rounded to nearest as `toF32` rounds it.",
      " * C leaves a double-to-float conversion undefined when the value is out of",
      " * the float range, so the two overflow cases are decided here rather than",
      " * left to the compiler: 0x1.ffffffp127 is the midpoint between FLT_MAX and",
      " * 2^128, and round-to-nearest-even sends everything from there upwards to",
      " * an infinity. NaN and the infinities themselves convert directly. */",
      `static float ${F32_HELPER}(double value) {`,
      "  if (value >= 0x1.ffffffp127) return INFINITY;",
      "  if (value <= -0x1.ffffffp127) return -INFINITY;",
      "  return (float)value;",
      "}",
      ""
    );
  }
  if (needs.string) {
    lines.push(
      "/* A JS string as an arena string: the first call measures, the second copies (NUL included). */",
      "static amrit_str *amrit_napi_string_arg(napi_env env, napi_value value) {",
      "  size_t len;",
      "  if (napi_get_value_string_utf8(env, value, NULL, 0, &len) != napi_ok) return NULL;",
      "  amrit_str *s = (amrit_str *)amrit_alloc_struct(sizeof(uint64_t) + len + 1);",
      "  if (napi_get_value_string_utf8(env, value, s->data, len + 1, &len) != napi_ok) return NULL;",
      "  s->len = len;",
      "  return s;",
      "}",
      ""
    );
  }
  if (needs.arrayArg) {
    lines.push(
      "/* A typed array of the expected kind as a borrowed amrit_array header over its own bytes. */",
      "static bool amrit_napi_array_arg(napi_env env, napi_value value, napi_typedarray_type want, amrit_array *out) {",
      "  bool is_typedarray;",
      "  napi_typedarray_type type;",
      "  size_t len;",
      "  void *data;",
      "  if (napi_is_typedarray(env, value, &is_typedarray) != napi_ok || !is_typedarray) return false;",
      "  if (napi_get_typedarray_info(env, value, &type, &len, &data, NULL, NULL) != napi_ok || type != want) return false;",
      "  out->len = out->cap = len;",
      "  out->data = (char *)data;",
      "  return true;",
      "}",
      ""
    );
  }
  if (needs.arrayResult) {
    lines.push(
      "/* An arena array as a fresh typed array: copied, because the arena is released when the call returns. */",
      "static napi_status amrit_napi_array_result(napi_env env, const amrit_array *a, napi_typedarray_type type, size_t elem_size, napi_value *out) {",
      "  void *data;",
      "  napi_value buffer;",
      "  napi_status status = napi_create_arraybuffer(env, a->len * elem_size, &data, &buffer);",
      "  if (status != napi_ok) return status;",
      "  if (a->len) memcpy(data, a->data, a->len * elem_size);",
      "  return napi_create_typedarray(env, type, a->len, buffer, 0, out);",
      "}",
      ""
    );
  }
  if (needs.result) {
    lines.push(
      "/* WP17: a `Result` as the object JS models it with — `{ ok, value }` or",
      " * `{ ok, error }`. The dead arm is never written, so it is never read. */",
      "static napi_status amrit_napi_result(napi_env env, bool ok, napi_value payload, napi_value *out) {",
      "  napi_value obj, flag;",
      "  napi_status status = napi_create_object(env, &obj);",
      "  if (status != napi_ok) return status;",
      "  status = napi_get_boolean(env, ok, &flag);",
      "  if (status != napi_ok) return status;",
      '  status = napi_set_named_property(env, obj, "ok", flag);',
      "  if (status != napi_ok) return status;",
      '  status = napi_set_named_property(env, obj, ok ? "value" : "error", payload);',
      "  if (status != napi_ok) return status;",
      "  *out = obj;",
      "  return napi_ok;",
      "}",
      ""
    );
  }
  lines.push(
    "static napi_value amrit_napi_undefined(napi_env env) {",
    "  napi_value out;",
    "  return napi_get_undefined(env, &out) == napi_ok ? out : NULL;",
    "}",
    "",
    "/* amrit_reset_arena(): recycle every string/object the module allocated since the last reset. */",
    "static napi_value amrit_napi_reset_arena(napi_env env, napi_callback_info info) {",
    "  (void)info;",
    "  amrit_reset_arena();",
    "  return amrit_napi_undefined(env);",
    "}",
    "",
    "/* amrit_free_arena(): release every arena chunk back to the OS. */",
    "static napi_value amrit_napi_free_arena(napi_env env, napi_callback_info info) {",
    "  (void)info;",
    "  amrit_free_arena();",
    "  return amrit_napi_undefined(env);",
    "}",
    ""
  );
  for (const p of plans) {
    lines.push(`/* ${p.fn.unit.fileName}: ${tsSignature(p.fn.sig, tsKeyword)} */`, ...wrapper(p));
  }

  lines.push(
    "static const struct {",
    "  const char *name;",
    "  napi_callback callback;",
    "} amrit_napi_exports[] = {",
    ...plans.map((p) => `  {"${p.fn.sig.sourceName}", amrit_napi_${p.fn.sig.name}},`),
    '  {"amrit_reset_arena", amrit_napi_reset_arena},',
    '  {"amrit_free_arena", amrit_napi_free_arena},',
    "};",
    "",
    "NAPI_MODULE_INIT() {",
    "  for (size_t i = 0; i < sizeof amrit_napi_exports / sizeof amrit_napi_exports[0]; i++) {",
    "    napi_value fn;",
    "    if (napi_create_function(env, amrit_napi_exports[i].name, NAPI_AUTO_LENGTH, amrit_napi_exports[i].callback, NULL, &fn) != napi_ok ||",
    "        napi_set_named_property(env, exports, amrit_napi_exports[i].name, fn) != napi_ok) {",
    `      napi_throw_error(env, NULL, "${CLI}: cannot register the addon exports");`,
    "      return NULL;",
    "    }",
    "  }",
    "  return exports;",
    "}",
    ""
  );
  return lines.join("\n");
}
