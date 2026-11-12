// NL2083: `declare interface` describes a type the compiler has no layout for;
// a plain `declare class` is a C struct layout (NL2740 and on).
declare interface Point {
  x: i32;
}
