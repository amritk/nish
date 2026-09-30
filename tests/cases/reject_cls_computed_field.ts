// A class member is named by an identifier: a computed name is a key no layout can hold (NL1041).
const k: string = "x";

export class Point {
  [k]: number = 0;
}
