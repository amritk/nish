export const KIND_IF: i32 = 1;
export const KIND_WHILE: i32 = KIND_IF + 1;
export const KIND_COUNT: i32 = KIND_WHILE + 1;
export const LANGUAGE: string = "AmritScript";

const INTERNAL_BASE: i32 = 100;

export function offset(kind: i32): i32 {
  return INTERNAL_BASE + kind;
}
