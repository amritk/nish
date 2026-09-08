// The runtime ABI as seen from LLVM IR, for stage1
// (`src/codegen/runtime.ts`, docs/wp14-selfhost.md milestone S4).
//
// `runtime/runtime.c` implements these symbols. Everything here is a
// *contract*: the struct layouts and signatures must match the C side exactly,
// and the order of `RuntimeTable.functions` is the order the prelude declares
// them in, so it is the order `src/codegen/runtime.ts` lists them in and not a
// convenient one.
//
// The arena bump allocation fast path is not a call into C at all: it is
// emitted as an `alwaysinline` IR function that bumps `@sts_arena` directly,
// so after inlining an allocation is a load, an add, a compare and a store.
// Only the overflow path calls `@sts_arena_grow` in runtime.c.
//
// `src/` keeps the table as an array of object literals and a `Map` beside it.
// Here it is a class built once per compilation: the same array, with a
// `StringMap` from symbol to index so the attribute fixpoint can ask about a
// callee by name.

import { StringMap } from "./map";

/** Global arena state; must match `struct sts_arena` in runtime.c. */
export const ARENA_TYPE: string = "%struct.sts_arena = type { i8*, i64, i64, i8* }";
/** Array header (WP4); must match `struct sts_array` in runtime.c: { len, cap, data }. */
export const ARRAY_TYPE: string = "%struct.sts_array = type { i64, i64, i8* }";

export const ARENA_GLOBAL: string = "@sts_arena = external global %struct.sts_arena, align 8";
/**
 * `process.argv` (WP7): the `string[]` the entry wrapper builds once with
 * `sts_argv_init(argc, argv)`; every module that reads it loads this global.
 */
export const ARGV_GLOBAL: string = "@sts_argv = external global %struct.sts_array*, align 8";

/** What calling a function does to memory; the rank is the order they merge in. */
export const EFFECT_NONE: i32 = 0;
export const EFFECT_READ: i32 = 1;
export const EFFECT_WRITE: i32 = 2;

/** The more impure of two effects, which is how a caller inherits its callees'. */
export function maxEffect(a: i32, b: i32): i32 {
  return a >= b ? a : b;
}

export class RuntimeFunction {
  name: string;
  /** The full `declare` line, minus the trailing attribute group. */
  signature: string;
  /** Function attributes for the attribute group. */
  attrs: string[];
  effect: i32;
  /**
   * An LLVM intrinsic (`llvm.*`) rather than a symbol from runtime.c. Declared
   * only when a module uses it, even under `--runtime-decls`, because the
   * prelude documents the C ABI and intrinsics are not part of it.
   */
  intrinsic: boolean;
  /** Never returns to the caller (`sts_exit`); callers lose `willreturn`. */
  noreturn: boolean;

  constructor(name: string, signature: string, attrs: string[], effect: i32) {
    this.name = name;
    this.signature = signature;
    this.attrs = attrs;
    this.effect = effect;
    this.intrinsic = false;
    this.noreturn = false;
  }
}

const STR: string = "i8* noundef nonnull readonly align 8";
const STR_NOCAP: string = "i8* noundef nonnull readonly align 8 nocapture";

function attrs2(a: string, b: string): string[] {
  const out: string[] = [];
  out.push(a);
  out.push(b);
  return out;
}

function attrs3(a: string, b: string, c: string): string[] {
  const out = attrs2(a, b);
  out.push(c);
  return out;
}

/**
 * A pure math intrinsic (WP7). Every one is a total function of its operands
 * with no memory access, so `readnone willreturn` is a fact rather than a
 * hope, and `EFFECT_NONE` keeps callers `readnone` through the fixpoint.
 */
function intrinsic(name: string, ret: string, params: string): RuntimeFunction {
  const fn = new RuntimeFunction(
    name,
    `declare ${ret} @${name}(${params})`,
    attrs3("nounwind", "willreturn", "readnone"),
    EFFECT_NONE
  );
  fn.intrinsic = true;
  return fn;
}

/** `nounwind willreturn`, which is what almost every runtime symbol carries. */
function plain(name: string, signature: string, effect: i32): RuntimeFunction {
  return new RuntimeFunction(name, signature, attrs2("nounwind", "willreturn"), effect);
}

/**
 * The runtime ABI as one ordered table, with a name index beside it.
 *
 * Built once per compilation rather than being a module constant, because a
 * module constant is a scalar or a string; the cost is one pass over
 * seventy entries at start-up, which does not appear in a profile.
 */
export class RuntimeTable {
  functions: RuntimeFunction[];
  index: StringMap;

  constructor() {
    this.functions = [];
    this.index = new StringMap();
    this.build();
  }

  add(fn: RuntimeFunction): void {
    this.index.set(fn.name, this.functions.length);
    this.functions.push(fn);
  }

  /** The entry for `name`, or `null` when it is not a runtime symbol. */
  lookup(name: string): RuntimeFunction | null {
    const at = this.index.get(name, -1);
    return at < 0 ? null : this.functions[at];
  }

  /** One `llvm.<op>.<type>` family member per type, in the order `src/` builds them. */
  addIntrinsic(name: string, ret: string, params: string): void {
    this.add(intrinsic(name, ret, params));
  }

  build(): void {
    const grow = new RuntimeFunction(
      "sts_arena_grow",
      "declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef)",
      ["nounwind", "willreturn", "cold", "noinline", "allocsize(0)"],
      EFFECT_WRITE
    );
    this.add(grow);
    this.add(plain("sts_reset_arena", "declare void @sts_reset_arena()", EFFECT_WRITE));
    this.add(plain("sts_free_arena", "declare void @sts_free_arena()", EFFECT_WRITE));
    // WP6, arena scopes. A mark is the absolute bump address (`buf + off`), 0 while the arena is empty.
    this.add(plain("sts_arena_mark", "declare noundef i64 @sts_arena_mark()", EFFECT_WRITE));
    // Rewinds to a mark: same chunk -> reset the offset; an older chunk -> free the newer ones first.
    this.add(plain("sts_arena_release", "declare void @sts_arena_release(i64 noundef)", EFFECT_WRITE));
    this.add(plain("sts_arena_used", "declare noundef i64 @sts_arena_used()", EFFECT_WRITE));
    this.add(
      plain(
        "sts_str_new",
        "declare noalias noundef nonnull align 8 i8* @sts_str_new(i8* noundef readonly nocapture, i64 noundef)",
        EFFECT_WRITE
      )
    );
    this.add(
      plain(
        "sts_str_concat",
        `declare noalias noundef nonnull align 8 i8* @sts_str_concat(${STR_NOCAP}, ${STR_NOCAP})`,
        EFFECT_WRITE
      )
    );
    this.add(
      new RuntimeFunction(
        "sts_str_eq",
        `declare zeroext i1 @sts_str_eq(${STR_NOCAP}, ${STR_NOCAP})`,
        attrs3("nounwind", "willreturn", "memory(argmem: read)"),
        EFFECT_READ
      )
    );
    this.add(
      new RuntimeFunction(
        "sts_str_at",
        `declare zeroext i1 @sts_str_at(${STR_NOCAP}, i64 noundef, ${STR_NOCAP})`,
        attrs3("nounwind", "willreturn", "memory(argmem: read)"),
        EFFECT_READ
      )
    );
    this.add(
      new RuntimeFunction(
        "sts_str_len",
        `declare i64 @sts_str_len(${STR_NOCAP})`,
        attrs3("nounwind", "willreturn", "memory(argmem: read)"),
        EFFECT_READ
      )
    );
    this.add(
      plain("sts_write", `declare void @sts_write(${STR_NOCAP}, i32 noundef, i1 noundef zeroext)`, EFFECT_WRITE)
    );
    this.add(plain("sts_print", `declare void @sts_print(${STR_NOCAP})`, EFFECT_WRITE));
    this.add(
      plain(
        "sts_str_from_i32",
        "declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef)",
        EFFECT_WRITE
      )
    );
    this.add(
      plain(
        "sts_str_from_f64",
        "declare noalias noundef nonnull align 8 i8* @sts_str_from_f64(double noundef)",
        EFFECT_WRITE
      )
    );
    // WP7: i64 strings, Math.random, process, files.
    this.add(
      plain(
        "sts_str_from_i64",
        "declare noalias noundef nonnull align 8 i8* @sts_str_from_i64(i64 noundef)",
        EFFECT_WRITE
      )
    );
    // WP15: the one unsigned formatter. `u8`/`u16`/`u32` are `zext`ed to i64 at
    // the call site rather than getting three more symbols of their own, which
    // is what keeps `runtime.c` inside its `.text` budget.
    this.add(
      plain(
        "sts_str_from_u64",
        "declare noalias noundef nonnull align 8 i8* @sts_str_from_u64(i64 noundef)",
        EFFECT_WRITE
      )
    );
    // xorshift64* over a global state word: reads and writes memory.
    this.add(plain("sts_random", "declare noundef double @sts_random()", EFFECT_WRITE));
    const exit = new RuntimeFunction(
      "sts_exit",
      "declare void @sts_exit(i32 noundef)",
      attrs2("noreturn", "nounwind"),
      EFFECT_WRITE
    );
    exit.noreturn = true;
    this.add(exit);
    this.add(
      plain(
        "sts_read_file",
        `declare noalias noundef nonnull align 8 i8* @sts_read_file(${STR_NOCAP})`,
        EFFECT_WRITE
      )
    );
    this.add(
      plain(
        "sts_read_file_or_null",
        `declare noalias noundef align 8 i8* @sts_read_file_or_null(${STR_NOCAP})`,
        EFFECT_WRITE
      )
    );
    this.add(plain("sts_write_file", `declare void @sts_write_file(${STR_NOCAP}, ${STR_NOCAP})`, EFFECT_WRITE));
    this.add(plain("sts_append_file", `declare void @sts_append_file(${STR_NOCAP}, ${STR_NOCAP})`, EFFECT_WRITE));
    // WP7: process.argv and string-to-number parsing.
    // Called once by the entry wrapper: mallocs the array and copies every argument.
    this.add(
      plain("sts_argv_init", "declare void @sts_argv_init(i32 noundef, i8** noundef nocapture readonly)", EFFECT_WRITE)
    );
    // mode 0 parseFloat, 1 Number, 2 parseInt (as a double; the caller saturates it).
    // The string is only read and never retained (`readonly nocapture`), but the
    // function itself is not `readonly`: strtod/strtoll may store errno on overflow.
    this.add(
      plain("sts_parse_number", `declare noundef double @sts_parse_number(${STR_NOCAP}, i32 noundef)`, EFFECT_WRITE)
    );
    // WP4: arrays. `sts_array_grow` doubles `cap` (4 when 0) and moves the
    // elements into fresh arena storage; `len` is untouched.
    this.add(
      plain(
        "sts_array_grow",
        "declare void @sts_array_grow(%struct.sts_array* noundef nonnull align 8 nocapture, i64 noundef)",
        EFFECT_WRITE
      )
    );
    // Host entry (WP8): header + `len` uninitialised elements, `len == cap`. Compiled code
    // never calls it (literals and `new Array` use the inline allocator); the wasm loader and
    // C hosts do, so it is part of the declared ABI and of amritc.h.
    this.add(
      plain(
        "sts_alloc_array",
        "declare noalias noundef nonnull align 8 %struct.sts_array* @sts_alloc_array(i64 noundef, i64 noundef)",
        EFFECT_WRITE
      )
    );
    // Bounds-check failure: prints "index out of range: <idx> >= <len>" and exits 1.
    const panicIndex = new RuntimeFunction(
      "sts_panic_index",
      "declare void @sts_panic_index(i64 noundef, i64 noundef)",
      attrs3("nounwind", "noreturn", "cold"),
      EFFECT_WRITE
    );
    panicIndex.noreturn = true;
    this.add(panicIndex);
    // Division failure: "attempt to divide by zero" (true) or "... with overflow" (false), exit 1.
    const panicDiv = new RuntimeFunction(
      "sts_panic_div",
      "declare void @sts_panic_div(i1 noundef zeroext)",
      attrs3("nounwind", "noreturn", "cold"),
      EFFECT_WRITE
    );
    panicDiv.noreturn = true;
    this.add(panicDiv);
    this.buildIntrinsics();
  }

  /** WP7 and WP15: the LLVM intrinsics behind `Math.*` and the numeric conversions. */
  buildIntrinsics(): void {
    const unary: string[] = ["sqrt", "floor", "ceil", "trunc", "sin", "cos", "exp", "log", "fabs"];
    for (const f of unary) {
      this.addIntrinsic(`llvm.${f}.f64`, "double", "double");
    }
    const binary: string[] = ["pow", "minnum", "maxnum"];
    for (const f of binary) {
      this.addIntrinsic(`llvm.${f}.f64`, "double", "double, double");
    }
    const signed: string[] = ["i32", "i64"];
    for (const t of signed) {
      this.addIntrinsic(`llvm.abs.${t}`, t, `${t}, i1`);
      this.addIntrinsic(`llvm.smin.${t}`, t, `${t}, ${t}`);
      this.addIntrinsic(`llvm.smax.${t}`, t, `${t}, ${t}`);
      this.addIntrinsic(`llvm.fptosi.sat.${t}.f64`, t, "double");
    }
    // WP15: the unsigned halves of the same intrinsics. `u8`/`u16` lower to
    // `i8`/`i16`, so the narrow widths appear here and nowhere else.
    const widths: string[] = ["i8", "i16", "i32", "i64"];
    for (const t of widths) {
      this.addIntrinsic(`llvm.umin.${t}`, t, `${t}, ${t}`);
      this.addIntrinsic(`llvm.umax.${t}`, t, `${t}, ${t}`);
      this.addIntrinsic(`llvm.fptoui.sat.${t}.f64`, t, "double");
      // The f32 saturating conversions; the `.f32` suffix is the *source* type.
      this.addIntrinsic(`llvm.fptosi.sat.${t}.f32`, t, "float");
      this.addIntrinsic(`llvm.fptoui.sat.${t}.f32`, t, "float");
    }
    // WP15: `Math.abs`/`min`/`max` on an `f32`. The f64-only Math functions
    // (sqrt, pow, ...) stay f64-only, so there is no `llvm.sqrt.f32` here.
    this.addIntrinsic("llvm.fabs.f32", "float", "float");
    this.addIntrinsic("llvm.minnum.f32", "float", "float, float");
    this.addIntrinsic("llvm.maxnum.f32", "float", "float, float");
  }
}

export function inlineAllocatorAttrs(): string[] {
  const out: string[] = [];
  out.push("alwaysinline");
  out.push("nounwind");
  out.push("willreturn");
  out.push("allocsize(0)");
  return out;
}

/**
 * The inline bump allocator. `size` is rounded up to 8 bytes so every object
 * (and therefore every field of every struct) is 8-byte aligned.
 */
export function inlineAllocator(attrGroup: string): string {
  const lines: string[] = [];
  lines.push(`define internal noalias noundef nonnull align 8 i8* @sts_alloc_struct(i64 noundef %size) ${attrGroup} {`);
  lines.push("entry:");
  lines.push("  %size.p7 = add i64 %size, 7");
  lines.push("  %size.aligned = and i64 %size.p7, -8");
  lines.push("  %off.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 1");
  lines.push("  %off = load i64, i64* %off.ptr, align 8");
  lines.push("  %new.off = add i64 %off, %size.aligned");
  lines.push("  %cap.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 2");
  lines.push("  %cap = load i64, i64* %cap.ptr, align 8");
  lines.push("  %fits = icmp ule i64 %new.off, %cap");
  lines.push("  br i1 %fits, label %fast, label %slow");
  lines.push("");
  lines.push("fast:");
  lines.push("  store i64 %new.off, i64* %off.ptr, align 8");
  lines.push("  %buf.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 0");
  lines.push("  %buf = load i8*, i8** %buf.ptr, align 8");
  lines.push("  %obj = getelementptr inbounds i8, i8* %buf, i64 %off");
  lines.push("  ret i8* %obj");
  lines.push("");
  lines.push("slow:");
  lines.push("  %grown = call i8* @sts_arena_grow(i64 %size.aligned)");
  lines.push("  ret i8* %grown");
  lines.push("}");
  return lines.join("\n");
}
