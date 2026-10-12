// A `using a = arena()` block releases what it allocated when it ends, so a
// string `String.fromBytes` makes inside it may not be kept in a local, an
// element, a field or an array it is pushed onto, any of them older than the
// block: each would point into freed memory.
class Box {
  label: string = "";
}

export const local = (bytes: u8[]): string => {
  let last = "";
  for (let i = 0; i < 3; i++) {
    using a = arena();
    last = String.fromBytes(bytes, 0, 1);
  }
  return last;
};

export const element = (bytes: u8[], names: string[]): void => {
  using a = arena();
  names[0] = String.fromBytes(bytes, 0, 1);
};

export const field = (bytes: u8[], b: Box): void => {
  using a = arena();
  b.label = String.fromBytes(bytes, 0, 1);
};

export const pushed = (bytes: u8[], names: string[]): void => {
  for (let i = 0; i < 3; i++) {
    using a = arena();
    names.push(String.fromBytes(bytes, 0, 1));
  }
};
