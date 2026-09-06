/**
 * StaticTS runtime ABI as seen from LLVM IR.
 *
 * `runtime/runtime.c` implements these symbols. Everything here is a
 * *contract*: struct layouts and signatures must match the C side exactly.
 *
 * The arena bump allocation fast path is not a call into C at all: it is
 * emitted as an `alwaysinline` IR function that bumps `@sts_arena` directly,
 * so after inlining an allocation is a load, an add, a compare, and a store.
 * Only the overflow path calls `@sts_arena_grow` in runtime.c.
 */

/** Global arena state, must match `struct sts_arena` in runtime.c. */
export const ARENA_TYPE = "%struct.sts_arena = type { i8*, i64, i64, i8* }";
/** Array header (WP4), must match `struct sts_array` in runtime.c: { len, cap, data }. */
export const ARRAY_TYPE = "%struct.sts_array = type { i64, i64, i8* }";

export const ARENA_GLOBAL = "@sts_arena = external global %struct.sts_arena, align 8";
/**
 * `process.argv` (WP7): the `string[]` the entry wrapper builds once with
 * `sts_argv_init(argc, argv)`; every module that reads it loads this global.
 */
export const ARGV_GLOBAL = "@sts_argv = external global %struct.sts_array*, align 8";

export type MemoryEffect = "none" | "read" | "write";

export interface RuntimeFunction {
  name: string;
  /** Full `declare` line, minus the trailing attribute group. */
  signature: string;
  /** Function attributes for the attribute group. */
  attrs: string[];
  /** What calling it does to memory (drives caller purity analysis). */
  effect: MemoryEffect;
  /**
   * An LLVM intrinsic (`llvm.*`) rather than a symbol from runtime.c. Declared
   * only when a module uses it, even under `--runtime-decls`, because the
   * prelude documents the C ABI and intrinsics are not part of it.
   */
  intrinsic?: boolean;
  /** Never returns to the caller (`sts_exit`); callers lose `willreturn`. */
  noreturn?: boolean;
}

const STR = "i8* noundef nonnull readonly align 8";
const STR_NOCAP = `${STR} nocapture`;

/**
 * Pure math intrinsics (WP7). Every one is a total function of its operands
 * with no memory access, so `readnone willreturn` is a fact, not a hope; the
 * attribute groups here match what LLVM itself attaches to these intrinsics
 * (`nocallback nofree nosync nounwind speculatable willreturn memory(none)`)
 * minus the ones this compiler does not emit. `effect: "none"` keeps callers
 * `readnone` through the purity fixpoint in attributes.ts.
 */
const INTRINSIC_ATTRS = ["nounwind", "willreturn", "readnone"];
function intrinsic(name: string, ret: string, params: string): RuntimeFunction {
  return {
    name,
    signature: `declare ${ret} @${name}(${params})`,
    attrs: INTRINSIC_ATTRS,
    effect: "none",
    intrinsic: true,
  };
}

export const RUNTIME_FUNCTIONS: RuntimeFunction[] = [
  {
    name: "sts_arena_grow",
    signature: "declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef)",
    attrs: ["nounwind", "willreturn", "cold", "noinline", "allocsize(0)"],
    effect: "write",
  },
  {
    name: "sts_reset_arena",
    signature: "declare void @sts_reset_arena()",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    name: "sts_free_arena",
    signature: "declare void @sts_free_arena()",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  // ---- WP6: arena scopes. A mark is the absolute bump address (`buf + off`), 0 while the arena is empty.
  {
    name: "sts_arena_mark",
    signature: "declare noundef i64 @sts_arena_mark()",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    // Rewinds to a mark: same chunk -> reset the offset; an older chunk -> free the newer ones first.
    name: "sts_arena_release",
    signature: "declare void @sts_arena_release(i64 noundef)",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    name: "sts_arena_used",
    signature: "declare noundef i64 @sts_arena_used()",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    name: "sts_str_new",
    signature: `declare noalias noundef nonnull align 8 i8* @sts_str_new(i8* noundef readonly nocapture, i64 noundef)`,
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    name: "sts_str_concat",
    signature: `declare noalias noundef nonnull align 8 i8* @sts_str_concat(${STR_NOCAP}, ${STR_NOCAP})`,
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    name: "sts_str_eq",
    signature: `declare zeroext i1 @sts_str_eq(${STR_NOCAP}, ${STR_NOCAP})`,
    attrs: ["nounwind", "willreturn", "memory(argmem: read)"],
    effect: "read",
  },
  {
    name: "sts_str_len",
    signature: `declare i64 @sts_str_len(${STR_NOCAP})`,
    attrs: ["nounwind", "willreturn", "memory(argmem: read)"],
    effect: "read",
  },
  {
    name: "sts_print",
    signature: `declare void @sts_print(${STR_NOCAP})`,
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    name: "sts_str_from_i32",
    signature: "declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef)",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    name: "sts_str_from_f64",
    signature: "declare noalias noundef nonnull align 8 i8* @sts_str_from_f64(double noundef)",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  // ---- WP7: i64 strings, Math.random, process, files --------------------------
  {
    name: "sts_str_from_i64",
    signature: "declare noalias noundef nonnull align 8 i8* @sts_str_from_i64(i64 noundef)",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    // WP15: the one unsigned formatter. `u8`/`u16`/`u32` are `zext`ed to i64 at
    // the call site rather than getting three more symbols of their own, which
    // is what keeps `runtime.c` inside its `.text` budget.
    name: "sts_str_from_u64",
    signature: "declare noalias noundef nonnull align 8 i8* @sts_str_from_u64(i64 noundef)",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    // xorshift64* over a global state word: reads and writes memory.
    name: "sts_random",
    signature: "declare noundef double @sts_random()",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    name: "sts_exit",
    signature: "declare void @sts_exit(i32 noundef)",
    attrs: ["noreturn", "nounwind"],
    effect: "write",
    noreturn: true,
  },
  {
    name: "sts_read_file",
    signature: `declare noalias noundef nonnull align 8 i8* @sts_read_file(${STR_NOCAP})`,
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    name: "sts_write_file",
    signature: `declare void @sts_write_file(${STR_NOCAP}, ${STR_NOCAP})`,
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    name: "sts_append_file",
    signature: `declare void @sts_append_file(${STR_NOCAP}, ${STR_NOCAP})`,
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  // ---- WP7: process.argv and string-to-number parsing -------------------------
  {
    // Called once by the entry wrapper: mallocs the array and copies every argument.
    name: "sts_argv_init",
    signature: "declare void @sts_argv_init(i32 noundef, i8** noundef nocapture readonly)",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    // mode 0 parseFloat, 1 Number, 2 parseInt (as a double; the caller saturates it).
    // The string is only read and never retained (`readonly nocapture`), but the
    // function itself is not `readonly`: strtod/strtoll may store errno on overflow.
    name: "sts_parse_number",
    signature: `declare noundef double @sts_parse_number(${STR_NOCAP}, i32 noundef)`,
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  // ---- WP4: arrays --------------------------------------------------------
  {
    name: "sts_array_grow",
    // Doubles `cap` (4 when 0), moves the elements into fresh arena storage; `len` is untouched.
    signature: "declare void @sts_array_grow(%struct.sts_array* noundef nonnull align 8 nocapture, i64 noundef)",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    // Host entry (WP8): header + `len` uninitialised elements, `len == cap`. Compiled code
    // never calls it (literals and `new Array` use the inline allocator); the wasm loader and
    // C hosts do, so it is part of the declared ABI and of statictsc.h.
    name: "sts_alloc_array",
    signature: "declare noalias noundef nonnull align 8 %struct.sts_array* @sts_alloc_array(i64 noundef, i64 noundef)",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    name: "sts_panic_index",
    // Bounds-check failure: prints "index out of range: <idx> >= <len>" and exits 1.
    signature: "declare void @sts_panic_index(i64 noundef, i64 noundef)",
    attrs: ["nounwind", "noreturn", "cold"],
    effect: "write",
    noreturn: true,
  },
  // ---- Checked integer division and ECMAScript pow ----------------------------
  {
    name: "sts_panic_div",
    // Division failure: "attempt to divide by zero" (true) or "... with overflow" (false), exit 1.
    signature: "declare void @sts_panic_div(i1 noundef zeroext)",
    attrs: ["nounwind", "noreturn", "cold"],
    effect: "write",
    noreturn: true,
  },
  // ---- WP7: LLVM intrinsics behind Math.* and the numeric conversions ----------
  ...["sqrt", "floor", "ceil", "trunc", "sin", "cos", "exp", "log", "fabs"].map((f) =>
    intrinsic(`llvm.${f}.f64`, "double", "double")
  ),
  ...["pow", "minnum", "maxnum"].map((f) => intrinsic(`llvm.${f}.f64`, "double", "double, double")),
  ...["i32", "i64"].flatMap((t) => [
    intrinsic(`llvm.abs.${t}`, t, `${t}, i1`),
    intrinsic(`llvm.smin.${t}`, t, `${t}, ${t}`),
    intrinsic(`llvm.smax.${t}`, t, `${t}, ${t}`),
    intrinsic(`llvm.fptosi.sat.${t}.f64`, t, "double"),
  ]),
  // ---- WP15: the unsigned halves of the same intrinsics. `u8`/`u16` lower to
  // `i8`/`i16`, so the narrow widths appear here and nowhere else.
  ...["i8", "i16", "i32", "i64"].flatMap((t) => [
    intrinsic(`llvm.umin.${t}`, t, `${t}, ${t}`),
    intrinsic(`llvm.umax.${t}`, t, `${t}, ${t}`),
    intrinsic(`llvm.fptoui.sat.${t}.f64`, t, "double"),
  ]),
];

export const RUNTIME_BY_NAME = new Map(RUNTIME_FUNCTIONS.map((f) => [f.name, f]));

/**
 * The inline bump allocator. `size` is rounded up to 8 bytes so every object
 * (and therefore every field of every struct) is 8-byte aligned.
 */
export function inlineAllocator(attrGroup: string): string {
  return `define internal noalias noundef nonnull align 8 i8* @sts_alloc_struct(i64 noundef %size) ${attrGroup} {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @sts_arena_grow(i64 %size.aligned)
  ret i8* %grown
}`;
}

export const INLINE_ALLOCATOR_ATTRS = ["alwaysinline", "nounwind", "willreturn", "allocsize(0)"];
