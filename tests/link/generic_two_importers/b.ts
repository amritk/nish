import { pick } from "./lib";

// The same two instantiations `a.ts` asks for, with the other branch taken, so
// a program that somehow got two `pick$i32` bodies would answer differently
// rather than merely link twice.
export const fromB = (): i32 => pick(3, 7, false);

export const labelB = (): string => pick("b-first", "b-second", false);
