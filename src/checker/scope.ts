import ts from "typescript";
import { CompileError } from "../diagnostics";
import { LocalVar } from "./program";

/** Lexical scope chain for locals and parameters. */
export class Scope {
  private vars = new Map<string, LocalVar>();
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
}
