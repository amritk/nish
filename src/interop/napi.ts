/**
 * `--emit-napi <shim.c>`: a Node-API (N-API) shim that turns every external
 * scalar function into a JS function.
 *
 * The shim is plain C against node_api.h (Node's stable ABI, so the addon
 * survives Node upgrades without a rebuild). Per function it:
 *   1. reads the arguments (`napi_get_cb_info`) and checks the count,
 *   2. type-checks each one (`napi_typeof`): `number` must be a JS number
 *      (converted with ToInt32 semantics in i32 mode, i.e. like `x | 0`),
 *      `boolean` must be a JS boolean,
 *   3. calls the StaticTS function through its C ABI,
 *   4. boxes the result (`napi_create_int32` / `napi_create_double` /
 *      `napi_get_boolean`, or `undefined` for void).
 * A violated check throws a TypeError naming the function and parameter.
 *
 * Functions with string parameters or results are skipped with a comment:
 * marshalling JS strings into arena strings (and deciding who resets the
 * arena) is the buffer-passing design of a later package. The shim always
 * exposes `sts_reset_arena` / `sts_free_arena` so a host can recycle memory
 * that scalar functions allocated internally.
 *
 * Build: scripts/build.sh <modules.ll> runtime/runtime.c <shim.c> -o x.node --profile napi
 */
import { Compilation } from "../compilation";
import { StaticType } from "../types";
import {
  banner,
  cFunctionName,
  cParamName,
  cPrototype,
  cType,
  externalFunctions,
  ExternalFunction,
  isScalar,
  kindOf,
  tsKeyword,
  tsSignature,
} from "./abi";

/** How one scalar type is read from a JS value: the napi_valuetype it must have and the getter. */
function argReader(t: StaticType): { jsType: string; typeTag: string; getter: string } {
  switch (kindOf(t)) {
    case "i32":
      return { jsType: "number", typeTag: "napi_number", getter: "napi_get_value_int32" };
    case "f64":
      return { jsType: "number", typeTag: "napi_number", getter: "napi_get_value_double" };
    case "bool":
      return { jsType: "boolean", typeTag: "napi_boolean", getter: "napi_get_value_bool" };
    default:
      throw new Error(`no N-API reader for type kind ${kindOf(t)}`);
  }
}

function wrapper(fn: ExternalFunction): string[] {
  const { sig } = fn;
  const name = sig.name;
  const n = sig.params.length;
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
      `    return sts_napi_fail(env, "${name} expects ${n} argument${n === 1 ? "" : "s"}");`,
      "  napi_valuetype type;"
    );
  }
  sig.params.forEach((p, i) => {
    const r = argReader(p.type);
    const c = cParamName(p.name);
    lines.push(
      `  ${cType(p.type, "param")} ${c};`,
      `  if (napi_typeof(env, argv[${i}], &type) != napi_ok || type != ${r.typeTag})`,
      `    return sts_napi_fail(env, "${name}: argument ${i + 1} (${p.name}) must be a ${r.jsType}");`,
      `  if (${r.getter}(env, argv[${i}], &${c}) != napi_ok)`,
      `    return sts_napi_fail(env, "${name}: argument ${i + 1} (${p.name}) could not be converted");`
    );
  });

  const call = `${cFunctionName(name).ident}(${sig.params.map((p) => cParamName(p.name)).join(", ")})`;
  const boxers: Record<string, string> = {
    i32: "napi_create_int32",
    f64: "napi_create_double",
    bool: "napi_get_boolean",
  };
  const retKind = kindOf(sig.returnType);
  lines.push("  napi_value out;");
  if (retKind === "void") {
    lines.push(`  ${call};`, "  if (napi_get_undefined(env, &out) != napi_ok)");
  } else {
    lines.push(`  ${cType(sig.returnType, "return")} result = ${call};`, `  if (${boxers[retKind]}(env, result, &out) != napi_ok)`);
  }
  lines.push(`    return sts_napi_fail(env, "${name}: cannot create the result");`, "  return out;", "}", "");
  return lines;
}

export function generateNapiShim(compilation: Compilation): string {
  const fns = externalFunctions(compilation);
  const bridged: ExternalFunction[] = [];
  const skipped: string[] = [];
  for (const fn of fns) {
    const source = `${fn.unit.fileName}: ${tsSignature(fn.sig, tsKeyword)}`;
    if (fn.sig.name === "main") skipped.push(`${source} -- not bridged: \`main\` is reserved for a process entry`);
    else if (!isScalar(fn.sig.returnType) || fn.sig.params.some((p) => !isScalar(p.type)))
      skipped.push(`${source} -- not bridged: string values are not marshalled by this shim`);
    else bridged.push(fn);
  }

  const lines: string[] = [
    banner(compilation, "--emit-napi", (t) => `/* ${t}`),
    " *",
    " * Build it into an addon together with the compiled module(s) and the runtime:",
    " *   scripts/build.sh <modules.ll> runtime/runtime.c <this file> -o <name>.node --profile napi",
    " * Then `require(\"./<name>.node\")` (or createRequire in ESM) and call the",
    " * functions below. Numbers convert with ToInt32 (`x | 0`) in i32 mode.",
    " */",
    "#include <node_api.h>",
    "#include <stdbool.h>",
    "#include <stddef.h>",
    "#include <stdint.h>",
    '#include "statictsc.h" /* runtime/; the napi profile adds it to the include path */',
    "",
    "/* C ABI of the bridged StaticTS functions (identical to --emit-header). */",
  ];
  for (const fn of bridged) lines.push(`${cPrototype(fn.sig)!};`);
  lines.push("");
  for (const s of skipped) lines.push(`/* ${s} */`);
  if (skipped.length) lines.push("");

  if (bridged.length > 0) {
    lines.push(
      "/* Throw a TypeError; returning NULL hands `undefined` back while the exception is pending. */",
      "static napi_value sts_napi_fail(napi_env env, const char *message) {",
      "  napi_throw_type_error(env, NULL, message);",
      "  return NULL;",
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
  for (const fn of bridged) {
    lines.push(`/* ${fn.unit.fileName}: ${tsSignature(fn.sig, tsKeyword)} */`, ...wrapper(fn));
  }

  lines.push(
    "static const struct {",
    "  const char *name;",
    "  napi_callback callback;",
    "} sts_napi_exports[] = {",
    ...bridged.map((fn) => `  {"${fn.sig.sourceName}", sts_napi_${fn.sig.name}},`),
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
