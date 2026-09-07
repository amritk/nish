// Locals and the lexical scope chain for stage1 (docs/wp14-selfhost.md,
// milestone S3), ported from `src/checker/scope.ts` and the `LocalVar` of
// `src/checker/program.ts`.
//
// A scope also carries **narrowings**: inside `if (p !== null) { ... }` a
// nullable local reads as its non-null type. A narrowing belongs to the scope
// of the region it holds in and is looked up through the chain like a
// variable, and an assignment to the variable drops it from whichever scope
// owns it, so the statements after see the declared type again. That is the
// rule `docs/LANGUAGE.md` states under "Nullable types", and it is the whole
// reason a scope is more than a name table.
//
// Narrowings are keyed by **identity**, as they are in `src/`, and identity is
// what `===` on a class value already gives. The lists are short — one scope
// holds the narrowings of one region — so a scan beats a second hash table,
// and it keeps a `Local` free of a field that exists only to be its own key.

import { StringMap } from "./map";

/** A parameter is an SSA value; a `let` or `const` lives in an alloca slot. */
export const STORAGE_PARAM: i32 = 0;
export const STORAGE_LOCAL: i32 = 1;

export class Local {
  name: string;
  /** A `TypeTable` id, the type as declared. `Scope.typeOf` may narrow it. */
  type: i32;
  mutable: boolean;
  storage: i32;

  constructor(name: string, type: i32, mutable: boolean, storage: i32) {
    this.name = name;
    this.type = type;
    this.mutable = mutable;
    this.storage = storage;
  }
}

export class Scope {
  parent: Scope | null;
  /** Name -> index into `locals`. */
  names: StringMap;
  locals: Local[];
  /** Narrowed variables and the types they read as, in the same order. */
  narrowedVars: Local[];
  narrowedTypes: i32[];

  constructor(parent: Scope | null) {
    this.parent = parent;
    this.names = new StringMap();
    this.locals = [];
    this.narrowedVars = [];
    this.narrowedTypes = [];
  }

  child(): Scope {
    return new Scope(this);
  }

  /** The variable `name` refers to, innermost scope first, or `null`. */
  lookup(name: string): Local | null {
    const index = this.names.get(name, -1);
    if (index >= 0) {
      return this.locals[index];
    }
    const parent = this.parent;
    if (parent !== null) {
      return parent.lookup(name);
    }
    return null;
  }

  /** Whether this scope — not the chain — already declares `name`. */
  declaresHere(name: string): boolean {
    return this.names.has(name);
  }

  /**
   * Declare `local`, answering false when this scope already has that name.
   * `src/` throws a `CompileError` here; D1's threading makes it a status the
   * caller reports against the declaration it is looking at, which is the
   * node with the right span anyway.
   */
  declare(local: Local): boolean {
    if (this.names.has(local.name)) {
      return false;
    }
    this.names.set(local.name, this.locals.length);
    this.locals.push(local);
    return true;
  }

  /** The position of `variable` in this scope's narrowings, or -1. */
  narrowingIndex(variable: Local): i32 {
    let i = 0;
    while (i < this.narrowedVars.length) {
      if (this.narrowedVars[i] === variable) {
        return i;
      }
      i = i + 1;
    }
    return -1;
  }

  /** Record that `variable` reads as `type` for the rest of this scope. */
  narrow(variable: Local, type: i32): void {
    const at = this.narrowingIndex(variable);
    if (at >= 0) {
      this.narrowedTypes[at] = type;
      return;
    }
    this.narrowedVars.push(variable);
    this.narrowedTypes.push(type);
  }

  /** The type `variable` currently reads as: the innermost narrowing, else its declared type. */
  typeOf(variable: Local): i32 {
    const at = this.narrowingIndex(variable);
    if (at >= 0) {
      return this.narrowedTypes[at];
    }
    const parent = this.parent;
    if (parent !== null) {
      return parent.typeOf(variable);
    }
    return variable.type;
  }

  /**
   * Drop every narrowing of `variable` in the chain: it was assigned, so
   * nothing proved about its old value holds any more.
   */
  clearNarrowing(variable: Local): void {
    const at = this.narrowingIndex(variable);
    if (at >= 0) {
      // Order does not matter and there is no `splice`: move the last entry
      // into the hole. A scope's narrowings are a set, never a sequence.
      const last = this.narrowedVars.length - 1;
      this.narrowedVars[at] = this.narrowedVars[last];
      this.narrowedTypes[at] = this.narrowedTypes[last];
      this.narrowedVars.pop();
      this.narrowedTypes.pop();
    }
    const parent = this.parent;
    if (parent !== null) {
      parent.clearNarrowing(variable);
    }
  }
}
