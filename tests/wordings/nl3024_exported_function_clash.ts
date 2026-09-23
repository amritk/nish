// NL3024: `twice` is exported here and from `nl3_clash/lib.ts`, and an exported
// function's symbol is its name, so two modules cannot both export one.
import { anchor } from "./nl3_clash/lib";

export const twice = (x: i32): i32 => x + x;

export const main = (): i32 => twice(anchor());
