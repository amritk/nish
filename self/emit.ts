// Phase C for stage1: LLVM IR emission (`src/codegen/emitter.ts`,
// docs/wp14-selfhost.md milestone S4).
//
// Lowers a *checked* program into LLVM IR text. The checker already resolved
// every type and binding, so nothing here handles user mistakes: any node the
// emitter sees is known to be valid, and an unexpected one is an internal
// error — `panic`, which is WP14 D1's replacement for the `throw` that
// `src/codegen/emitter.ts` uses to reach the CLI's exit 70.
//
// The lowering rules are `src/codegen/emitter.ts`'s and are not restated:
// parameters are SSA values, `let`/`const` locals get an entry-block `alloca`,
// every expression lowers to a single LLVM value, each source file becomes one
// module, and the entry module's `main` is wrapped by the C-ABI `@main`.
//
// What differs from `src/`:
//
//   - **One central `switch` per syntactic category** instead of the
//     `ts.SyntaxKind` tables, which is D2's decision carried from the checker.
//     `emitStatement` and `emitExpression` name every construct; the family
//     modules (`emit_control.ts`, `emit_strings.ts`, `emit_arrays.ts`,
//     `emit_classes.ts`, `emit_builtins.ts`) hold the lowerings.
//   - **The emitter is a class the families are given**, not an interface with
//     a table of closures. `Emitter` is `EmitContext` and `Emitter` at once,
//     because the language has no function values to separate them with.
//   - **Debug info is a field, not a table of hooks.** `-g` builds the DWARF
//     metadata in `self/debug.ts`, which stage0 reaches through an optional
//     `DebugInfo` and this emitter through a `DebugInfo | null` that every
//     call site narrows with `!== null`, because the language has no `?.`.
//     Where it attaches is the same three places: the `DISubprogram` and the
//     parameters at `emitFunction`, the `!dbg` location around every statement
//     and expression, and an `llvm.dbg.declare` beside each local's alloca.

import {
  functionAttributes,
  paramAttributes,
  returnAttributes,
  AnalysisUnit,
  FactsTable,
  FunctionFacts,
} from "./attributes";
import { DebugInfo } from "./debug";
import { marksTailCall, reclaimsReturnedString } from "./escape";
import { emitArrayLiteral, emitElementAccess, emitForOf } from "./emit_arrays";
import { emitBuiltinCall, emitIdentifierBuiltinCall, emitNamespaceProperty, isIdentifierBuiltinCall } from "./emit_builtins";
import {
  emitBreak,
  emitConditional,
  emitContinue,
  emitDo,
  emitFor,
  emitIf,
  emitSwitch,
  emitThrow,
  emitWhile,
} from "./emit_control";
import {
  emitConstructorPrologue,
  emitMethodCall,
  emitNew,
  emitObjectLiteral,
  emitPropertyAccess,
  structFunctions,
  structTypeDeclarations,
} from "./emit_classes";
import { constantText, emitAssignment, emitBinary, emitUnary, numericConstant } from "./emit_ops";
import {
  declareResultTypes,
  emitPackedResult,
  emitResultConstructor,
  emitResultMethod,
  emitResultProperty,
  emitResultReturn,
  emitResultReturningCall,
  isResultConstructorCall,
  privateResultAbi,
  unpackReturnedResult,
} from "./emit_result";
import { addStringConstant, emitTemplate } from "./emit_strings";
import { dottedName, isAssignmentOperator, receiverIsValue } from "./emit_util";
import { internalErrorFor } from "./ice";
import { IRBlock, IRFunction, IRModule, IRParam } from "./ir";
import { StringMap, StringSet } from "./map";
import {
  N_ARRAY,
  N_BINARY,
  N_BLOCK,
  N_BREAK,
  N_CALL,
  N_CONDITIONAL,
  N_CONSTRUCTOR,
  N_CONTINUE,
  N_DO,
  N_EMPTY,
  N_EXPR_STMT,
  N_FALSE,
  N_FOR,
  N_FOR_OF,
  N_IDENT,
  N_IF,
  N_INDEX,
  N_MEMBER,
  N_NEW,
  N_NULL,
  N_NUMBER,
  N_OBJECT,
  N_PAREN,
  N_RETURN,
  N_STRING,
  N_SUPER,
  N_SWITCH,
  N_TEMPLATE,
  N_THIS,
  N_THROW,
  N_TRUE,
  N_UNARY,
  N_VAR,
  N_WHILE,
  Node,
  nodeName,
} from "./nodes";
import { Options } from "./options";

import { CheckedProgram, FunctionSig, ROLE_CONSTRUCTOR, StructInfo } from "./program";
import {
  ARENA_GLOBAL,
  ARENA_GLOBAL_TLS,
  ARENA_TYPE,
  ARGV_GLOBAL,
  ARRAY_TYPE,
  inlineAllocator,
  inlineAllocatorAttrs,
  RuntimeTable,
} from "./runtime";
import { Local, STORAGE_PARAM } from "./symbols";
import { resolveTarget, targetHeader } from "./target";
import { T_VOID, TypeTable } from "./types";


/**
 * Branch targets of an enclosing loop, for `break` and `continue`. A `switch`
 * pushes one too, with no `continueBlock`: it catches `break` while `continue`
 * looks past it for the enclosing loop, as in JavaScript.
 */
export class LoopTarget {
  breakBlock: IRBlock;
  continueBlock: IRBlock | null;
  /** Set once a `break` has targeted this loop; an infinite loop without one never exits. */
  hasBreak: boolean;
  /**
   * The arena's `buf` and `off` at the top of the current pass when the
   * loop's passes are scoped (`emitPass`), and `""` otherwise; a `switch`
   * never has them.
   */
  markBuf: string;
  markOff: string;

  constructor(breakBlock: IRBlock, continueBlock: IRBlock | null) {
    this.breakBlock = breakBlock;
    this.continueBlock = continueBlock;
    this.hasBreak = false;
    this.markBuf = "";
    this.markOff = "";
  }

  scopesPass(): boolean {
    return this.markBuf.length > 0;
  }
}

export class Emitter {
  program: CheckedProgram;
  table: TypeTable;
  opts: Options;
  runtime: RuntimeTable;
  facts: FactsTable;
  module: IRModule;
  /** The function being emitted. */
  fn: IRFunction;
  /** Its facts: stack sites and the arena scope. */
  current: FunctionFacts;
  /** Its signature, which is how the prologue finds the class `this` belongs to. */
  currentSig: FunctionSig | null;
  /**
   * WP6: node id of the call this function's `return` lowers as a tail call,
   * or `-1` for none. See `planTailCall`.
   */
  tailCallId: i32;
  /** A scoped pass reads `@nish_arena` itself, so the module declares it even if it allocates nothing. */
  readsArenaGlobal: boolean;
  /** Enclosing loops, innermost last. */
  loops: LoopTarget[];
  /** Alloca slots of the locals of the function being emitted, by identity. */
  slotLocals: Local[];
  slotNames: string[];
  /** WP17: the unpacked object of each by-value `Result` parameter, by name. */
  paramObjectNames: string[];
  paramObjectValues: string[];
  /** Runtime symbols this module referenced; drives which declarations are emitted. */
  usedRuntime: StringSet;
  /** Interned string literals: text -> index into `stringRefs`. */
  strings: StringMap;
  stringRefs: string[];
  /** DWARF metadata builder (`-g`); `null` without debug info, and then nothing is attached. */
  debug: DebugInfo | null;

  constructor(unit: AnalysisUnit, table: TypeTable, opts: Options, runtime: RuntimeTable, facts: FactsTable) {
    this.program = unit.program;
    this.table = table;
    this.opts = opts;
    this.runtime = runtime;
    this.facts = facts;
    this.module = new IRModule(this.program.source.path);
    const noParams: IRParam[] = [];
    const noNames: string[] = [];
    this.fn = new IRFunction("", noParams, "void");
    this.current = new FunctionFacts(noNames, 0);
    this.currentSig = null;
    this.tailCallId = -1;
    this.loops = [];
    this.slotLocals = [];
    this.slotNames = [];
    this.paramObjectNames = [];
    this.paramObjectValues = [];
    this.usedRuntime = new StringSet();
    this.readsArenaGlobal = false;
    this.strings = new StringMap();
    this.stringRefs = [];
    this.debug = null;
    if (opts.debugInfo) {
      this.debug = new DebugInfo(this.module, this.program, table);
    }
    if (opts.target.length > 0) {
      // The driver validated the spec; an unknown one here is a programming error.
      const target = resolveTarget(opts.target);
      if (target === null) {
        process.exit(internalErrorFor(`emitter: unsupported target \`${opts.target}\``, opts.json));
      } else {
        this.module.targetHeader = targetHeader(target);
      }
    }
  }

  emitModule(): string {
    // `%struct.X = type { ... }` for every class or interface the module can see.
    for (const decl of structTypeDeclarations(this)) {
      this.module.addTypeDecl(decl);
    }
    for (const sig of this.program.functions) {
      if (sig.definedIn(this.program.source)) {
        // WP27 S1: a declared C function is a `declare`, not a `define`. It is
        // never an instantiation either — a foreign declaration cannot be
        // generic — so it needs none of the side-table installing below.
        if (sig.foreign()) {
          this.module.addDeclaration(this.foreignDeclarationFor(sig));
        } else {
          // WP18: an instantiation's body is the template's tree checked into
          // that instantiation's own side tables, so they are installed around
          // its emission and every `nodeTypes[node.id]` below answers for this
          // type-argument tuple.
          const instance = sig.instance;
          if (instance !== null) {
            this.program.enterInstance(instance);
          }
          this.module.addFunction(this.emitFunction(sig));
          if (instance !== null) {
            this.program.leaveInstance();
          }
        }
      }
    }
    const entry = this.program.entryMain;
    if (entry !== null) {
      this.module.addFunction(this.emitEntryWrapper(entry));
    }
    this.emitImportDeclarations();
    this.emitRuntimePrelude();
    return this.module.toText();
  }

  // ---- Functions ----------------------------------------------------------

  factsFor(sig: FunctionSig): FunctionFacts {
    const facts = this.facts.get(sig.name);
    if (facts !== null) {
      return facts;
    }
    process.exit(internalErrorFor(`emitter: no attribute facts for \`${sig.name}\` (was the whole program analysed?)`, this.opts.json));
  }

  /** Named types a signature mentions must be declared in the module (the array header). */
  declareSignatureTypes(sig: FunctionSig): void {
    if (this.table.isArray(sig.returnType)) {
      this.module.addTypeDecl(ARRAY_TYPE);
    }
    declareResultTypes(this, sig.returnType);
    for (const type of sig.paramTypes) {
      if (this.table.isArray(type)) {
        this.module.addTypeDecl(ARRAY_TYPE);
      }
      declareResultTypes(this, type);
    }
  }

  emitFunction(sig: FunctionSig): IRFunction {
    const facts = this.factsFor(sig);
    this.declareSignatureTypes(sig);
    const optimize = this.opts.optimizeAttributes;
    const params: IRParam[] = [];
    // A non-exported function uses the private per-arm `Result` ABI; the
    // condition is the linkage one below, and the two must not drift.
    const privateAbi = privateResultAbi(this, sig.visibleOutside());
    let i = 0;
    while (i < sig.paramNames.length) {
      // WP29: a compile-time function parameter is a position in the call and
      // no LLVM parameter; the body calls what it was bound to directly.
      if (sig.isCompileTime(i)) {
        i = i + 1;
        continue;
      }
      const name = sig.paramNames[i];
      const type = sig.paramTypes[i];
      let attrs: string[] = [];
      if (optimize) {
        attrs = paramAttributes(this.table, name, type, facts, privateAbi);
      }
      params.push(new IRParam(name, this.llvmAbi(type, privateAbi), attrs));
      i = i + 1;
    }
    this.fn = new IRFunction(sig.name, params, this.llvmAbi(sig.returnType, privateAbi));
    // Linkage: exported functions are always external (they are the module's
    // ABI). Every other function is `internal` unless --no-strict-exports.
    // WP29: a function another module's instantiation calls is `hidden`
    // instead — in the final link, and exported from nothing.
    if (sig.hidden) {
      this.fn.linkage = "hidden";
    } else if (this.opts.strictExports && !sig.exported) {
      this.fn.linkage = "internal";
    }
    if (optimize) {
      this.fn.returnAttrs = returnAttributes(this.table, sig.returnType, facts.returnDeref, privateAbi, facts.returnAlign);
      this.fn.attrGroup = this.module.attrGroupFor(functionAttributes(facts));
    }
    this.slotLocals = [];
    this.slotNames = [];
    this.loops = [];
    this.current = facts;
    this.currentSig = sig;
    this.tailCallId = -1;
    // `-g`: the DISubprogram, the function's default location, and the parameters' dbg.value calls.
    const debug = this.debug;
    if (debug !== null) {
      debug.beginFunction(this.fn, sig, false, "", privateAbi);
    }

    // WP6: an automatic arena scope remembers the bump position before anything is allocated.
    if (facts.arenaScope) {
      this.fn.emit(`%arena.mark = call i64 ${this.useRuntime("nish_arena_mark")}()`);
    }
    // WP17: a `Result` parameter small enough to pack arrives as an `i64`, or
    // as the tag and one slot per arm under the private ABI. Either way it is
    // unpacked once, before the body, into the object every construct reads.
    this.paramObjectNames = [];
    this.paramObjectValues = [];
    i = 0;
    while (i < sig.paramNames.length) {
      const name = sig.paramNames[i];
      if (this.table.resultByValue(sig.paramTypes[i])) {
        const object = unpackReturnedResult(
          this,
          sig.paramTypes[i],
          `%${name}`,
          facts.isStackParam(name),
          privateAbi
        );
        this.paramObjectNames.push(name);
        this.paramObjectValues.push(object);
      }
      i = i + 1;
    }
    // A constructor stores the field initializers before its body runs.
    if (sig.role === ROLE_CONSTRUCTOR) {
      emitConstructorPrologue(this, sig);
    }
    const body = sig.decl.kind === N_CONSTRUCTOR ? sig.decl.children[1] : sig.decl.children[3];
    // A concise arrow body is the one `return` it means.
    if (body.kind === N_BLOCK) {
      this.emitBlock(body);
    } else {
      this.emitReturnValue(body);
    }

    // Void functions may fall off the end; give them an explicit terminator.
    if (!this.fn.currentBlock().terminated()) {
      this.emitScopeExit();
      this.fn.emit("ret void");
    }
    return this.fn;
  }

  isStackSite(node: Node): boolean {
    return this.current.isStackSite(node);
  }

  /**
   * WP9 call-site reclaim: the bump position before a call whose returned
   * string the caller may keep, or the empty string when the call does not
   * qualify. It is emitted *after* the arguments, so nothing but what the
   * callee itself allocates falls inside the bracket, and the caller's own
   * temporaries are never at risk. `reclaimsReturnedString` in escape.ts
   * carries the proof.
   */
  beginReclaim(callee: FunctionSig): string {
    if (!reclaimsReturnedString(callee, this.facts)) {
      return "";
    }
    return this.fn.emitValue(`call i64 ${this.useRuntime("nish_arena_mark")}()`);
  }

  /**
   * Reclaim back to `mark`, keeping the returned string, which moves down to
   * the mark. The call's value is replaced by the string's new address, so no
   * later instruction can name the old one, and every temporary the callee
   * bumped underneath it is released.
   */
  endReclaim(mark: string, value: string): string {
    if (mark.length === 0) {
      return value;
    }
    return this.fn.emitValue(`call i8* ${this.useRuntime("nish_arena_keep")}(i64 ${mark}, i8* ${value})`);
  }

  /**
   * WP6: decide whether the call this `return` answers with is the last thing
   * the function does, and record it so that `emitCall` marks it `tail` and
   * emits the scope release ahead of it. Tail position is what the return
   * emitter knows and the call emitter does not, so it is told rather than
   * looked up: `value` is the whole value of a `return`, or the concise arrow
   * body that means one (docs/wp22-arrow-functions.md). Everything else is
   * `marksTailCall`'s proof in escape.ts.
   */
  planTailCall(value: Node): boolean {
    this.tailCallId = -1;
    let inner = value;
    while (inner.kind === N_PAREN) {
      inner = inner.children[0];
    }
    if (inner.kind !== N_CALL) {
      return false;
    }
    const callee = this.program.nodeCallees[inner.id];
    if (callee === null) {
      return false;
    }
    const argTypes: i32[] = [];
    for (const arg of inner.children[1].children) {
      argTypes.push(this.typeOf(arg));
    }
    if (!marksTailCall(this.table, this.current, callee, argTypes, this.facts)) {
      return false;
    }
    // The release a tail call sinks ahead of itself is a pass's too, inside a
    // scoped loop, and the callee reading the bump position is what
    // `marksTailCall` refuses for the function's scope.
    const g = this.facts.get(callee.name);
    if (this.outermostPass() !== null && g !== null && g.readsArenaState) {
      return false;
    }
    this.tailCallId = inner.id;
    return true;
  }

  /**
   * WP6: whether `planTailCall` chose this call, asked once its arguments are
   * lowered. Such a call is marked `tail` and the automatic arena scope, if
   * there is one, releases ahead of it.
   */
  marksTailCall(expr: Node): boolean {
    return expr.id === this.tailCallId;
  }

  /**
   * Leave every arena scope open at a `return`: the function's own when it
   * has one, the outermost scoped pass otherwise. One release is all of them,
   * because the outermost mark is the lowest and releasing to it frees
   * everything bumped since, the inner passes' memory included.
   */
  emitScopeExit(): void {
    if (this.current.arenaScope) {
      this.fn.emit(`call void ${this.useRuntime("nish_arena_release")}(i64 %arena.mark)`);
      return;
    }
    const pass = this.outermostPass();
    if (pass !== null) {
      this.releasePass(pass);
    }
  }

  /**
   * The C-ABI process entry, with the signature every libc start-up expects.
   * When the program reads `process.argv`, `nish_argv_init(argc, argv)` builds
   * the string array before the user's `main` runs. The attributes are
   * deliberately minimal: the wrapper calls the runtime, so it is neither pure
   * nor provably returning.
   */
  emitEntryWrapper(userMain: FunctionSig): IRFunction {
    const optimize = this.opts.optimizeAttributes;
    const attrs: string[] = [];
    if (optimize) {
      attrs.push("noundef");
    }
    const params: IRParam[] = [];
    params.push(new IRParam("argc", "i32", attrs));
    params.push(new IRParam("argv", "i8**", attrs));
    const fn = new IRFunction("main", params, "i32");
    if (optimize) {
      const returnAttrs: string[] = [];
      returnAttrs.push("noundef");
      fn.returnAttrs = returnAttrs;
      const group: string[] = [];
      group.push("nounwind");
      fn.attrGroup = this.module.attrGroupFor(group);
    }
    // `-g`: an artificial subprogram at the user's `main`, so `break main` lands somewhere sensible.
    const debug = this.debug;
    if (debug !== null) {
      debug.beginFunction(fn, userMain, true, "main", false);
    }
    const freeArena = this.useRuntime("nish_free_arena");
    if (this.program.usesArgv) {
      fn.emit(`call void ${this.useRuntime("nish_argv_init")}(i32 %argc, i8** %argv)`);
    }
    let code = "0";
    if (userMain.returnType === T_VOID) {
      fn.emit(`call void @${userMain.name}()`);
    } else {
      code = fn.emitValue(`call i32 @${userMain.name}()`);
    }
    fn.emit(`call void ${freeArena}()`);
    fn.emit(`ret i32 ${code}`);
    return fn;
  }

  // ---- Imports ------------------------------------------------------------

  /**
   * One `declare` per distinct imported symbol, with the exporter's
   * attributes. An imported class contributes its constructor and every
   * method; an imported interface contributes nothing but its type, and an
   * imported constant nothing at all — it was folded into every use site, so
   * there is no symbol to link against.
   */
  emitImportDeclarations(): void {
    const seen = new StringSet();
    for (const imp of this.program.imports) {
      if (imp.constant !== null) {
        continue;
      }
      // A builtin import declares nothing: the call it names lowers the same
      // way the global spelling does, to an intrinsic or a `nish_*` symbol the
      // runtime table already declares on first use.
      if (imp.builtin !== null) {
        continue;
      }
      // WP18 G7: an imported template declares nothing by itself. One name
      // becomes a symbol per distinct type-argument tuple, and the tuples this
      // module actually asked for are declared below — the functions through
      // `externalInstances`, an instantiated class's members through
      // `reachableStructs`, exactly as an imported declared class's are.
      if (imp.template !== null || imp.structTemplate !== null) {
        continue;
      }
      const struct = imp.struct;
      const sig = imp.sig;
      if (struct !== null) {
        this.declareAll(structFunctions(struct), seen);
      } else if (sig !== null) {
        const one: FunctionSig[] = [];
        one.push(sig);
        this.declareAll(one, seen);
      } else {
        process.exit(internalErrorFor(`emitter: unbound import \`${imp.importedName}\` from \`${imp.specifier}\``, this.opts.json));
      }
    }
    // WP18 G7: an instantiation this module calls and another module defines.
    // It hangs off no `ImportBinding`, because one imported template becomes a
    // symbol per distinct type-argument tuple rather than a symbol per name, so
    // the checker collected the ones this module actually asked for.
    this.declareAll(this.program.externalInstances, seen);
    // A struct this module never named but can hold values of: its methods and
    // constructor are defined by whichever module declared it, so they are
    // `declare`d here for the same reason an imported class's are.
    for (const index of this.program.reachableStructs) {
      this.declareAll(structFunctions(this.program.structList[index]), seen);
    }
  }

  declareAll(sigs: FunctionSig[], seen: StringSet): void {
    for (const sig of sigs) {
      if (seen.add(sig.name)) {
        // WP29: a C function passed to another module's template is declared
        // there as C's, with no attribute this compiler cannot prove.
        this.module.addDeclaration(sig.foreign() ? this.foreignDeclarationFor(sig) : this.declarationFor(sig));
      }
    }
  }

  /**
   * `declare <ret> @name(<params>) #N` from the same signature and facts the
   * exporter used for its `define`, so the two agree attribute for attribute
   * (parameter names are omitted, as clang does for declarations).
   */
  /**
   * `declare <ret> @name(<params>)` for a `declare function` (WP27 S1), with no
   * parameter attributes, no return attributes and no attribute group.
   *
   * The emptiness is "no attribute without a proof" applied to a body this
   * compiler cannot see: not `nounwind` (a C++ callee may unwind — undefined
   * here by decision, see `self/attributes.ts`), not `willreturn` (it may exit
   * or spin), not `readnone` (it may do anything to memory). `declarationFor`
   * below is the opposite case: an *imported* Nish function, whose `define` this
   * same compiler wrote, so its attributes are facts and must match.
   */
  foreignDeclarationFor(sig: FunctionSig): string {
    const params: string[] = [];
    let i = 0;
    while (i < sig.paramNames.length) {
      params.push(this.llvmAbi(sig.paramTypes[i], false));
      i = i + 1;
    }
    return `declare ${this.llvmAbi(sig.returnType, false)} @${sig.name}(${params.join(", ")})`;
  }

  declarationFor(sig: FunctionSig): string {
    const facts = this.factsFor(sig);
    this.declareSignatureTypes(sig);
    const optimize = this.opts.optimizeAttributes;
    const params: string[] = [];
    let i = 0;
    while (i < sig.paramNames.length) {
      if (sig.isCompileTime(i)) {
        i = i + 1;
        continue;
      }
      const parts: string[] = [this.llvmAbi(sig.paramTypes[i], false)];
      if (optimize) {
        for (const attr of paramAttributes(this.table, sig.paramNames[i], sig.paramTypes[i], facts, false)) {
          parts.push(attr);
        }
      }
      params.push(parts.join(" "));
      i = i + 1;
    }
    const ret: string[] = [];
    if (optimize) {
      for (const attr of returnAttributes(this.table, sig.returnType, facts.returnDeref, false, facts.returnAlign)) {
        ret.push(attr);
      }
    }
    ret.push(this.llvmAbi(sig.returnType, false));
    const group = optimize ? ` ${this.module.attrGroupFor(functionAttributes(facts))}` : "";
    return `declare ${ret.join(" ")} @${sig.name}(${params.join(", ")})${group}`;
  }

  // ---- Runtime ABI --------------------------------------------------------

  useRuntime(name: string): string {
    this.usedRuntime.add(name);
    return `@${name}`;
  }

  stringConstant(text: string): string {
    const at = this.strings.get(text, -1);
    if (at >= 0) {
      return this.stringRefs[at];
    }
    const index = this.stringRefs.length;
    const ref = addStringConstant(this.module, index, text);
    this.strings.set(text, index);
    this.stringRefs.push(ref);
    return ref;
  }

  declare(text: string): void {
    this.module.addDeclaration(text);
  }

  declareType(text: string): void {
    this.module.addTypeDecl(text);
  }

  declareGlobal(text: string): void {
    this.module.addGlobal(text);
  }

  /** Intern a module metadata node and return its `!N` reference; identical texts share a node. */
  metadata(text: string): string {
    return this.module.addMetadata(text);
  }

  emitRuntimePrelude(): void {
    const all = this.opts.runtimeDecls;
    const wantsAlloc = all || this.usedRuntime.has("nish_alloc_struct");
    if (wantsAlloc) {
      this.usedRuntime.add("nish_arena_grow");
    }
    if (wantsAlloc || this.readsArenaGlobal) {
      this.module.addTypeDecl(ARENA_TYPE);
      // WP20 T0: `--threads` gives every thread its own arena, and the only
      // thing that changes in the IR is this declaration.
      if (this.opts.threads) {
        this.module.addGlobal(ARENA_GLOBAL_TLS);
      } else {
        this.module.addGlobal(ARENA_GLOBAL);
      }
    }
    // The array header type is referenced by `nish_array_grow`'s declaration.
    if (all || this.usedRuntime.has("nish_array_grow")) {
      this.module.addTypeDecl(ARRAY_TYPE);
    }
    // `@nish_argv` is part of the C ABI too; modules that read `process.argv` declared it already.
    if (all) {
      this.module.addGlobal(ARGV_GLOBAL);
    }
    for (const rt of this.runtime.functions) {
      // Intrinsics are not part of the C ABI prelude: declared only when used.
      if (!this.usedRuntime.has(rt.name) && (!all || rt.intrinsic)) {
        continue;
      }
      const group = this.opts.optimizeAttributes ? ` ${this.module.attrGroupFor(rt.attrs)}` : "";
      this.module.addDeclaration(`${rt.signature}${group}`);
    }
    if (wantsAlloc) {
      this.module.addRawDefinition(inlineAllocator(this.module.attrGroupFor(inlineAllocatorAttrs())));
    }
  }

  // ---- Dispatch -----------------------------------------------------------

  emitBlock(block: Node): void {
    for (const stmt of block.children) {
      this.emitStatement(stmt);
    }
  }

  /**
   * Lower one statement, under its own `-g` location. The dispatch is split out
   * so the location is restored on every path: the `switch` below returns from
   * each arm, and `src/` gets the same shape for free from its handler table.
   */
  emitStatement(stmt: Node): void {
    const saved = this.enterLocation(stmt);
    if (this.current.loopScopes.length > 0 && this.current.scopesPass(stmt)) {
      this.emitPass(stmt);
    } else {
      this.emitStatementKind(stmt);
    }
    this.fn.setLocation(saved);
  }

  /**
   * One pass of a loop whose passes are scoped (`decideLoopScopes`, escape.ts):
   * the mark first, so that it dominates every release in the body, and the
   * release before the back-edge when the body falls through. The loop is the
   * innermost target, pushed by its emitter before the body; `break`,
   * `continue` and `return` release on their own edges.
   *
   * The mark is the arena's `buf` and `off`, read inline rather than through
   * `nish_arena_mark`, because a pass is short: two runtime calls cost a
   * short loop that drops one small array per pass twice its time, where
   * these loads and the rewind in `releasePass` cost nothing measurable.
   */
  emitPass(body: Node): void {
    const loop = this.loops[this.loops.length - 1];
    this.readsArenaGlobal = true;
    loop.markBuf = this.fn.emitValue(`load i8*, i8** ${this.arenaField(0)}, align 8`);
    loop.markOff = this.fn.emitValue(`load i64, i64* ${this.arenaField(1)}, align 8`);
    this.emitStatementKind(body);
    if (!this.fn.currentBlock().terminated()) {
      this.releasePass(loop);
    }
  }

  /**
   * Rewind the arena to the top of `loop`'s pass. `buf` is the newest chunk,
   * and a chunk is only ever pushed in front of the others (`nish_arena_grow`),
   * so a `buf` unchanged since the mark means every chunk the pass pushed is
   * gone again and rewinding `off` is the whole release. Otherwise the runtime
   * frees the newer chunks: `nish_arena_release` of `buf + off`, which is the
   * mark `nish_arena_mark` answers, `0` for an arena that had no chunk yet.
   */
  releasePass(loop: LoopTarget): void {
    const fn = this.fn;
    const rewind = fn.newBlock("pass.rewind");
    const free = fn.newBlock("pass.free");
    const done = fn.newBlock("pass.done");
    const buf = fn.emitValue(`load i8*, i8** ${this.arenaField(0)}, align 8`);
    const same = fn.emitValue(`icmp eq i8* ${buf}, ${loop.markBuf}`);
    fn.emit(`br i1 ${same}, label %${rewind.label}, label %${free.label}`);
    fn.placeBlock(rewind);
    fn.emit(`store i64 ${loop.markOff}, i64* ${this.arenaField(1)}, align 8`);
    fn.emit(`br label %${done.label}`);
    fn.placeBlock(free);
    const base = fn.emitValue(`ptrtoint i8* ${loop.markBuf} to i64`);
    const mark = fn.emitValue(`add i64 ${base}, ${loop.markOff}`);
    fn.emit(`call void ${this.useRuntime("nish_arena_release")}(i64 ${mark})`);
    fn.emit(`br label %${done.label}`);
    fn.placeBlock(done);
  }

  /** The address of field `index` of `@nish_arena`: `buf` is 0, `off` is 1. */
  arenaField(index: i32): string {
    return this.fn.emitValue(
      `getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 ${index}`
    );
  }

  /** The outermost scoped pass being emitted, or null. */
  outermostPass(): LoopTarget | null {
    for (const loop of this.loops) {
      if (loop.scopesPass()) {
        return loop;
      }
    }
    return null;
  }

  emitStatementKind(stmt: Node): void {
    switch (stmt.kind) {
      case N_RETURN:
        this.emitReturn(stmt);
        return;
      case N_VAR:
        this.emitVariableDeclarations(stmt.children[0]);
        return;
      case N_EXPR_STMT:
        this.emitExpression(stmt.children[0]);
        return;
      case N_BLOCK:
        this.emitBlock(stmt);
        return;
      case N_IF:
        emitIf(this, stmt);
        return;
      case N_WHILE:
        emitWhile(this, stmt);
        return;
      case N_DO:
        emitDo(this, stmt);
        return;
      case N_FOR:
        emitFor(this, stmt);
        return;
      case N_FOR_OF:
        emitForOf(this, stmt);
        return;
      case N_SWITCH:
        emitSwitch(this, stmt);
        return;
      case N_BREAK:
        emitBreak(this);
        return;
      case N_CONTINUE:
        emitContinue(this);
        return;
      case N_THROW:
        emitThrow(this, stmt);
        return;
      default:
        process.exit(internalErrorFor(`emitter: unexpected statement ${nodeName(stmt.kind)}`, this.opts.json));
    }
  }

  /** `return e`: the value first (it may allocate), then the arena scope release, then `ret`. */
  emitReturn(stmt: Node): void {
    const value = stmt.children[0];
    if (value.kind === N_EMPTY) {
      this.emitScopeExit();
      this.fn.emit("ret void");
      return;
    }
    this.emitReturnValue(value);
  }

  /**
   * The value half of a `return`, shared with the concise arrow body, which
   * lowers to exactly the instructions the block with one `return` it means
   * lowers to (docs/wp22-arrow-functions.md).
   */
  emitReturnValue(value: Node): void {
    const sig = this.currentSig;
    if (sig === null) {
      process.exit(internalErrorFor("emitter: `return` outside a function", this.opts.json));
    }
    // WP17: a small `Result` leaves in a register. It is built before the
    // scope release, because the object it may be read out of is arena memory
    // the release reclaims.
    if (this.table.resultByValue(sig.returnType)) {
      const packed = emitPackedResult(this, value, sig.returnType, privateResultAbi(this, sig.visibleOutside()));
      this.emitScopeExit();
      emitResultReturn(this, packed);
      return;
    }
    const type = this.typeOf(value);
    // WP6: a tail call is marked `tail` and takes the scope release with it,
    // ahead of the call, so this `return` emits none of its own. Decided
    // before the expression is lowered, because that is when `emitCall` needs
    // the answer.
    const sunk = this.planTailCall(value);
    const result = this.emitExpression(value);
    if (!sunk) {
      this.emitScopeExit();
    }
    // `return g()` where `g` answers nothing is a `ret` with no operand: the
    // call is the whole of the statement, and `emitExpression` answers the
    // marker string `"void"` for it rather than a value. Writing that marker
    // after `ret void` is what made this one shape assemble to nothing at all.
    if (type === T_VOID) {
      this.fn.emit("ret void");
    } else {
      this.fn.emit(`ret ${this.llvm(type)} ${result}`);
    }
  }

  /**
   * `let`/`const`: an alloca hoisted into the entry block plus a store. The
   * alloca is named after the variable so temp numbering is unaffected.
   * Shared by variable statements and `for` initializers.
   */
  emitVariableDeclarations(list: Node): void {
    for (const decl of list.children) {
      const local = this.program.nodeLocals[decl.id];
      if (local === null) {
        process.exit(internalErrorFor("emitter: a variable declaration with no local recorded", this.opts.json));
      } else {
        const ty = this.llvm(local.type);
        const slot = this.fn.emitAlloca(`${local.name}.addr`, ty, this.align(local.type));
        this.setSlot(local, slot);
        const init = this.emitExpression(decl.children[2]);
        this.fn.emit(`store ${ty} ${init}, ${ty}* ${slot}${this.alignSuffix(local.type)}`);
        const debug = this.debug;
        if (debug !== null) {
          debug.declareLocal(this.fn, local, slot, decl); // `-g`: llvm.dbg.declare on the slot
        }
      }
    }
  }

  /** Lower an expression and answer the LLVM value holding its result. */
  emitExpression(expr: Node): string {
    const saved = this.enterLocation(expr);
    const value = this.emitRawExpression(expr);
    // A class value used as an interface it implements: the interface's fields
    // are its first fields, so the recorded conversion is a pointer bitcast.
    const from = this.program.nodeCoercions[expr.id];
    let result = value;
    if (from >= 0) {
      result = this.fn.emitValue(`bitcast ${this.llvm(from)} ${value} to ${this.llvm(this.typeOf(expr))}`);
    }
    this.fn.setLocation(saved);
    return result;
  }

  /**
   * `-g`: make `node`'s start the debug location of the instructions emitted
   * for it, and answer the location to restore afterwards so the enclosing
   * construct's own instructions (a loop's back edge, a `store` after its
   * initializer) point at the enclosing node again. Without `-g` this is a
   * no-op and the location stays empty.
   */
  enterLocation(node: Node): string {
    const saved = this.fn.location();
    const debug = this.debug;
    if (debug !== null) {
      this.fn.setLocation(debug.locationOf(node));
    }
    return saved;
  }

  emitRawExpression(expr: Node): string {
    switch (expr.kind) {
      case N_PAREN:
        return this.emitExpression(expr.children[0]);
      case N_NUMBER:
        return numericConstant(expr.text, this.typeOf(expr));
      case N_TRUE:
        return "true";
      case N_FALSE:
        return "false";
      case N_NULL:
        return "null"; // `null` of a `T | null` type: the pointer constant
      case N_STRING:
        return this.stringConstant(expr.text);
      case N_TEMPLATE:
        return emitTemplate(this, expr);
      case N_IDENT:
        return this.emitIdentifier(expr);
      case N_THIS:
        return "%this";
      case N_UNARY:
        return emitUnary(this, expr);
      case N_BINARY:
        return this.emitBinaryExpression(expr);
      case N_CONDITIONAL:
        return emitConditional(this, expr);
      case N_CALL:
        return this.emitCall(expr);
      case N_NEW:
        return emitNew(this, expr);
      case N_MEMBER:
        return this.emitMember(expr);
      case N_INDEX:
        return emitElementAccess(this, expr);
      case N_ARRAY:
        return emitArrayLiteral(this, expr);
      case N_OBJECT:
        return emitObjectLiteral(this, expr);
      default:
        process.exit(internalErrorFor(`emitter: unexpected expression ${nodeName(expr.kind)}`, this.opts.json));
    }
  }

  /**
   * Parameters are SSA values; locals are loaded from their alloca slot; a
   * module constant is neither, because the checker already folded it — the
   * name lowers to the value, with no global and no load.
   */
  emitIdentifier(expr: Node): string {
    const constant = this.program.nodeConstants[expr.id];
    if (constant !== null) {
      return constantText(this, constant);
    }
    // `import { argv } from "nish:process"`: the same load as `process.argv`,
    // reached by a name instead of a dot.
    const builtin = this.program.nodeBuiltins[expr.id];
    if (builtin.length > 0) {
      return emitNamespaceProperty(this, expr, builtin);
    }
    const local = this.program.nodeLocals[expr.id];
    if (local !== null) {
      if (local.storage === STORAGE_PARAM) {
        // WP17: a by-value `Result` parameter *is* a pointer to the object the
        // prologue unpacked it into, so the name lowers to that value.
        const object = this.paramObject(local.name);
        return object.length > 0 ? object : `%${local.name}`;
      }
      const ty = this.llvm(local.type);
      return this.fn.emitValue(`load ${ty}, ${ty}* ${this.slotOf(local)}${this.alignSuffix(local.type)}`);
    }
    process.exit(internalErrorFor(`emitter: no binding for \`${expr.text}\``, this.opts.json));
  }

  emitBinaryExpression(expr: Node): string {
    return isAssignmentOperator(expr.text) ? emitAssignment(this, expr) : emitBinary(this, expr);
  }

  emitMember(expr: Node): string {
    if (!receiverIsValue(this.program, expr.children[0])) {
      // WP23: `Kind.If` was folded by the checker, so it lowers to its integer
      // with no global and no load — the arrangement a module constant has.
      if (this.program.isEnumMember(this.table, expr)) {
        return `${this.program.nodeEnumValues[expr.id]}`;
      }
      return emitNamespaceProperty(this, expr, dottedName(expr));
    }
    if (this.table.isResult(this.typeOf(expr.children[0]))) {
      return emitResultProperty(this, expr, this.typeOf(expr.children[0])); // WP16
    }
    return emitPropertyAccess(this, expr);
  }

  emitCall(expr: Node): string {
    const callee = expr.children[0];
    if (callee.kind === N_MEMBER) {
      if (!receiverIsValue(this.program, callee.children[0])) {
        return emitBuiltinCall(this, expr, dottedName(callee));
      }
      const receiver = this.typeOf(callee.children[0]);
      if (this.table.isResult(receiver)) {
        return emitResultMethod(this, expr, receiver); // WP16
      }
      return emitMethodCall(this, expr);
    }
    if (isResultConstructorCall(this.program, this.table, expr)) {
      return emitResultConstructor(this, expr, callee.text); // WP16: `Ok(v)` / `Err(e)`
    }
    // Under a `nish:` import the identifier is the local name, so the checker
    // recorded which builtin it is. A dotted one (`process.exit`) then goes to
    // the emitter for dotted callees: the import is what let the program call
    // it without writing the dot.
    const imported = this.program.nodeBuiltins[expr.id];
    if (imported.length > 0) {
      // A dotted canonical name (`process.exit`) belongs to the emitter for
      // dotted callees; the import is what let the program call it without
      // writing the dot.
      return imported.indexOf(".") < 0
        ? emitIdentifierBuiltinCall(this, expr, imported)
        : emitBuiltinCall(this, expr, imported);
    }
    if (isIdentifierBuiltinCall(this.program, expr)) {
      return emitIdentifierBuiltinCall(this, expr, callee.text);
    }
    const sig = this.program.nodeCallees[expr.id];
    if (sig === null) {
      process.exit(internalErrorFor(`emitter: no callee recorded for \`${callee.text}\``, this.opts.json));
    }
    const args = expr.children[1];
    const operands: string[] = [];
    // A non-exported callee takes and answers one slot per arm (WP15).
    const calleePrivate = privateResultAbi(this, sig.visibleOutside());
    let i = 0;
    while (i < args.children.length) {
      // WP29: a function argument chose which function this call reaches, and
      // that is the whole of it: there is no value to pass.
      if (sig.isCompileTime(i)) {
        i = i + 1;
        continue;
      }
      // WP17: an argument feeding a `Result` parameter the ABI packs is passed
      // as the word, exactly as a `return` of one is — or as the arms when the
      // callee uses the private ABI.
      const want = sig.paramTypes[i];
      const value = this.table.resultByValue(want)
        ? emitPackedResult(this, args.children[i], want, calleePrivate)
        : this.emitExpression(args.children[i]);
      operands.push(`${this.llvmAbi(want, calleePrivate)} ${value}`);
      i = i + 1;
    }
    // WP6: this call is the whole of a `return` and the proof in escape.ts
    // (`marksTailCall`) clears, so it is the last thing the function does. Two
    // things follow. The arena scope, if there is one, releases here — after
    // the arguments and before the call, rather than between the call and the
    // `ret`; `emitScopeExit` is a no-op for a function that has no scope,
    // which is the majority of the calls marked below. And the call carries
    // `tail`, which says the callee cannot reach this frame's stack slots, so
    // the frame may go before the jump. It is never both this and the reclaim
    // below: the proof excludes a callee the reclaim would bracket.
    const tail = this.marksTailCall(expr);
    if (tail) {
      this.emitScopeExit();
    }
    // WP9: the mark goes after the arguments, so only the callee's own bumps
    // are inside the bracket (`beginReclaim`).
    const mark = this.beginReclaim(sig);
    const marker = tail ? "tail " : "";
    const call = `${marker}call ${this.llvmAbi(sig.returnType, calleePrivate)} @${sig.name}(${operands.join(", ")})`;
    if (sig.returnType === T_VOID) {
      this.fn.emit(call);
      return "void";
    }
    // WP17: a small `Result` comes back in a register; unpack it into the
    // caller's own object, which is what every other construct reads.
    if (this.table.resultByValue(sig.returnType)) {
      return emitResultReturningCall(this, call, sig.returnType, expr, calleePrivate);
    }
    return this.endReclaim(mark, this.fn.emitValue(call));
  }

  // ---- Context helpers ----------------------------------------------------

  slotOf(local: Local): string {
    let i = this.slotLocals.length - 1;
    while (i >= 0) {
      if (this.slotLocals[i] === local) {
        return this.slotNames[i];
      }
      i = i - 1;
    }
    process.exit(internalErrorFor(`emitter: no slot for local \`${local.name}\``, this.opts.json));
  }

  setSlot(local: Local, slot: string): void {
    this.slotLocals.push(local);
    this.slotNames.push(slot);
  }

  typeOf(expr: Node): i32 {
    const type = this.program.nodeTypes[expr.id];
    if (type < 0) {
      process.exit(internalErrorFor(`emitter: no type recorded for ${nodeName(expr.kind)}`, this.opts.json));
    }
    return type;
  }

  llvm(type: i32): string {
    return this.table.llvmType(type);
  }

  /** WP17: the unpacked object of a by-value `Result` parameter, or "". */
  paramObject(name: string): string {
    let i = 0;
    while (i < this.paramObjectNames.length) {
      if (this.paramObjectNames[i] === name) {
        return this.paramObjectValues[i];
      }
      i = i + 1;
    }
    return "";
  }

  /** The LLVM type at a call boundary: `i64` for a `Result` the ABI packs (WP17). */
  llvmAbi(type: i32, privateAbi: boolean): string {
    return this.table.llvmAbiType(type, privateAbi);
  }

  /** Alignment for a type, or 0 when attributes are disabled. */
  align(type: i32): i32 {
    return this.opts.optimizeAttributes ? this.table.alignOf(type) : 0;
  }

  alignSuffix(type: i32): string {
    const a = this.align(type);
    return a > 0 ? `, align ${a}` : "";
  }

  /** `, align 8` for the header fields and data of the runtime structures. */
  align8(): string {
    return this.opts.optimizeAttributes ? ", align 8" : "";
  }
}

/** Emit one module of a checked program. */
export const emitProgram = (
  unit: AnalysisUnit,
  table: TypeTable,
  opts: Options,
  runtime: RuntimeTable,
  facts: FactsTable
): string => {
  const emitter = new Emitter(unit, table, opts, runtime, facts);
  return emitter.emitModule();
};
