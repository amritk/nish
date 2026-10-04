// `"nish".noPanic` (docs/LANGUAGE.md, "The no-panic scope"): a module the
// root package lists is held to no panic site, and a signed addition no proof
// bounds is one. The operands come from text, so no call site proves them.
import { total } from "./score";

export const main = (): i32 => total(parseInt("2147483647"), parseInt("1"));
