/**
 * The runtime ABI as seen from LLVM IR.
 *
 * `runtime/runtime.c` implements these symbols. Everything here is a
 * *contract*: struct layouts and signatures must match the C side exactly.
 *
 * The arena bump allocation fast path is not a call into C at all: it is
 * emitted as an `alwaysinline` IR function that bumps `@nish_arena` directly,
 * so after inlining an allocation is a load, an add, a compare, and a store.
 * Only the overflow path calls `@nish_arena_grow` in runtime.c.
 *
 * That is also why threads are a codegen question rather than a runtime one
 * (WP20 §3.1): two threads bumping one arena race in the *emitted IR*, not in
 * `runtime.c`. `--threads` answers it by declaring `@nish_arena` thread-local
 * (`ARENA_GLOBAL_TLS`); the allocator body does not change.
 */

/** Global arena state, must match `struct nish_arena` in runtime.c. */
export const ARENA_TYPE = "%struct.nish_arena = type { i8*, i64, i64, i8* }";
/** Array header (WP4), must match `struct nish_array` in runtime.c: { len, cap, data }. */
export const ARRAY_TYPE = "%struct.nish_array = type { i64, i64, i8* }";

export const ARENA_GLOBAL = "@nish_arena = external global %struct.nish_arena, align 8";
/**
 * The same global under `--threads` (WP20 T0): one arena per thread instead of
 * one per process. Only the storage class moves — the allocator below GEPs the
 * declaration it is given, and LLVM turns each of its three field accesses into
 * a thread-pointer-relative one — so a thread-local build differs from an
 * ordinary one by exactly this line.
 *
 * `initialexec` rather than the default general-dynamic model is the whole
 * reason the fast path stays a fast path. General dynamic lowers an access to a
 * `__tls_get_addr` call whenever the module is built `-fPIC`, which is a call
 * *inside* the inlined bump allocator; initial-exec is one load of the offset
 * from the GOT and then `%fs`-relative addressing, which is what
 * `clang -Oz` gives the C copy of the same code. The cost of naming the model
 * is that a build which `dlopen`s compiled Nish after start-up spends from
 * glibc's static TLS surplus; 40 bytes of arena and seed is well inside it, and
 * the `napi` profile — the one host that dlopens — is the case WP24 §5.1 wants
 * this for.
 */
export const ARENA_GLOBAL_TLS =
  "@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8";
/**
 * `process.argv` (WP7): the `string[]` the entry wrapper builds once with
 * `nish_argv_init(argc, argv)`; every module that reads it loads this global.
 */
export const ARGV_GLOBAL = "@nish_argv = external global %struct.nish_array*, align 8";

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
  /** Never returns to the caller (`nish_exit`); callers lose `willreturn`. */
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
    name: "nish_arena_grow",
    signature: "declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef)",
    attrs: ["nounwind", "willreturn", "cold", "noinline", "allocsize(0)"],
    effect: "write",
  },
  {
    name: "nish_reset_arena",
    signature: "declare void @nish_reset_arena()",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    name: "nish_free_arena",
    signature: "declare void @nish_free_arena()",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  // ---- WP6: arena scopes. A mark is the absolute bump address (`buf + off`), 0 while the arena is empty.
  {
    name: "nish_arena_mark",
    signature: "declare noundef i64 @nish_arena_mark()",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    // Rewinds to a mark: same chunk -> reset the offset; an older chunk -> free the newer ones first.
    name: "nish_arena_release",
    signature: "declare void @nish_arena_release(i64 noundef)",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    name: "nish_arena_used",
    signature: "declare noundef i64 @nish_arena_used()",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    // WP9 call-site reclaim: rewinds to a mark while keeping the newest block,
    // which it moves down to the mark and answers at its new address. Neither
    // `noalias` nor `nocapture` is claimed: the guards in runtime.c answer the
    // argument itself whenever the move cannot be proved safe, and a returned
    // pointer is a captured one. The chunk walk is over a finite acyclic list,
    // so `willreturn` holds.
    name: "nish_arena_keep",
    signature:
      "declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8)",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    name: "nish_str_new",
    signature: `declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef)`,
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    name: "nish_str_concat",
    signature: `declare noalias noundef nonnull align 8 i8* @nish_str_concat(${STR_NOCAP}, ${STR_NOCAP})`,
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    name: "nish_str_eq",
    signature: `declare zeroext i1 @nish_str_eq(${STR_NOCAP}, ${STR_NOCAP})`,
    attrs: ["nounwind", "willreturn", "memory(argmem: read)"],
    effect: "read",
  },
  {
    name: "nish_str_at",
    signature: `declare zeroext i1 @nish_str_at(${STR_NOCAP}, i64 noundef, ${STR_NOCAP})`,
    attrs: ["nounwind", "willreturn", "memory(argmem: read)"],
    effect: "read",
  },
  {
    name: "nish_str_index_of",
    signature: `declare i64 @nish_str_index_of(${STR_NOCAP}, ${STR_NOCAP})`,
    attrs: ["nounwind", "willreturn", "memory(argmem: read)"],
    effect: "read",
  },
  {
    name: "nish_str_len",
    signature: `declare i64 @nish_str_len(${STR_NOCAP})`,
    attrs: ["nounwind", "willreturn", "memory(argmem: read)"],
    effect: "read",
  },
  {
    name: "nish_write",
    signature: `declare void @nish_write(${STR_NOCAP}, i32 noundef, i1 noundef zeroext)`,
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    name: "nish_print",
    signature: `declare void @nish_print(${STR_NOCAP})`,
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    name: "nish_str_from_i32",
    signature: "declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef)",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    name: "nish_str_from_f64",
    signature: "declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef)",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  // ---- WP7: i64 strings, Math.random, process, files --------------------------
  {
    name: "nish_str_from_i64",
    signature: "declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef)",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    // WP15: the one unsigned formatter. `u8`/`u16`/`u32` are `zext`ed to i64 at
    // the call site rather than getting three more symbols of their own, which
    // is what keeps `runtime.c` inside its `.text` budget.
    name: "nish_str_from_u64",
    signature: "declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef)",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    // xorshift64* over a global state word: reads and writes memory.
    name: "nish_random",
    signature: "declare noundef double @nish_random()",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    name: "nish_exit",
    signature: "declare void @nish_exit(i32 noundef)",
    attrs: ["noreturn", "nounwind"],
    effect: "write",
    noreturn: true,
  },
  {
    name: "nish_read_file",
    signature: `declare noalias noundef nonnull align 8 i8* @nish_read_file(${STR_NOCAP})`,
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    name: "nish_read_file_or_null",
    signature: `declare noalias noundef align 8 i8* @nish_read_file_or_null(${STR_NOCAP})`,
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    name: "nish_write_file",
    signature: `declare void @nish_write_file(${STR_NOCAP}, ${STR_NOCAP})`,
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    name: "nish_append_file",
    signature: `declare void @nish_append_file(${STR_NOCAP}, ${STR_NOCAP})`,
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  // ---- WP7: process.argv and string-to-number parsing -------------------------
  {
    // Called once by the entry wrapper: mallocs the array and copies every argument.
    name: "nish_argv_init",
    signature: "declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly)",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    // mode 0 parseFloat, 1 Number, 2 parseInt (as a double; the caller saturates it).
    // The string is only read and never retained (`readonly nocapture`), but the
    // function itself is not `readonly`: strtod/strtoll may store errno on overflow.
    name: "nish_parse_number",
    signature: `declare noundef double @nish_parse_number(${STR_NOCAP}, i32 noundef)`,
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  // ---- WP14 D4: the directory and subprocess calls a self-hosted driver needs
  // to link its own output, and the WP14 §7a `stat` beside them. Each answers a
  // value rather than exiting.
  {
    // `mkdir`, then `nish_is_dir` when it failed: it changes the file system,
    // so `write`, and the path is only read and never retained (`STR_NOCAP`).
    name: "nish_mkdir",
    signature: `declare zeroext i1 @nish_mkdir(${STR_NOCAP})`,
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    // WP14 §7a. One `stat`, answering only "is there a directory here?", which
    // is the question `-o <dir>` asks. `effect: "write"` rather than "read"
    // for the reason `nish_parse_number` is not readonly: a failed `stat`
    // stores `errno`, and the file system is not memory LLVM may reason about,
    // so a caller must not be hoisted across anything that could change it.
    // The path is read and never retained (`STR_NOCAP`).
    name: "nish_is_dir",
    signature: `declare zeroext i1 @nish_is_dir(${STR_NOCAP})`,
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    // Runs an arbitrary program, so the honest answer to every question is the
    // conservative one:
    //   - no `memory(...)` and `effect: "write"`: the child reads and writes
    //     files, the terminal and anything else it likes, and the caller must
    //     not be hoisted across that;
    //   - no `nocapture` on the vector: the runtime copies each element's bytes
    //     pointer into an arena block that outlives the call, which is a
    //     capture (`classifyUse` in attributes.ts says the same on the checker
    //     side, so a parameter handed to `spawnSync` never gets `nocapture`);
    //   - no `willreturn`: the child may never exit, and `waitpid` waits.
    // `nounwind` is still a fact: the language has no exceptions and neither
    // does the C that implements this.
    name: "nish_spawn",
    signature: "declare noundef i32 @nish_spawn(%struct.nish_array* noundef nonnull align 8)",
    attrs: ["nounwind"],
    effect: "write",
  },
  {
    // `nish_spawn` with one or both of the child's streams pointed at a file,
    // and therefore the same conservative answers: the child still runs
    // arbitrary code, the vector is still captured, and `waitpid` still waits.
    // The two paths are read and never retained (`STR_NOCAP`); an empty one
    // means "inherit that stream", which is a value and not a null, so both
    // stay `nonnull`.
    name: "nish_spawn_to",
    signature: `declare noundef i32 @nish_spawn_to(%struct.nish_array* noundef nonnull align 8, ${STR_NOCAP}, ${STR_NOCAP})`,
    attrs: ["nounwind"],
    effect: "write",
  },
  {
    // A fresh `string[]` per call, so `noalias`, and null when the directory
    // cannot be read, so no `nonnull`. `effect: "write"` because it allocates
    // (the arena moves) and because the directory is not memory LLVM tracks:
    // two listings either side of a `mkdirSync` must not fold into one.
    // `willreturn` is a fact rather than a hope: the loop runs once per entry
    // and a directory has finitely many. The path is read and never retained.
    name: "nish_readdir",
    signature: `declare noalias align 8 %struct.nish_array* @nish_readdir(${STR_NOCAP})`,
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    // The clock is not memory either, and that is the whole reason this is not
    // `readnone`: two reads with work between them are two different answers,
    // and a `readnone` pair would fold into one and measure zero. `willreturn`
    // holds — one `clock_gettime` and some arithmetic — and there is nothing to
    // capture, so the only argument-free entry here needs no parameter facts.
    name: "nish_monotonic_nanos",
    signature: "declare i64 @nish_monotonic_nanos()",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  // ---- WP19 R1: the environment, so a self-hosted driver can honour `CC`
  // before it spawns `scripts/build.sh` the way stage0's preflight does.
  {
    // `effect: "write"` and no `readnone`, for two reasons that each suffice:
    // the call allocates, so it moves the arena, and `environ` is not memory
    // LLVM is tracking, so two reads either side of a `spawnSync` must not
    // fold into one. `noalias` is a fact here where it is not on
    // `nish_platform`: every call answers a fresh arena string rather than
    // the same constant. The name is read and never retained (`STR_NOCAP`),
    // and the result may be null, so no `nonnull` — exactly
    // `nish_read_file_or_null`'s shape, which is the other builtin whose
    // answer is `string | null`.
    name: "nish_getenv",
    signature: `declare noalias noundef align 8 i8* @nish_getenv(${STR_NOCAP})`,
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  // ---- WP14 §7a: what machine this is. `--target host` composes its triple
  // from the two, and so does any program that wants to know where it is.
  ...["nish_platform", "nish_arch"].map((name) => ({
    // Each answers the address of a string in the runtime's own constant data,
    // decided when `runtime.c` was compiled — a cross build compiles the
    // runtime for the target, so the answer is the target's. Nothing is
    // allocated and nothing is read, which is what makes `readnone` a fact and
    // lets two reads in one function fold into one. Deliberately *not*
    // `noalias`: every call answers the same pointer, and `noalias` promises
    // the opposite.
    name,
    signature: `declare noundef nonnull align 8 i8* @${name}()`,
    attrs: ["nounwind", "willreturn", "readnone"],
    effect: "none" as MemoryEffect,
  })),
  // ---- WP4: arrays --------------------------------------------------------
  {
    name: "nish_array_grow",
    // Doubles `cap` (4 when 0), moves the elements into fresh arena storage; `len` is untouched.
    signature: "declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef)",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    // Host entry (WP8): header + `len` uninitialised elements, `len == cap`. Compiled code
    // never calls it (literals and `new Array` use the inline allocator); the wasm loader and
    // C hosts do, so it is part of the declared ABI and of nish.h.
    name: "nish_alloc_array",
    signature: "declare noalias noundef nonnull align 8 %struct.nish_array* @nish_alloc_array(i64 noundef, i64 noundef)",
    attrs: ["nounwind", "willreturn"],
    effect: "write",
  },
  {
    name: "nish_panic_index",
    // Bounds-check failure: prints "index out of range: <idx> >= <len>" and exits 1.
    signature: "declare void @nish_panic_index(i64 noundef, i64 noundef)",
    attrs: ["nounwind", "noreturn", "cold"],
    effect: "write",
    noreturn: true,
  },
  // ---- Checked integer division and ECMAScript pow ----------------------------
  {
    name: "nish_panic_div",
    // Division failure: "attempt to divide by zero" (true) or "... with overflow" (false), exit 1.
    signature: "declare void @nish_panic_div(i1 noundef zeroext)",
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
    // f32 saturating conversions; the `.f32` suffix is the *source* type.
    intrinsic(`llvm.fptosi.sat.${t}.f32`, t, "float"),
    intrinsic(`llvm.fptoui.sat.${t}.f32`, t, "float"),
  ]),
  // ---- WP15: `Math.abs`/`min`/`max` on an `f32`. The f64-only Math functions
  // (sqrt, pow, ...) stay f64-only, so there is no `llvm.sqrt.f32` here.
  intrinsic("llvm.fabs.f32", "float", "float"),
  intrinsic("llvm.minnum.f32", "float", "float, float"),
  intrinsic("llvm.maxnum.f32", "float", "float, float"),
];

export const RUNTIME_BY_NAME = new Map(RUNTIME_FUNCTIONS.map((f) => [f.name, f]));

/**
 * The inline bump allocator. `size` is rounded up to 8 bytes so every object
 * (and therefore every field of every struct) is 8-byte aligned.
 */
export function inlineAllocator(attrGroup: string): string {
  return `define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) ${attrGroup} {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}`;
}

export const INLINE_ALLOCATOR_ATTRS = ["alwaysinline", "nounwind", "willreturn", "allocsize(0)"];
