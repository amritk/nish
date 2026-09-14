// `export default` has no name to import, and a generic class is refused for it
// exactly as a declared one is: a template never reaches `declareStruct`, so the
// rule lives where both spellings get to it (WP18 G5).
export default class Box<T> {
  value: T;

  constructor(v: T) {
    this.value = v;
  }
}
