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
// emitted as an `alwaysinline` IR function that bumps `@nish_arena` directly,
// so after inlining an allocation is a load, an add, a compare and a store.
// Only the overflow path calls `@nish_arena_grow` in runtime.c.
//
// `src/` keeps the table as an array of object literals and a `Map` beside it.
// Here it is a class built once per compilation: the same array, with a
// `StringMap` from symbol to index so the attribute fixpoint can ask about a
// callee by name.

import { StringMap } from "./map";

/** Global arena state; must match `struct nish_arena` in runtime.c. */
export const ARENA_TYPE: string = "%struct.nish_arena = type { i8*, i64, i64, i8* }";
/** Array header (WP4); must match `struct nish_array` in runtime.c: { len, cap, data }. */
export const ARRAY_TYPE: string = "%struct.nish_array = type { i64, i64, i8* }";

export const ARENA_GLOBAL: string = "@nish_arena = external global %struct.nish_arena, align 8";
/**
 * `process.argv` (WP7): the `string[]` the entry wrapper builds once with
 * `nish_argv_init(argc, argv)`; every module that reads it loads this global.
 */
export const ARGV_GLOBAL: string = "@nish_argv = external global %struct.nish_array*, align 8";

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
  /** Never returns to the caller (`nish_exit`); callers lose `willreturn`. */
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

function attrs1(a: string): string[] {
  const out: string[] = [];
  out.push(a);
  return out;
}

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
      "nish_arena_grow",
      "declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef)",
      ["nounwind", "willreturn", "cold", "noinline", "allocsize(0)"],
      EFFECT_WRITE
    );
    this.add(grow);
    this.add(plain("nish_reset_arena", "declare void @nish_reset_arena()", EFFECT_WRITE));
    this.add(plain("nish_free_arena", "declare void @nish_free_arena()", EFFECT_WRITE));
    // WP6, arena scopes. A mark is the absolute bump address (`buf + off`), 0 while the arena is empty.
    this.add(plain("nish_arena_mark", "declare noundef i64 @nish_arena_mark()", EFFECT_WRITE));
    // Rewinds to a mark: same chunk -> reset the offset; an older chunk -> free the newer ones first.
    this.add(plain("nish_arena_release", "declare void @nish_arena_release(i64 noundef)", EFFECT_WRITE));
    this.add(plain("nish_arena_used", "declare noundef i64 @nish_arena_used()", EFFECT_WRITE));
    // WP9 call-site reclaim: rewinds to a mark while keeping the newest block,
    // which it moves down to the mark and answers at its new address. Neither
    // `noalias` nor `nocapture` is claimed: the guards in runtime.c answer the
    // argument itself whenever the move cannot be proved safe, and a returned
    // pointer is a captured one. The chunk walk is over a finite acyclic list,
    // so `willreturn` holds.
    this.add(
      plain(
        "nish_arena_keep",
        "declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8)",
        EFFECT_WRITE
      )
    );
    this.add(
      plain(
        "nish_str_new",
        "declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef)",
        EFFECT_WRITE
      )
    );
    this.add(
      plain(
        "nish_str_concat",
        `declare noalias noundef nonnull align 8 i8* @nish_str_concat(${STR_NOCAP}, ${STR_NOCAP})`,
        EFFECT_WRITE
      )
    );
    this.add(
      new RuntimeFunction(
        "nish_str_eq",
        `declare zeroext i1 @nish_str_eq(${STR_NOCAP}, ${STR_NOCAP})`,
        attrs3("nounwind", "willreturn", "memory(argmem: read)"),
        EFFECT_READ
      )
    );
    this.add(
      new RuntimeFunction(
        "nish_str_at",
        `declare zeroext i1 @nish_str_at(${STR_NOCAP}, i64 noundef, ${STR_NOCAP})`,
        attrs3("nounwind", "willreturn", "memory(argmem: read)"),
        EFFECT_READ
      )
    );
    this.add(
      new RuntimeFunction(
        "nish_str_index_of",
        `declare i64 @nish_str_index_of(${STR_NOCAP}, ${STR_NOCAP})`,
        attrs3("nounwind", "willreturn", "memory(argmem: read)"),
        EFFECT_READ
      )
    );
    this.add(
      new RuntimeFunction(
        "nish_str_len",
        `declare i64 @nish_str_len(${STR_NOCAP})`,
        attrs3("nounwind", "willreturn", "memory(argmem: read)"),
        EFFECT_READ
      )
    );
    this.add(
      plain("nish_write", `declare void @nish_write(${STR_NOCAP}, i32 noundef, i1 noundef zeroext)`, EFFECT_WRITE)
    );
    this.add(plain("nish_print", `declare void @nish_print(${STR_NOCAP})`, EFFECT_WRITE));
    this.add(
      plain(
        "nish_str_from_i32",
        "declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef)",
        EFFECT_WRITE
      )
    );
    this.add(
      plain(
        "nish_str_from_f64",
        "declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef)",
        EFFECT_WRITE
      )
    );
    // WP7: i64 strings, Math.random, process, files.
    this.add(
      plain(
        "nish_str_from_i64",
        "declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef)",
        EFFECT_WRITE
      )
    );
    // WP15: the one unsigned formatter. `u8`/`u16`/`u32` are `zext`ed to i64 at
    // the call site rather than getting three more symbols of their own, which
    // is what keeps `runtime.c` inside its `.text` budget.
    this.add(
      plain(
        "nish_str_from_u64",
        "declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef)",
        EFFECT_WRITE
      )
    );
    // xorshift64* over a global state word: reads and writes memory.
    this.add(plain("nish_random", "declare noundef double @nish_random()", EFFECT_WRITE));
    const exit = new RuntimeFunction(
      "nish_exit",
      "declare void @nish_exit(i32 noundef)",
      attrs2("noreturn", "nounwind"),
      EFFECT_WRITE
    );
    exit.noreturn = true;
    this.add(exit);
    this.add(
      plain(
        "nish_read_file",
        `declare noalias noundef nonnull align 8 i8* @nish_read_file(${STR_NOCAP})`,
        EFFECT_WRITE
      )
    );
    this.add(
      plain(
        "nish_read_file_or_null",
        `declare noalias noundef align 8 i8* @nish_read_file_or_null(${STR_NOCAP})`,
        EFFECT_WRITE
      )
    );
    this.add(plain("nish_write_file", `declare void @nish_write_file(${STR_NOCAP}, ${STR_NOCAP})`, EFFECT_WRITE));
    this.add(plain("nish_append_file", `declare void @nish_append_file(${STR_NOCAP}, ${STR_NOCAP})`, EFFECT_WRITE));
    // WP7: process.argv and string-to-number parsing.
    // Called once by the entry wrapper: mallocs the array and copies every argument.
    this.add(
      plain("nish_argv_init", "declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly)", EFFECT_WRITE)
    );
    // mode 0 parseFloat, 1 Number, 2 parseInt (as a double; the caller saturates it).
    // The string is only read and never retained (`readonly nocapture`), but the
    // function itself is not `readonly`: strtod/strtoll may store errno on overflow.
    this.add(
      plain("nish_parse_number", `declare noundef double @nish_parse_number(${STR_NOCAP}, i32 noundef)`, EFFECT_WRITE)
    );
    // WP14 D4: the directory and subprocess calls a self-hosted driver needs
    // to link its own output, and the WP14 §7a `stat` beside them. Each
    // answers a value rather than exiting.
    // `mkdir`, then `nish_is_dir` when it failed: it changes the file system,
    // so `write`, and the path is only read and never retained (`STR_NOCAP`).
    this.add(plain("nish_mkdir", `declare zeroext i1 @nish_mkdir(${STR_NOCAP})`, EFFECT_WRITE));
    // WP14 §7a. One `stat`, answering only "is there a directory here?", which
    // is the question `-o <dir>` asks. `EFFECT_WRITE` rather than read for the
    // reason `nish_parse_number` is not readonly: a failed `stat` stores
    // `errno`, and the file system is not memory LLVM may reason about, so a
    // caller must not be hoisted across anything that could change it.
    this.add(plain("nish_is_dir", `declare zeroext i1 @nish_is_dir(${STR_NOCAP})`, EFFECT_WRITE));
    // Runs an arbitrary program, so the honest answer to every question is the
    // conservative one:
    //   - no `memory(...)` and `EFFECT_WRITE`: the child reads and writes
    //     files, the terminal and anything else it likes, and the caller must
    //     not be hoisted across that;
    //   - no `nocapture` on the vector: the runtime copies each element's bytes
    //     pointer into an arena block that outlives the call, which is a
    //     capture (`classifyUse` in attributes.ts says the same on the checker
    //     side, so a parameter handed to `spawnSync` never gets `nocapture`);
    //   - no `willreturn`: the child may never exit, and `waitpid` waits.
    // `nounwind` is still a fact: the language has no exceptions and neither
    // does the C that implements this.
    this.add(
      new RuntimeFunction(
        "nish_spawn",
        "declare noundef i32 @nish_spawn(%struct.nish_array* noundef nonnull align 8)",
        attrs1("nounwind"),
        EFFECT_WRITE
      )
    );
    // `nish_spawn` with one or both of the child's streams pointed at a file,
    // and therefore the same conservative answers: the child still runs
    // arbitrary code, the vector is still captured, and `waitpid` still waits.
    // The two paths are read and never retained (`STR_NOCAP`); an empty one
    // means "inherit that stream", which is a value and not a null, so both
    // stay `nonnull`.
    this.add(
      new RuntimeFunction(
        "nish_spawn_to",
        `declare noundef i32 @nish_spawn_to(%struct.nish_array* noundef nonnull align 8, ${STR_NOCAP}, ${STR_NOCAP})`,
        attrs1("nounwind"),
        EFFECT_WRITE
      )
    );
    // A fresh `string[]` per call, so `noalias`, and null when the directory
    // cannot be read, so no `nonnull`. `EFFECT_WRITE` because it allocates (the
    // arena moves) and because the directory is not memory LLVM tracks: two
    // listings either side of a `mkdirSync` must not fold into one.
    // `willreturn` is a fact rather than a hope: the loop runs once per entry
    // and a directory has finitely many. The path is read and never retained.
    this.add(
      plain(
        "nish_readdir",
        `declare noalias align 8 %struct.nish_array* @nish_readdir(${STR_NOCAP})`,
        EFFECT_WRITE
      )
    );
    // The clock is not memory either, and that is the whole reason this is not
    // `readnone`: two reads with work between them are two different answers,
    // and a `readnone` pair would fold into one and measure zero. `willreturn`
    // holds — one `clock_gettime` and some arithmetic — and there is nothing to
    // capture, so the only argument-free entry here needs no parameter facts.
    this.add(plain("nish_monotonic_nanos", "declare i64 @nish_monotonic_nanos()", EFFECT_WRITE));
    // WP19 R1: the environment, so a self-hosted driver can honour `CC` before
    // it spawns `scripts/build.sh` the way stage0's preflight does.
    // `EFFECT_WRITE` and no `readnone`, for two reasons that each suffice: the
    // call allocates, so it moves the arena, and `environ` is not memory LLVM
    // is tracking, so two reads either side of a `spawnSync` must not fold
    // into one. `noalias` is a fact here where it is not on `nish_platform`:
    // every call answers a fresh arena string rather than the same constant.
    // The name is read and never retained (`STR_NOCAP`), and the result may be
    // null, so no `nonnull`.
    this.add(
      plain("nish_getenv", `declare noalias noundef align 8 i8* @nish_getenv(${STR_NOCAP})`, EFFECT_WRITE)
    );
    // WP14 §7a: what machine this is. `--target host` composes its triple from
    // the two. Each answers the address of a string in the runtime's own
    // constant data, decided when `runtime.c` was compiled — a cross build
    // compiles the runtime for the target — so nothing is allocated and
    // nothing is read, which is what makes `readnone` a fact and lets two
    // reads in one function fold into one. Deliberately *not* `noalias`: every
    // call answers the same pointer, and `noalias` promises the opposite.
    this.add(
      new RuntimeFunction(
        "nish_platform",
        "declare noundef nonnull align 8 i8* @nish_platform()",
        attrs3("nounwind", "willreturn", "readnone"),
        EFFECT_NONE
      )
    );
    this.add(
      new RuntimeFunction(
        "nish_arch",
        "declare noundef nonnull align 8 i8* @nish_arch()",
        attrs3("nounwind", "willreturn", "readnone"),
        EFFECT_NONE
      )
    );
    // WP4: arrays. `nish_array_grow` doubles `cap` (4 when 0) and moves the
    // elements into fresh arena storage; `len` is untouched.
    this.add(
      plain(
        "nish_array_grow",
        "declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef)",
        EFFECT_WRITE
      )
    );
    // Host entry (WP8): header + `len` uninitialised elements, `len == cap`. Compiled code
    // never calls it (literals and `new Array` use the inline allocator); the wasm loader and
    // C hosts do, so it is part of the declared ABI and of nish.h.
    this.add(
      plain(
        "nish_alloc_array",
        "declare noalias noundef nonnull align 8 %struct.nish_array* @nish_alloc_array(i64 noundef, i64 noundef)",
        EFFECT_WRITE
      )
    );
    // Bounds-check failure: prints "index out of range: <idx> >= <len>" and exits 1.
    const panicIndex = new RuntimeFunction(
      "nish_panic_index",
      "declare void @nish_panic_index(i64 noundef, i64 noundef)",
      attrs3("nounwind", "noreturn", "cold"),
      EFFECT_WRITE
    );
    panicIndex.noreturn = true;
    this.add(panicIndex);
    // `slice` range-check failure (WP15 section 4): prints "slice out of range:
    // [<start>, <end>) of length <len>" and exits 1. Its own symbol rather than
    // `nish_panic_index` because a reversed pair is as common a mistake as an
    // end past the string, and "i >= len" describes neither.
    const panicSlice = new RuntimeFunction(
      "nish_panic_slice",
      "declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef)",
      attrs3("nounwind", "noreturn", "cold"),
      EFFECT_WRITE
    );
    panicSlice.noreturn = true;
    this.add(panicSlice);
    // Division failure: "attempt to divide by zero" (true) or "... with overflow" (false), exit 1.
    const panicDiv = new RuntimeFunction(
      "nish_panic_div",
      "declare void @nish_panic_div(i1 noundef zeroext)",
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
  lines.push(`define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) ${attrGroup} {`);
  lines.push("entry:");
  lines.push("  %size.p7 = add i64 %size, 7");
  lines.push("  %size.aligned = and i64 %size.p7, -8");
  lines.push("  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1");
  lines.push("  %off = load i64, i64* %off.ptr, align 8");
  lines.push("  %new.off = add i64 %off, %size.aligned");
  lines.push("  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2");
  lines.push("  %cap = load i64, i64* %cap.ptr, align 8");
  lines.push("  %fits = icmp ule i64 %new.off, %cap");
  lines.push("  br i1 %fits, label %fast, label %slow");
  lines.push("");
  lines.push("fast:");
  lines.push("  store i64 %new.off, i64* %off.ptr, align 8");
  lines.push("  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0");
  lines.push("  %buf = load i8*, i8** %buf.ptr, align 8");
  lines.push("  %obj = getelementptr inbounds i8, i8* %buf, i64 %off");
  lines.push("  ret i8* %obj");
  lines.push("");
  lines.push("slow:");
  lines.push("  %grown = call i8* @nish_arena_grow(i64 %size.aligned)");
  lines.push("  ret i8* %grown");
  lines.push("}");
  return lines.join("\n");
}
