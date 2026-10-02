// An interface field is named by an identifier; `[k]: T` without a key type is a computed name, not an index signature (NL1041).
const k: string = "x";

export interface Point {
  [k]: number;
}
