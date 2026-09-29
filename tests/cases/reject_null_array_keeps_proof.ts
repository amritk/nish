// #234, the `T | null` twin of reject_result_array_keeps_proof: an array
// literal's element type is the elements' own type. `[r]` inside
// `if (r !== null)` is a `Box[]` that holds only what it was built from, so
// the `Box | null` pushed after it is refused rather than read back as a
// non-null `Box`.
class Box {
  v: i32;

  constructor(v: i32) {
    this.v = v;
  }
}

const mk = (some: boolean): Box | null => (some ? new Box(7) : null);

export const main = (): void => {
  const r = mk(true);
  if (r !== null) {
    const arr = [r];
    arr.push(mk(false));
    const second = arr[1];
    console.log(`${second.v}`);
  }
};
