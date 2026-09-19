// An imported generic class is a template, not a type: `Crate` on its own has
// no layout in the module that wrote it either, so naming it bare is the same
// mistake as naming a locally declared template bare and says so in the same
// words.
import { Crate } from "./lib";

export const unwrap = (c: Crate): i32 => c.value;

export const main = (): i32 => 0;
