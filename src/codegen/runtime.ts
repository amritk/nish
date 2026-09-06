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
export const ARENA_GLOBAL = "@sts_arena = external global %struct.sts_arena, align 8";
/** Array header (WP4), must match `struct sts_array` in runtime.c: { len, cap, data }. */
export const ARRAY_TYPE = "%struct.sts_array = type { i64, i64, i8* }";

export type MemoryEffect = "none" | "read" | "write";

export interface RuntimeFunction {
  name: string;
  /** Full `declare` line, minus the trailing attribute group. */
  signature: string;
  /** Function attributes for the attribute group. */
  attrs: string[];
  /** What calling it does to memory (drives caller purity analysis). */
  effect: MemoryEffect;
}

const STR = "i8* noundef nonnull readonly align 8";
const STR_NOCAP = `${STR} nocapture`;

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
  // ---- WP4: arrays --------------------------------------------------------
  {
    name: "sts_array_grow",
    // Doubles `cap` (4 when 0), moves the elements into fresh arena storage; `len` is untouched.
    signature: "declare void @sts_array_grow(%struct.sts_array* noundef nonnull align 8 nocapture, i64 noundef)",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    name: "sts_panic_index",
    // Bounds-check failure: prints "index out of range: <idx> >= <len>" and exits 1.
    signature: "declare void @sts_panic_index(i64 noundef, i64 noundef)",
    attrs: ["nounwind", "noreturn", "cold"],
    effect: "write",
  },
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
