import { Box, Holder } from "./lib";

export const fromA = (): i32 => new Holder(true).pick(10, 20);

export const labelA = (): string => new Box<i32>(1).wrap("a-label");
