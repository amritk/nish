// #174 inside a package: the package's two modules each declare a `Base` with
// a constructor, which is one package-scoped symbol. Since #193 a class name is
// unique across the program inside a package too, so the second `Base` is
// refused by name (NL3028) and the shared constructor is not a second report.
import { make } from "./node_modules/shapes/index";

export const main = (): i32 => make();
