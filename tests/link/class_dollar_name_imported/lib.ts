// A declared class spelled like the instantiation `Box<i32>` that `main.ts`
// makes. This module loads after `main.ts`, so here the instantiation exists
// first; the refusal is the same, and names `Box$i32`, the name written here.
export class Box$i32 {
  a: string = "zz";
  v: i32 = 3;
}

export const mk = (): Box$i32 => new Box$i32();
