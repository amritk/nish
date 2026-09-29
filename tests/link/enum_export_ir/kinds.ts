// With `enum_export_ir_local`, one program written twice: here the enum is
// imported, there `main.ts` declares it, and `main.ll` is the same file in
// both. An enum emits nothing, so where it is declared cannot move a byte.
export enum Kind {
  If = 1,
  While = 2,
  Return = 3,
}

export const base = (): i32 => 5;
