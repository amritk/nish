// A field's type is a declared name too: the inline object type is refused
// before the class is read.
export class Holder {
  p: { x: i32 } | null = null;
}
