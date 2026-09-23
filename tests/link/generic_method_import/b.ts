import { Box, Holder } from "./lib";

// The same instantiations `a.ts` asks for, with the other branch taken, so a
// program that somehow got two `Holder.pick$i32` bodies would answer
// differently rather than merely link twice.
export const fromB = (): i32 => new Holder(false).pick(3, 7);

export const labelB = (): string => new Box<i32>(2).wrap("b-label");
