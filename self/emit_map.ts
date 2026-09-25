// WP32: the global `Map` and `Set` in the emitter (docs/wp32-map.md §4.1, §5.2).
//
// `std/collections.ts` is checked like any module and emits nothing of its
// own. Two things here make that work:
//
//   - **Its code goes into the module that uses it.** Every function of the
//     library a module reaches — the members of each `Map` and `Set` instance
//     it calls, and the helpers those call — is emitted into that module with
//     `internal` linkage, after the module's own functions
//     (`emitLibraryCopies`). A one-file program that names `Map` is therefore
//     still one `.ll`, and two modules that share one `Map<string, i32>` each
//     call a private copy of its methods: the struct is laid out by name,
//     program-wide, so the copies agree on it. `internal` is also what gives the
//     copies this compiler's private calling convention, and LLVM deletes one
//     that nothing calls.
//   - **`hashKey<K>` and `sameKey<K>` are intrinsics.** Their Nish bodies are
//     what the checker and the fact fixpoint read; a call to one is lowered here,
//     in place, per key type, and the instance itself is never emitted
//     (`emitMapIntrinsic`). No runtime function is added: the runtime's `.text`
//     budget has no room, and `nish_str_eq` is the one symbol reached.
//
// The hashes are §5.2's, and a hash of 0 is moved to 1 because a stored hash
// of 0 marks a deleted entry:
//
//   string                    FNV-1a, 32-bit, over the UTF-8 bytes
//   <= 32-bit integer, boolean, enum   murmur3's fmix32 of the zero-extended value
//   i64, u64                  fmix64, the two halves XORed
//   f64                       -0 -> +0 (`fadd 0.0`), every NaN -> 0x7FF8000000000000, then as i64
//   f32                       `fpext`, then as f64
//   a class instance          its address as i64, then as i64
//
// and equality is SameValueZero: `nish_str_eq` for a string, `icmp eq` for
// every integer, boolean, enum and pointer, and for a float `a == b`
// (`fcmp oeq`, so -0 equals +0) or both NaN.

import { Emitter } from "./emit";
import { FactsTable } from "./attributes";
import { internalErrorFor } from "./ice";
import { StringSet } from "./map";
import { CheckedProgram, FunctionSig, MAP_HASH_KEY, MAP_NONE } from "./program";
import { intBits, isFloat, T_BOOL, T_F32, T_F64, T_I32, T_I64, T_STRING } from "./types";

/** The `MAP_*` role of `sig`, or `MAP_NONE` when it is not an instantiation of one of the two intrinsics. */
export const mapIntrinsicOf = (sig: FunctionSig): i32 => {
  const instance = sig.instance;
  return instance === null ? MAP_NONE : instance.mapIntrinsic;
};

/**
 * A call of `hashKey` or `sameKey`, lowered in place: `values` are the lowered
 * arguments. The key type is the instantiation's one type argument.
 */
export const emitMapIntrinsic = (emitter: Emitter, sig: FunctionSig, values: string[]): string => {
  const instance = sig.instance;
  if (instance === null || instance.typeArgs.length !== 1 || values.length === 0) {
    process.exit(internalErrorFor(`emitter: \`${sig.name}\` is not a key intrinsic`, emitter.opts.json));
  }
  const key = instance.typeArgs[0];
  if (instance.mapIntrinsic === MAP_HASH_KEY) {
    return nonZero(emitter, hashOf(emitter, key, values[0]));
  }
  if (values.length !== 2) {
    process.exit(internalErrorFor(`emitter: \`${sig.name}\` compares two keys`, emitter.opts.json));
  }
  return sameKeyOf(emitter, key, values[0], values[1]);
};

/** The 32-bit hash of `value`, a key of type `key`; it may still be 0. */
const hashOf = (emitter: Emitter, key: i32, value: string): string => {
  const fn = emitter.fn;
  if (key === T_STRING) {
    return fnv1a(emitter, value);
  }
  if (key === T_F64) {
    return fmix64(emitter, floatBits(emitter, value));
  }
  if (key === T_F32) {
    return fmix64(emitter, floatBits(emitter, fn.emitValue(`fpext float ${value} to double`)));
  }
  if (emitter.table.isStruct(key)) {
    return fmix64(emitter, fn.emitValue(`ptrtoint ${emitter.llvm(key)} ${value} to i64`));
  }
  const bits = intBits(key);
  if (bits === 64) {
    return fmix64(emitter, value);
  }
  if (bits === 32 || emitter.table.isEnum(key)) {
    return fmix32(emitter, value);
  }
  if (bits > 0 || key === T_BOOL) {
    return fmix32(emitter, fn.emitValue(`zext ${emitter.llvm(key)} ${value} to i32`));
  }
  process.exit(internalErrorFor(`emitter: no key hash for ${emitter.table.typeName(key)}`, emitter.opts.json));
};

/** A hash of 0 moved to 1: a stored hash of 0 is a deleted entry. */
const nonZero = (emitter: Emitter, h: string): string => {
  const zero = emitter.fn.emitValue(`icmp eq i32 ${h}, 0`);
  return emitter.fn.emitValue(`select i1 ${zero}, i32 1, i32 ${h}`);
};

/**
 * FNV-1a over the string's bytes, as `hashString` in `self/map.ts` computes
 * it. The loop state lives in two entry-block slots, as every loop the emitter
 * writes keeps its state, and `mem2reg` makes them the phis.
 */
const fnv1a = (emitter: Emitter, str: string): string => {
  const fn = emitter.fn;
  const index = fn.emitAlloca("hash.i", "i64", emitter.align(T_I64));
  const state = fn.emitAlloca("hash.h", "i32", emitter.align(T_I32));
  const header = fn.emitValue(`bitcast i8* ${str} to i64*`);
  const len = fn.emitValue(`load i64, i64* ${header}${emitter.alignSuffix(T_I64)}`);
  const data = fn.emitValue(`getelementptr inbounds i8, i8* ${str}, i64 8`);
  fn.emit(`store i64 0, i64* ${index}${emitter.alignSuffix(T_I64)}`);
  fn.emit(`store i32 -2128831035, i32* ${state}${emitter.alignSuffix(T_I32)}`);
  const test = fn.newBlock("hash.test");
  const body = fn.newBlock("hash.byte");
  const done = fn.newBlock("hash.done");
  fn.emit(`br label %${test.label}`);
  fn.placeBlock(test);
  const at = fn.emitValue(`load i64, i64* ${index}${emitter.alignSuffix(T_I64)}`);
  const more = fn.emitValue(`icmp ult i64 ${at}, ${len}`);
  fn.emit(`br i1 ${more}, label %${body.label}, label %${done.label}`);
  fn.placeBlock(body);
  const address = fn.emitValue(`getelementptr inbounds i8, i8* ${data}, i64 ${at}`);
  const byte = fn.emitValue(`load i8, i8* ${address}`);
  const wide = fn.emitValue(`zext i8 ${byte} to i32`);
  const h = fn.emitValue(`load i32, i32* ${state}${emitter.alignSuffix(T_I32)}`);
  const mixed = fn.emitValue(`xor i32 ${h}, ${wide}`);
  const next = fn.emitValue(`mul i32 ${mixed}, 16777619`);
  fn.emit(`store i32 ${next}, i32* ${state}${emitter.alignSuffix(T_I32)}`);
  const step = fn.emitValue(`add i64 ${at}, 1`);
  fn.emit(`store i64 ${step}, i64* ${index}${emitter.alignSuffix(T_I64)}`);
  fn.emit(`br label %${test.label}`);
  fn.placeBlock(done);
  return fn.emitValue(`load i32, i32* ${state}${emitter.alignSuffix(T_I32)}`);
};

/** murmur3's 32-bit finaliser. Every multiply wraps, which is what it is written against. */
const fmix32 = (emitter: Emitter, x: string): string => {
  const fn = emitter.fn;
  const a = fn.emitValue(`xor i32 ${x}, ${fn.emitValue(`lshr i32 ${x}, 16`)}`);
  const b = fn.emitValue(`mul i32 ${a}, -2048144789`);
  const c = fn.emitValue(`xor i32 ${b}, ${fn.emitValue(`lshr i32 ${b}, 13`)}`);
  const d = fn.emitValue(`mul i32 ${c}, -1028477387`);
  return fn.emitValue(`xor i32 ${d}, ${fn.emitValue(`lshr i32 ${d}, 16`)}`);
};

/** murmur3's 64-bit finaliser, folded to 32 bits by XORing the halves. */
const fmix64 = (emitter: Emitter, x: string): string => {
  const fn = emitter.fn;
  const a = fn.emitValue(`xor i64 ${x}, ${fn.emitValue(`lshr i64 ${x}, 33`)}`);
  const b = fn.emitValue(`mul i64 ${a}, -49064778989728563`);
  const c = fn.emitValue(`xor i64 ${b}, ${fn.emitValue(`lshr i64 ${b}, 33`)}`);
  const d = fn.emitValue(`mul i64 ${c}, -4265267296055464877`);
  const e = fn.emitValue(`xor i64 ${d}, ${fn.emitValue(`lshr i64 ${d}, 33`)}`);
  const low = fn.emitValue(`trunc i64 ${e} to i32`);
  const high = fn.emitValue(`trunc i64 ${fn.emitValue(`lshr i64 ${e}, 32`)} to i32`);
  return fn.emitValue(`xor i32 ${low}, ${high}`);
};

/**
 * A `double`'s bits after SameValueZero's normalisation: `fadd` of +0 turns
 * -0 into +0 and leaves everything else alone, and every NaN becomes the one
 * canonical quiet NaN, so keys that compare equal hash equal.
 */
const floatBits = (emitter: Emitter, value: string): string => {
  const fn = emitter.fn;
  const plus = fn.emitValue(`fadd double ${value}, 0.000000e+00`);
  const nan = fn.emitValue(`fcmp uno double ${plus}, ${plus}`);
  const bits = fn.emitValue(`bitcast double ${plus} to i64`);
  return fn.emitValue(`select i1 ${nan}, i64 9221120237041090560, i64 ${bits}`);
};

/** SameValueZero on two keys of type `key`. */
const sameKeyOf = (emitter: Emitter, key: i32, a: string, b: string): string => {
  const fn = emitter.fn;
  if (key === T_STRING) {
    return fn.emitValue(`call zeroext i1 ${emitter.useRuntime("nish_str_eq")}(i8* ${a}, i8* ${b})`);
  }
  if (isFloat(key)) {
    const ty = emitter.llvm(key);
    const equal = fn.emitValue(`fcmp oeq ${ty} ${a}, ${b}`);
    const aNaN = fn.emitValue(`fcmp uno ${ty} ${a}, ${a}`);
    const bNaN = fn.emitValue(`fcmp uno ${ty} ${b}, ${b}`);
    const both = fn.emitValue(`and i1 ${aNaN}, ${bNaN}`);
    return fn.emitValue(`or i1 ${equal}, ${both}`);
  }
  return fn.emitValue(`icmp eq ${emitter.llvm(key)} ${a}, ${b}`);
};

// ---- The library's code, in the module that uses it ------------------------------

/**
 * Every function of `library` that a function `emitter`'s module defines
 * reaches through calls, in `library`'s own order, less the two intrinsics.
 * The call graph is the fixpoint's (`FunctionFacts.callees`), which lists every
 * user function a body calls by symbol, constructors and methods included.
 */
export const libraryReach = (emitter: Emitter, library: CheckedProgram): FunctionSig[] => {
  const facts: FactsTable = emitter.facts;
  const bySymbol = new StringSet();
  for (const sig of library.functions) {
    if (sig.definedIn(library.source)) {
      bySymbol.add(sig.name);
    }
  }
  const reached = new StringSet();
  const pending: string[] = [];
  for (const sig of emitter.program.functions) {
    if (sig.definedIn(emitter.program.source)) {
      noteCallees(facts, sig.name, bySymbol, reached, pending);
    }
  }
  let at = 0;
  while (at < pending.length) {
    const name = pending[at];
    at = at + 1;
    noteCallees(facts, name, bySymbol, reached, pending);
  }
  const out: FunctionSig[] = [];
  for (const sig of library.functions) {
    if (reached.has(sig.name) && mapIntrinsicOf(sig) === MAP_NONE) {
      out.push(sig);
    }
  }
  return out;
};

/** Queue each library function `caller` calls that has not been reached yet. */
const noteCallees = (facts: FactsTable, caller: string, bySymbol: StringSet, reached: StringSet, pending: string[]): void => {
  const callerFacts = facts.get(caller);
  if (callerFacts === null) {
    return;
  }
  const callees = callerFacts.callees;
  let i = 0;
  while (i < callees.size()) {
    const callee = callees.at(i);
    if (bySymbol.has(callee) && reached.add(callee)) {
      pending.push(callee);
    }
    i = i + 1;
  }
};

/**
 * Emit `sigs`, functions of `library`, into the emitter's module as `internal`
 * copies. The emitter reads the side tables of the program it is handed, so
 * the library's program is installed for the duration, and under `-g` each
 * copy's `DISubprogram` names `std/collections.ts`, the file its lines are in.
 */
export const emitLibraryCopies = (emitter: Emitter, library: CheckedProgram, sigs: FunctionSig[]): void => {
  if (sigs.length === 0) {
    return;
  }
  const own = emitter.program;
  emitter.program = library;
  const debug = emitter.debug;
  let savedFile = "";
  if (debug !== null) {
    savedFile = debug.file;
    debug.program = library;
    debug.source = library.source;
    debug.file = debug.fileOf(library.source);
  }
  for (const sig of sigs) {
    const instance = sig.instance;
    if (instance !== null) {
      library.enterInstance(instance);
    }
    emitter.module.addFunction(emitter.emitFunction(sig));
    if (instance !== null) {
      library.leaveInstance();
    }
  }
  if (debug !== null) {
    debug.program = own;
    debug.source = own.source;
    debug.file = savedFile;
  }
  emitter.program = own;
};
