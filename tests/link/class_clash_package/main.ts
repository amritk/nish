// #174 inside a package (NL3023): the package's two modules each declare a
// `Base` with a constructor, which is one package-scoped symbol. The program
// itself declares no `Base`, so the sentence says "within one package".
import { make } from "./node_modules/shapes/index";

export const main = (): i32 => make();
