import { pick } from "./lib";

export const fromA = (): i32 => pick(10, 20, true);

export const labelA = (): string => pick("a-first", "a-second", true);
