// WP40: the standard library is never refused. The root package grants
// nothing, and `nish/regex`, which reaches `unsafe` inside the library, is
// judged by no grant; the one dependency reaches nothing gated. The exit code
// is the escaped pattern's length plus the dependency's 1.
import { regexEscape } from "nish/regex";
import { one } from "pkg_plain";

export const main = (): i32 => toI32(regexEscape("a.b").length) + one();
