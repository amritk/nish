/**
 * `--emit-napi <shim.c>`: a Node-API (N-API) shim that turns every external
 * function whose types JS can carry into a JS function.
 *
 * The shim is plain C against node_api.h (Node's stable ABI, so the addon
 * survives Node upgrades without a rebuild). Per function it:
 *   1. reads the arguments (`napi_get_cb_info`) and checks the count,
 *   2. type-checks and converts each one:
 *        number   a JS number; ToInt32 semantics in i32 mode (like `x | 0`)
 *        boolean  a JS boolean
 *        i64      a JS bigint (`napi_get_value_bigint_int64`)
 *        string   a JS string, copied into an arena `sts_str`
 *                 (`napi_get_value_string_utf8`, measured first, then copied)
 *        Int32Array / Float64Array / BigInt64Array (i32[] / f64[] / i64[])
 *                 a JS typed array of exactly that kind, *borrowed*: the
 *                 `sts_array` header is built on the C stack over the typed
 *                 array's own bytes (`napi_get_typedarray_info`), so nothing
 *                 is copied and writes through the parameter land in the
 *                 caller's buffer. The callee must not retain the pointer
 *                 beyond the call (the arena does not own it), and a `push`
 *                 that grows the array moves it into the arena, invisibly to JS.
 *   3. calls the StaticTS function through its C ABI,
 *   4. boxes the result: `napi_create_int32` / `napi_create_double` /
 *      `napi_get_boolean` / `napi_create_bigint_int64`, `undefined` for void,
 *      `napi_create_string_utf8` for a string, and a fresh typed array
 *      (`napi_create_arraybuffer` + memcpy + `napi_create_typedarray`) for an
 *      array, so the JS value never aliases the arena.
 * A violated check throws a TypeError naming the function and parameter.
 *
 * Functions that touch the arena (a string or array parameter or result)
 * bracket the call with `sts_arena_mark` / `sts_arena_release`: every arena
 * string or array made for the call is recycled before the wrapper returns,
 * so a host never has to reset the arena for bridged calls. `sts_reset_arena`
 * / `sts_free_arena` are still exported for hosts that want to.
 *
 * Build: scripts/build.sh <modules.ll> runtime/runtime.c <shim.c> -o x.node --profile napi
 */
import { Compilation } from "../compilation";
import { ResultType, StaticType, resultByValue } from "../types";
import {
  banner,
  cFunctionName,
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
}

const SCALAR_READERS: Record<string, { jsType: string; tag: string; getter: string; c: string }> = {
  i32: { jsType: "number", tag: "napi_number", getter: "napi_get_value_int32", c: "int32_t" },
  f64: { jsType: "number", tag: "napi_number", getter: "napi_get_value_double", c: "double" },
  bool: { jsType: "boolean", tag: "napi_boolean", getter: "napi_get_value_bool", c: "bool" },
  i64: { jsType: "bigint", tag: "napi_bigint", getter: "napi_get_value_bigint_int64", c: "int64_t" },
};

function reader(t: StaticType, written: boolean): Reader | undefined {
  const scalar = SCALAR_READERS[kindOf(t)];
  if (scalar) {
    const convert = (c: string, i: number) =>
      kindOf(t) === "i64" ? `${scalar.getter}(env, argv[${i}], &${c}, &lossless)` : `${scalar.getter}(env, argv[${i}], &${c})`;
    return {
      jsType: scalar.jsType,
      usesTypeof: true,
      arena: false,
      lines: (c, i, fail) => [
        `${scalar.c} ${c};`,
        `if (napi_typeof(env, argv[${i}], &type) != napi_ok || type != ${scalar.tag})`,
        `  return ${fail(`must be a ${scalar.jsType}`)};`,
        `if (${convert(c, i)} != napi_ok)`,
        `  return ${fail("could not be converted")};`,
      ],
    };
  }
  if (kindOf(t) === "string") {
    return {
      jsType: "string",
      usesTypeof: true,
      arena: true,
      lines: (c, i, fail) => [
        `const sts_str *${c};`,
        `if (napi_typeof(env, argv[${i}], &type) != napi_ok || type != napi_string)`,
        `  return ${fail("must be a string")};`,
        `if ((${c} = sts_napi_string_arg(env, argv[${i}])) == NULL)`,
        `  return ${fail("could not be converted")};`,
      ],
    };
  }
  const view = typedView(t);
  if (view) {
    return {
      jsType: view.ctor,
      usesTypeof: false,
      arena: true,
      lines: (c, i, fail) => [
        `sts_array ${c}_hdr; /* borrowed: the ${view.ctor}'s own bytes, for this call only */`,
        `if (!sts_napi_array_arg(env, argv[${i}], ${view.napiType}, &${c}_hdr))`,
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
  if (view) return { call: (v) => `sts_napi_array_result(env, ${v}, ${view.napiType}, ${view.elemSize}, &out)`, arena: true };
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
 * selects into `payload`, then wrap it with `sts_napi_result`. `undefined`
 * when either payload has no scalar constructor — the same gap that keeps an
 * unsigned or `f32` parameter out of this shim.
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
    call: (v) => `sts_napi_result(env, ${v}.ok != 0, payload, &out)`,
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

function wrapper({ fn, readers, box, scoped }: Plan): string[] {
  const { sig } = fn;
  const name = sig.name;
  const n = sig.params.length;
  const fail = (msg: string) => (scoped ? `sts_napi_fail_at(env, mark, "${msg}")` : `sts_napi_fail(env, "${msg}")`);
  const lines: string[] = [`static napi_value sts_napi_${name}(napi_env env, napi_callback_info info) {`];
  if (n === 0) {
    lines.push("  (void)info;");
  } else {
    lines.push(
      `  size_t argc = ${n};`,
      `  napi_value argv[${n}];`,
      "  if (napi_get_cb_info(env, info, &argc, argv, NULL, NULL) != napi_ok)",
      `    return sts_napi_fail(env, "${name}: cannot read arguments");`,
      `  if (argc < ${n})`,
      `    return sts_napi_fail(env, "${name} expects ${n} argument${n === 1 ? "" : "s"}");`
    );
    if (readers.some((r) => r.usesTypeof)) lines.push("  napi_valuetype type;");
    if (sig.params.some((p) => kindOf(p.type) === "i64")) lines.push("  bool lossless;");
  }
  if (scoped) lines.push("  uint64_t mark = sts_arena_mark(); /* arena strings/arrays made for this call are released on return */");
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
  if (scoped) lines.push("  sts_arena_release(mark);");
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
    else
      skipped.push(
        `${source} -- not bridged: only numbers, booleans, i64, strings, Int32Array/Float64Array/BigInt64Array and a Result returned by value over those cross this shim`
      );
  }
  const needs = {
    string: plans.some((p) => p.readers.some((r) => r.jsType === "string")),
    arrayArg: plans.some((p) => p.readers.some((r) => r.jsType.endsWith("Array"))),
    arrayResult: plans.some((p) => typedView(p.fn.sig.returnType) !== undefined),
    scoped: plans.some((p) => p.scoped),
    result: plans.some((p) => p.box.pre !== undefined),
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
    "#include <stdbool.h>",
    "#include <stddef.h>",
    "#include <stdint.h>",
    ...(needs.arrayResult ? ["#include <string.h>"] : []),
    '#include "statictsc.h" /* runtime/; the napi profile adds it to the include path */',
    // WP17: the `Result` types the bridged signatures mention, spelled exactly
    // as --emit-header spells them, since this file declares its own prototypes.
    ...resultDefinitions(plans.map((p) => p.fn)),
    "",
    "/* C ABI of the bridged StaticTS functions (identical to --emit-header). */",
  ];
  for (const p of plans) lines.push(`${cPrototype(p.fn.sig, p.fn.writtenParams)!};`);
  lines.push("");
  for (const s of skipped) lines.push(`/* ${s} */`);
  if (skipped.length > 0) lines.push("");

  if (plans.length > 0) {
    lines.push(
      "/* Throw a TypeError; returning NULL hands `undefined` back while the exception is pending. */",
      "static napi_value sts_napi_fail(napi_env env, const char *message) {",
      "  napi_throw_type_error(env, NULL, message);",
      "  return NULL;",
      "}",
      ""
    );
  }
  if (needs.scoped) {
    lines.push(
      "/* The same, from a call that already marked the arena: release first. */",
      "static napi_value sts_napi_fail_at(napi_env env, uint64_t mark, const char *message) {",
      "  sts_arena_release(mark);",
      "  return sts_napi_fail(env, message);",
      "}",
      ""
    );
  }
  if (needs.string) {
    lines.push(
      "/* A JS string as an arena string: the first call measures, the second copies (NUL included). */",
      "static sts_str *sts_napi_string_arg(napi_env env, napi_value value) {",
      "  size_t len;",
      "  if (napi_get_value_string_utf8(env, value, NULL, 0, &len) != napi_ok) return NULL;",
      "  sts_str *s = (sts_str *)sts_alloc_struct(sizeof(uint64_t) + len + 1);",
      "  if (napi_get_value_string_utf8(env, value, s->data, len + 1, &len) != napi_ok) return NULL;",
      "  s->len = len;",
      "  return s;",
      "}",
      ""
    );
  }
  if (needs.arrayArg) {
    lines.push(
      "/* A typed array of the expected kind as a borrowed sts_array header over its own bytes. */",
      "static bool sts_napi_array_arg(napi_env env, napi_value value, napi_typedarray_type want, sts_array *out) {",
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
      "static napi_status sts_napi_array_result(napi_env env, const sts_array *a, napi_typedarray_type type, size_t elem_size, napi_value *out) {",
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
      "static napi_status sts_napi_result(napi_env env, bool ok, napi_value payload, napi_value *out) {",
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
    "static napi_value sts_napi_undefined(napi_env env) {",
    "  napi_value out;",
    "  return napi_get_undefined(env, &out) == napi_ok ? out : NULL;",
    "}",
    "",
    "/* sts_reset_arena(): recycle every string/object the module allocated since the last reset. */",
    "static napi_value sts_napi_reset_arena(napi_env env, napi_callback_info info) {",
    "  (void)info;",
    "  sts_reset_arena();",
    "  return sts_napi_undefined(env);",
    "}",
    "",
    "/* sts_free_arena(): release every arena chunk back to the OS. */",
    "static napi_value sts_napi_free_arena(napi_env env, napi_callback_info info) {",
    "  (void)info;",
    "  sts_free_arena();",
    "  return sts_napi_undefined(env);",
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
    "} sts_napi_exports[] = {",
    ...plans.map((p) => `  {"${p.fn.sig.sourceName}", sts_napi_${p.fn.sig.name}},`),
    '  {"sts_reset_arena", sts_napi_reset_arena},',
    '  {"sts_free_arena", sts_napi_free_arena},',
    "};",
    "",
    "NAPI_MODULE_INIT() {",
    "  for (size_t i = 0; i < sizeof sts_napi_exports / sizeof sts_napi_exports[0]; i++) {",
    "    napi_value fn;",
    "    if (napi_create_function(env, sts_napi_exports[i].name, NAPI_AUTO_LENGTH, sts_napi_exports[i].callback, NULL, &fn) != napi_ok ||",
    "        napi_set_named_property(env, exports, sts_napi_exports[i].name, fn) != napi_ok) {",
    '      napi_throw_error(env, NULL, "statictsc: cannot register the addon exports");',
    "      return NULL;",
    "    }",
    "  }",
    "  return exports;",
    "}",
    ""
  );
  return lines.join("\n");
}
