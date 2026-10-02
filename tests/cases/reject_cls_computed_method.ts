// A computed method name is refused once, for the name: `Symbol` inside it is not a second refusal (NL1041).
export class Range {
  [Symbol.iterator](): number {
    return 0;
  }
}
