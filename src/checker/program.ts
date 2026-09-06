/** Data model produced by the checker and consumed by the emitter. */
import ts from "typescript";
import { StaticType } from "../types";

export interface Param {
  name: string;
  type: StaticType;
}

export interface FunctionSig {
  name: string;
  params: Param[];
  returnType: StaticType;
  decl: ts.FunctionDeclaration;
}

export interface LocalVar {
  name: string;
  type: StaticType;
  mutable: boolean;
  /** `param` locals are SSA values; `local` ones live in an alloca slot. */
  storage: "param" | "local";
}

export interface CheckedProgram {
  sourceFile: ts.SourceFile;
  functions: FunctionSig[];
  /** Expression node -> resolved StaticType. */
  types: WeakMap<ts.Node, StaticType>;
  /** Identifier node -> the variable it refers to. */
  bindings: WeakMap<ts.Identifier, LocalVar>;
  /** VariableDeclaration node -> the local it introduces. */
  locals: WeakMap<ts.VariableDeclaration, LocalVar>;
  /** CallExpression node -> callee signature. */
  callees: WeakMap<ts.CallExpression, FunctionSig>;
}
