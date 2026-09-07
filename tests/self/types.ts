// The driver for `self/types.ts` (docs/wp14-selfhost.md, milestone S3),
// against `src/types.ts` through `tests/self/types_oracle.js`.
//
// The model is the same one, written differently: `src/` compares types
// structurally with `sameType`, and stage1 interns them so that equality is
// `===` on an id. Everything a type is asked about downstream — its LLVM
// type, its alignment, how a diagnostic spells it, and what may be assigned
// to it — has to survive that change unaltered, so all four are printed here
// for every type either side can build, and the assignability matrix is
// printed in full.

import {
  intBits,
  isFloat,
  isInteger,
  isNumeric,
  isUnsigned,
  T_BOOL,
  T_ERROR,
  T_F32,
  T_F64,
  T_I32,
  T_I64,
  T_STRING,
  T_U16,
  T_U32,
  T_U64,
  T_U8,
  T_VOID,
  TypeTable,
} from "../../self/types";

/**
 * Every type the two models can both build, in an order the oracle repeats:
 * the scalars, two structs, an array of each, a nullable of each pointer, and
 * the nested cases that catch a recursive walk stopping one level early.
 */
function buildTypes(table: TypeTable): i32[] {
  const scalars: i32[] = [T_I32, T_I64, T_U8, T_U16, T_U32, T_U64, T_F32, T_F64, T_BOOL, T_STRING, T_VOID];
  const types: i32[] = [];
  for (const scalar of scalars) {
    types.push(scalar);
  }
  types.push(table.structOf("Node"));
  types.push(table.structOf("Lexer"));

  const arrays: i32[] = [];
  let i = 0;
  const named = types.length;
  while (i < named) {
    arrays.push(table.arrayOf(types[i]));
    i = i + 1;
  }
  for (const array of arrays) {
    types.push(array);
  }

  types.push(table.nullableOf(T_STRING));
  types.push(table.nullableOf(table.structOf("Node")));
  types.push(table.nullableOf(table.structOf("Lexer")));
  for (const array of arrays) {
    types.push(table.nullableOf(array));
  }

  types.push(table.arrayOf(table.arrayOf(T_I32)));
  types.push(table.arrayOf(table.nullableOf(table.structOf("Node"))));
  types.push(table.nullableOf(table.arrayOf(table.arrayOf(T_I32))));
  return types;
}

export function main(): number {
  const table = new TypeTable();
  const types = buildTypes(table);
  const out: string[] = [];

  let i = 0;
  while (i < types.length) {
    const type = types[i];
    const flags = `${table.isPointer(type) ? 1 : 0}${isInteger(type) ? 1 : 0}${isUnsigned(type) ? 1 : 0}${isFloat(type) ? 1 : 0}${isNumeric(type) ? 1 : 0}`;
    out.push(
      `type ${i} ${table.typeName(type)} | ${table.llvmType(type)} | ${table.alignOf(type)} ${flags} ${intBits(type)}`
    );
    i = i + 1;
  }

  let from = 0;
  while (from < types.length) {
    let to = 0;
    while (to < types.length) {
      if (table.assignable(types[from], types[to])) {
        out.push(`assignable ${from} ${to}`);
      }
      to = to + 1;
    }
    from = from + 1;
  }

  // Interning: the same type asked for twice is the same id, `T | null | null`
  // is `T | null`, and `stripNull` is its inverse on a nullable.
  const firstAsk = table.arrayOf(T_I32);
  const secondAsk = table.arrayOf(T_I32);
  out.push(`intern array ${firstAsk === secondAsk ? 1 : 0}`);
  const firstNode = table.structOf("Node");
  const secondNode = table.structOf("Node");
  out.push(`intern struct ${firstNode === secondNode ? 1 : 0}`);
  const nullableNode = table.nullableOf(table.structOf("Node"));
  out.push(`intern nullable ${table.nullableOf(nullableNode) === nullableNode ? 1 : 0}`);
  out.push(`strip ${table.stripNull(nullableNode) === table.structOf("Node") ? 1 : 0}`);
  out.push(`strip plain ${table.stripNull(T_I32) === T_I32 ? 1 : 0}`);
  out.push(`distinct ${table.arrayOf(T_I32) === table.arrayOf(T_I64) ? 1 : 0}`);
  out.push(`table size ${table.size()}`);

  // `T_ERROR` has no counterpart in `src/types.ts`: it is D1's sentinel, and
  // its whole job is to be assignable in both directions so that one bad
  // expression does not produce a diagnostic at every site it reaches.
  out.push(`error name ${table.typeName(T_ERROR)}`);
  out.push(`error to i32 ${table.assignable(T_ERROR, T_I32) ? 1 : 0}`);
  out.push(`error from i32 ${table.assignable(T_I32, T_ERROR) ? 1 : 0}`);
  out.push(`error not i32 ${T_ERROR === T_I32 ? 1 : 0}`);

  write(`${out.join("\n")}\n`);
  return 0;
}
