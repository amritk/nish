// A getter or setter runs code behind what reads as a field access; a method
// says that it runs. `get` and `set` stay names wherever a name can stand
// (`tests/parser/names-bindings.ts`), and are the accessor only before one.
export class Box {
  value: i32 = 0;
  static set
  size(n: i32) {
    this.value = n;
  }
}
