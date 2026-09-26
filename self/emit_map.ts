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

import { Emitter, LoopTarget } from "./emit";
import { FactsTable } from "./attributes";
import { internalErrorFor } from "./ice";
import { intrinsicType, unwrapParens } from "./emit_util";
import { StringSet } from "./map";
import { N_CALL, N_FALSE, N_IDENT, N_NULL, N_NUMBER, N_STRING, N_TRUE, Node } from "./nodes";
import { CheckedProgram, FunctionSig, MAP_HASH_KEY, MAP_NONE } from "./program";
import { Local } from "./symbols";
import { isUndefined } from "./validator";
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
    return emitStringHash(emitter, value);
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
const emitStringHash = (emitter: Emitter, str: string): string => {
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

/**
 * murmur3's 32-bit finaliser. Every multiply wraps, which is what it is written
 * against. MurmurHash3 and its constants are public domain, as are FNV's above.
 */
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

// ---- `m.get(k)`: a maybe, as two SSA values --------------------------------------

/**
 * A maybe as the emitter holds it: two SSA values, the probe's found bit and
 * the value. A `get` is its probe alone until the value is asked for
 * (`loadMaybeValue`), which is emitted only where the found bit is set, since
 * `valueAt` of an absent probe's index is not an entry; it keeps the map, the
 * packed answer and `valueAt` for that. A `const` bound to a `get` has read
 * its value already, under its own found test, and has no `read`.
 */
export class MaybeParts {
  found: string;
  value: string;
  receiver: string;
  packed: string;
  read: FunctionSig | null;

  constructor(found: string, value: string, receiver: string, packed: string, read: FunctionSig | null) {
    this.found = found;
    this.value = value;
    this.receiver = receiver;
    this.packed = packed;
    this.read = read;
  }
}

/**
 * The `valueAt` of the table whose `probe` a `get` was checked as a call of:
 * what reads the value the probe found. It is the one other function a `get`
 * calls, and the whole-program facts count it as a callee there
 * (`self/attributes.ts`), so it is copied into the module with `probe`.
 */
export const valueReaderOf = (probe: FunctionSig): FunctionSig | null => {
  const owner = probe.owner;
  return owner === null ? null : owner.method("valueAt");
};

/**
 * Lower a maybe: `m.get(k)`, or a `const` bound to one, in parentheses or
 * not. A `get` is one call of the instance's `probe`, whose packed answer is
 * `>= 0` exactly when the key is there.
 */
export const emitMaybe = (emitter: Emitter, maybe: Node): MaybeParts => {
  const expr = unwrapParens(maybe);
  const local = emitter.program.nodeLocals[expr.id];
  if (expr.kind === N_IDENT && local !== null) {
    return emitter.maybeParts[maybeLocalIndex(emitter, local)];
  }
  const probe = emitter.program.nodeCallees[expr.id];
  if (expr.kind !== N_CALL || probe === null) {
    process.exit(internalErrorFor(`emitter: a maybe that is neither \`get\` nor a \`const\``, emitter.opts.json));
  }
  const fn = emitter.fn;
  const receiver = emitter.emitExpression(expr.children[0].children[0]);
  const key = emitter.emitExpression(expr.children[1].children[0]);
  const operands = `${emitter.llvm(probe.paramTypes[0])} ${receiver}, ${emitter.llvm(probe.paramTypes[1])} ${key}`;
  const packed = fn.emitValue(`call i64 @${probe.name}(${operands})`);
  return new MaybeParts(fn.emitValue(`icmp sge i64 ${packed}, 0`), "", receiver, packed, valueReaderOf(probe));
};

/**
 * The value of a maybe, emitted where its found bit is known to be set: a
 * `const`'s is already loaded, and a `get`'s is `valueAt` of the entry the
 * probe found, the index in the low half of its packed answer.
 */
export const loadMaybeValue = (emitter: Emitter, parts: MaybeParts): string => {
  const read = parts.read;
  if (read === null) {
    return parts.value;
  }
  const fn = emitter.fn;
  const index = fn.emitValue(`trunc i64 ${parts.packed} to i32`);
  const operands = `${emitter.llvm(read.paramTypes[0])} ${parts.receiver}, i32 ${index}`;
  return fn.emitValue(`call ${emitter.llvm(read.returnType)} @${read.name}(${operands})`);
};

/**
 * `const a = m.get(k)`: the probe, then `valueAt` on the found edge alone, and
 * a `phi` that is `V`'s zero where there was nothing to read. Nothing reads the
 * zero: the checker lets `a` be read as `V` only where a test proved it found.
 * The pair is remembered for `a`'s uses and is never stored: `a` is a `const`,
 * so each use sees the SSA values its declaration defined.
 */
export const emitMaybeLocal = (emitter: Emitter, local: Local, decl: Node): void => {
  let parts = emitMaybe(emitter, decl.children[2]);
  if (parts.read !== null) {
    const fn = emitter.fn;
    const entry = fn.currentBlock().label;
    const found = fn.newBlock("get.found");
    const done = fn.newBlock("get.end");
    fn.emit(`br i1 ${parts.found}, label %${found.label}, label %${done.label}`);
    fn.placeBlock(found);
    const loaded = loadMaybeValue(emitter, parts);
    const foundEdge = fn.currentBlock().label;
    fn.emit(`br label %${done.label}`);
    fn.placeBlock(done);
    const type = emitter.table.refOf(local.type);
    const value = fn.emitValue(`phi ${emitter.llvm(type)} [ ${loaded}, %${foundEdge} ], [ ${zeroOf(emitter, type)}, %${entry} ]`);
    parts = new MaybeParts(parts.found, value, "", "", null);
  }
  emitter.maybeLocals.push(local);
  emitter.maybeParts.push(parts);
  const debug = emitter.debug;
  if (debug !== null) {
    // `-g`: the payload, which is what the variable reads as wherever a test
    // lets it be read; where it was not found, a debugger shows `V`'s zero.
    debug.describeValue(emitter.fn, local, emitter.table.refOf(local.type), parts.value, decl);
  }
};

/** Where `local`'s pair is in the emitter's list; a narrowed read of a maybe `const` is its value. */
export const maybeLocalIndex = (emitter: Emitter, local: Local): i32 => {
  let i = emitter.maybeLocals.length - 1;
  while (i >= 0) {
    if (emitter.maybeLocals[i] === local) {
      return i;
    }
    i = i - 1;
  }
  process.exit(internalErrorFor(`emitter: no value for the maybe \`${local.name}\``, emitter.opts.json));
};

/** The constant zero of `type`, for the value of a maybe that was not found. */
const zeroOf = (emitter: Emitter, type: i32): string => {
  if (isFloat(type)) {
    return "0.000000e+00";
  }
  if (type === T_BOOL) {
    return "false";
  }
  return emitter.table.isPointer(emitter.table.stripNull(type)) ? "null" : "0";
};

/**
 * `a === undefined` / `a !== undefined`: the found bit, or its negation. A
 * `get` tested this way is its probe alone; the value is never read.
 */
export const emitUndefinedTest = (emitter: Emitter, expr: Node): string => {
  const operand = testsUndefined(emitter, expr.children[0]) ? expr.children[1] : expr.children[0];
  const parts = emitMaybe(emitter, operand);
  return expr.text === "!==" ? parts.found : emitter.fn.emitValue(`xor i1 ${parts.found}, true`);
};

/** Whether the `===` or `!==` `expr` tests a maybe against `undefined`. */
export const isUndefinedTest = (emitter: Emitter, expr: Node): boolean =>
  testsUndefined(emitter, expr.children[0]) || testsUndefined(emitter, expr.children[1]);

/** The `undefined` side of a test, on which the checker records the maybe it is compared with. */
const testsUndefined = (emitter: Emitter, operand: Node): boolean =>
  isUndefined(operand) &&
  emitter.program.nodeLocals[operand.id] === null &&
  emitter.table.isMaybe(emitter.program.nodeTypes[operand.id]);

/**
 * `a ?? d`. The default runs only where the value is missing, as JavaScript's
 * does, and for a nullable `V` where the value found is `null` as well. A
 * `get` reads its value only on the found edge, so it is a branch; a `const`'s
 * value is already loaded, so with a default that cannot have an effect it is
 * one `select`.
 */
export const emitCoalesce = (emitter: Emitter, expr: Node): string => {
  const fn = emitter.fn;
  const type = intrinsicType(emitter.program, expr); // before an interface coercion, which `emitExpression` adds
  const ty = emitter.llvm(type);
  const nullable = emitter.table.isNullable(type);
  const parts = emitMaybe(emitter, expr.children[0]);
  if (parts.read === null && isPlainOperand(emitter, expr.children[1])) {
    const fallback = emitter.emitExpression(expr.children[1]);
    const present = nullable ? fn.emitValue(`and i1 ${parts.found}, ${isSet(emitter, ty, parts.value)}`) : parts.found;
    return fn.emitValue(`select i1 ${present}, ${ty} ${parts.value}, ${ty} ${fallback}`);
  }
  const found = fn.newBlock("nullish.value");
  const missing = fn.newBlock("nullish.default");
  const done = fn.newBlock("nullish.end");
  fn.emit(`br i1 ${parts.found}, label %${found.label}, label %${missing.label}`);
  fn.placeBlock(found);
  const value = loadMaybeValue(emitter, parts);
  const foundEdge = fn.currentBlock().label;
  if (nullable) {
    fn.emit(`br i1 ${isSet(emitter, ty, value)}, label %${done.label}, label %${missing.label}`);
  } else {
    fn.emit(`br label %${done.label}`);
  }
  fn.placeBlock(missing);
  const fallback = emitter.emitExpression(expr.children[1]);
  const missingEdge = fn.currentBlock().label;
  fn.emit(`br label %${done.label}`);
  fn.placeBlock(done);
  return fn.emitValue(`phi ${ty} [ ${value}, %${foundEdge} ], [ ${fallback}, %${missingEdge} ]`);
};

/** Whether `value`, a found value of the nullable LLVM type `ty`, is not the stored `null` that `??` replaces too. */
const isSet = (emitter: Emitter, ty: string, value: string): string => emitter.fn.emitValue(`icmp ne ${ty} ${value}, null`);

/** A literal, a local or a module constant: evaluating it has no effect, so it may be evaluated whether or not it is used. */
const isPlainOperand = (emitter: Emitter, expr: Node): boolean => {
  if (expr.kind === N_IDENT) {
    return emitter.program.nodeLocals[expr.id] !== null || emitter.program.nodeConstants[expr.id] !== null;
  }
  return (
    expr.kind === N_NUMBER ||
    expr.kind === N_STRING ||
    expr.kind === N_TRUE ||
    expr.kind === N_FALSE ||
    expr.kind === N_NULL
  );
};

// ---- `for (const k of m.keys())`: a walk ------------------------------------------

/**
 * A `for...of` over `m.keys()`, `m.values()`, a `Set` or its two iterators
 * (docs/wp32-map.md §6.2, §6.3), lowered to the table's four walk methods:
 *
 *     walkOpen(m)                   where the loop is entered: the count of live walks
 *     i = walkNext(m, 0)            the first live entry, or -1
 *   walk.cond:  i >= 0 ?
 *   walk.body:  x = keyAt(m, i)     (`valueAt` for `values()`), then the body
 *   walk.inc:   i = walkNext(m, i + 1)
 *   walk.end:   walkClose(m)
 *
 * `walkNext` reads the entry count on every call and skips a dead entry, and
 * no entry moves while the count is above zero, so each mutation of the table
 * during the walk has JavaScript's effect. `break` and the fall-through both
 * leave through `walk.end`; `continue` goes to `walk.inc` and stays inside;
 * a `return`, or an `orReturn()`, leaves every walk around it, and
 * `emitScopeExit` closes each (`emitWalkExits`). The receiver is evaluated
 * once, where the loop is entered, as JavaScript evaluates the iterable once.
 */
export const emitWalk = (emitter: Emitter, stmt: Node): void => {
  const decl = stmt.children[0].children[0].children[0];
  const local = emitter.program.nodeLocals[decl.id];
  if (local === null) {
    process.exit(internalErrorFor("emitter: a walk with no variable recorded", emitter.opts.json));
  }
  const read = emitter.program.nodeCallees[stmt.id];
  if (read === null) {
    process.exit(internalErrorFor("emitter: a walk with no reader recorded", emitter.opts.json));
  }
  const owner = read.owner;
  if (owner === null) {
    process.exit(internalErrorFor("emitter: a walk reader outside its class", emitter.opts.json));
  }
  const open = owner.method("walkOpen");
  const next = owner.method("walkNext");
  const close = owner.method("walkClose");
  if (open === null || next === null || close === null) {
    process.exit(internalErrorFor("emitter: the global `Map` or `Set` has no walk", emitter.opts.json));
  }
  const fn = emitter.fn;
  const elem = local.type;
  const ty = emitter.llvm(elem);
  const condBlock = fn.newBlock("walk.cond");
  const bodyBlock = fn.newBlock("walk.body");
  const incBlock = fn.newBlock("walk.inc");
  const endBlock = fn.newBlock("walk.end");
  const slot = fn.emitAlloca(`${local.name}.addr`, ty, emitter.align(elem));
  emitter.setSlot(local, slot);
  const debug = emitter.debug;
  if (debug !== null) {
    debug.declareLocal(fn, local, slot, decl); // `-g`
  }
  const idxSlot = fn.emitAlloca("walk.idx", "i32", emitter.align(T_I32));

  const iterable = unwrapParens(stmt.children[1]);
  // `m.keys()` was checked as a call of `walkOpen`; any other iterable, a call
  // that answers a `Set` included, is the table itself.
  const recorded = emitter.program.nodeCallees[iterable.id];
  const isCall = iterable.kind === N_CALL && recorded !== null && recorded === open;
  const receiverExpr = isCall ? iterable.children[0].children[0] : iterable;
  const receiver = `${emitter.llvm(open.paramTypes[0])} ${emitter.emitExpression(receiverExpr)}`;
  fn.emit(`call void @${open.name}(${receiver})`);
  const first = fn.emitValue(`call i32 @${next.name}(${receiver}, i32 0)`);
  fn.emit(`store i32 ${first}, i32* ${idxSlot}${emitter.alignSuffix(T_I32)}`);
  fn.emit(`br label %${condBlock.label}`);

  fn.placeBlock(condBlock);
  const at = fn.emitValue(`load i32, i32* ${idxSlot}${emitter.alignSuffix(T_I32)}`);
  const more = fn.emitValue(`icmp sge i32 ${at}, 0`);
  fn.emit(`br i1 ${more}, label %${bodyBlock.label}, label %${endBlock.label}`);

  fn.placeBlock(bodyBlock);
  const value = fn.emitValue(`call ${emitter.llvm(read.returnType)} @${read.name}(${receiver}, i32 ${at})`);
  fn.emit(`store ${ty} ${value}, ${ty}* ${slot}${emitter.alignSuffix(elem)}`);
  const target = new LoopTarget(endBlock, incBlock);
  target.walkClose = `call void @${close.name}(${receiver})`;
  emitter.loops.push(target);
  emitter.emitStatement(stmt.children[2]);
  emitter.loops.pop();
  if (!fn.currentBlock().terminated()) {
    fn.emit(`br label %${incBlock.label}`);
  }

  fn.placeBlock(incBlock);
  const after = fn.emitValue(`add i32 ${at}, 1`); // `walk.cond`'s load dominates this block
  const found = fn.emitValue(`call i32 @${next.name}(${receiver}, i32 ${after})`);
  fn.emit(`store i32 ${found}, i32* ${idxSlot}${emitter.alignSuffix(T_I32)}`);
  fn.emit(`br label %${condBlock.label}`);

  fn.placeBlock(endBlock);
  fn.emit(target.walkClose);
};

/**
 * The four methods a walk calls, given the reader its loop recorded: what
 * the whole-program facts count as its callees, so each is copied into the
 * module (`libraryReach`).
 */
export const walkMethodsOf = (read: FunctionSig): FunctionSig[] => {
  const out: FunctionSig[] = [read];
  const owner = read.owner;
  if (owner === null) {
    return out;
  }
  for (const name of ["walkOpen", "walkNext", "walkClose"]) {
    const sig = owner.method(name);
    if (sig !== null) {
      out.push(sig);
    }
  }
  return out;
};

/**
 * Close every walk a `return` leaves, innermost first: each enclosing loop
 * that is a walk decrements its table's count, so a compaction the walk
 * deferred can happen once it is over (docs/wp32-map.md §6.2). Every exit of
 * a function goes through `emitScopeExit`, which calls this.
 */
export const emitWalkExits = (emitter: Emitter): void => {
  for (let i = emitter.loops.length - 1; i >= 0; i--) {
    const close = emitter.loops[i].walkClose;
    if (close.length > 0) {
      emitter.fn.emit(close);
    }
  }
};
