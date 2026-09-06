import ts from "typescript";
import { CompileError } from "../diagnostics";
import { StaticType } from "../types";
import { LocalVar } from "./program";

/**
 * Lexical scope chain for locals and parameters.
 *
 * A scope also carries *narrowings* (WP6): inside `if (p !== null) { ... }`
 * the nullable local `p` reads as its non-null type. A narrowing is attached
 * to the scope of the region it holds in and is looked up through the chain
 * like a variable; an assignment to the variable removes it from whichever
 * scope owns it (`clearNarrowing`), so the statements that follow see the
 * declared type again.
 */
export class Scope {
  private vars = new Map<string, LocalVar>();
  private narrowings = new Map<LocalVar, StaticType>();
  constructor(private parent?: Scope) {}

  lookup(name: string): LocalVar | undefined {
    return this.vars.get(name) ?? this.parent?.lookup(name);
  }

  declare(v: LocalVar, node: ts.Node, sf: ts.SourceFile): void {
    if (this.vars.has(v.name)) {
      throw new CompileError(`Duplicate declaration of \`${v.name}\``, node, sf);
    }
    this.vars.set(v.name, v);
  }

  child(): Scope {
    return new Scope(this);
  }

  /** Record that `v` has type `type` for the rest of this scope. */
  narrow(v: LocalVar, type: StaticType): void {
    this.narrowings.set(v, type);
  }

  /** The type `v` currently reads as: the innermost narrowing, else its declared type. */
  typeOf(v: LocalVar): StaticType {
    return this.narrowings.get(v) ?? this.parent?.typeOf(v) ?? v.type;
  }

  /** Drop every narrowing of `v` in the chain (the variable was assigned). */
  clearNarrowing(v: LocalVar): void {
    this.narrowings.delete(v);
    this.parent?.clearNarrowing(v);
  }
}
