// The same template at `string`: one pointer field, so the struct is eight
// bytes and the constructor's `%v` loses `nocapture` because it is stored into
// a field. One source line, two layouts and two attribute sets (WP18 §5).
class Box<T> {
  value: T;
  constructor(v: T) {
    this.value = v;
  }
  get(): T {
    return this.value;
  }
}

export const test = (): number => {
  const b = new Box<string>("hi");
  console.log(b.get());
  return 0;
};
