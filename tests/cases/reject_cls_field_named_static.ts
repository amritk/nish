// `static` is a modifier *and* a legal member name, and which one it is comes
// from the token after it: `static?: i32` is an optional field called `static`,
// not a static member with no name. The rule the message states is the optional
// one, and it is the field's name that proves the word was read as a name.
export class Point {
  static?: i32;
}
