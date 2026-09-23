// The driver for `self/symbols.ts` (docs/wp14-selfhost.md, milestone S3),
// checked against stage0 until R6; `tests/self/goldens/symbols.txt` is its output.
//
// The script below is one every Nish program with a nullable exercises:
// shadowing in a nested block, a narrowing that holds through the chain, an
// inner narrowing that wins over an outer one, and an assignment that drops
// both. Getting any of those wrong is a program that compiles and reads a
// pointer the checker promised was not null, so the two implementations are
// driven through it step for step and their answers diffed.

import { Local, Scope, STORAGE_LOCAL, STORAGE_PARAM } from "../../self/symbols";
import { T_F64, T_I32, T_STRING, TypeTable } from "../../self/types";

/** `name -> declared type -> what it reads as here`, or that it is not in scope. */
function report(out: string[], table: TypeTable, scope: Scope, where: string, name: string): void {
  const found = scope.lookup(name);
  if (found === null) {
    out.push(`${where} ${name} absent`);
    return;
  }
  out.push(`${where} ${name} ${table.typeName(found.type)} reads ${table.typeName(scope.typeOf(found))}`);
}

export function main(): number {
  const table = new TypeTable();
  const nullableString = table.nullableOf(T_STRING);
  const node = table.structOf("Node");
  const nullableNode = table.nullableOf(node);
  const out: string[] = [];

  const root = new Scope(null);
  const a = new Local("a", T_I32, true, STORAGE_LOCAL);
  const b = new Local("b", nullableString, false, STORAGE_PARAM);
  const c = new Local("c", nullableNode, true, STORAGE_LOCAL);
  out.push(`declare a ${root.declare(a) ? 1 : 0}`);
  out.push(`declare b ${root.declare(b) ? 1 : 0}`);
  out.push(`declare c ${root.declare(c) ? 1 : 0}`);
  out.push(`declare a again ${root.declare(new Local("a", T_F64, true, STORAGE_LOCAL)) ? 1 : 0}`);
  report(out, table, root, "root", "a");
  report(out, table, root, "root", "b");
  report(out, table, root, "root", "c");
  report(out, table, root, "root", "missing");

  // A block shadows: the inner `a` is a different variable of a different type.
  const inner = root.child();
  const shadow = new Local("a", T_F64, false, STORAGE_LOCAL);
  out.push(`shadow ${inner.declare(shadow) ? 1 : 0}`);
  report(out, table, inner, "inner", "a");
  report(out, table, inner, "inner", "b");
  out.push(`storage ${a.storage === STORAGE_LOCAL ? 1 : 0} ${b.storage === STORAGE_PARAM ? 1 : 0}`);
  out.push(`mutable ${a.mutable ? 1 : 0} ${shadow.mutable ? 1 : 0}`);
  out.push(`declares here ${inner.declaresHere("a") ? 1 : 0} ${inner.declaresHere("b") ? 1 : 0}`);

  // `if (b !== null)`: the narrowing holds in this scope and every scope
  // under it, and not in the one above.
  inner.narrow(b, T_STRING);
  report(out, table, inner, "narrowed", "b");
  report(out, table, root, "root after narrow", "b");
  const deeper = inner.child();
  report(out, table, deeper, "deeper", "b");

  // An inner narrowing of the same variable wins, and clearing walks the
  // whole chain: after `b = ...` nothing about the old value holds anywhere.
  deeper.narrow(b, nullableString);
  report(out, table, deeper, "renarrowed", "b");
  report(out, table, inner, "outer still", "b");
  deeper.clearNarrowing(b);
  report(out, table, deeper, "cleared deeper", "b");
  report(out, table, inner, "cleared inner", "b");

  // A narrowing of a variable declared in an outer scope, dropped from an
  // inner one: the same shape as `while (cur !== null) { cur = cur.next; }`.
  root.narrow(c, node);
  report(out, table, deeper, "c narrowed at root", "c");
  deeper.clearNarrowing(c);
  report(out, table, root, "c cleared from deeper", "c");
  out.push(`clear absent ${deeper.narrowingIndex(a)}`);

  write(`${out.join("\n")}\n`);
  return 0;
}
