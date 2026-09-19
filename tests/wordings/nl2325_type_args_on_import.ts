// NL2325: a type-argument list on an imported name that is not a template.
//
// WP18 G7 made a generic class importable, and this is the rule that draws the
// line around it. The refusal is made when the import binds rather than where
// the annotation is written, because pass 1 resolves a module's signatures as
// soon as it is parsed — before any import is bound — so at the point this
// annotation is read the compiler does not yet know what `Plain` is.
import { Plain } from "./wordings_generic_class";

export const valueOf = (p: Plain<i32>): i32 => p.value;

export const main = (): i32 => 0;
