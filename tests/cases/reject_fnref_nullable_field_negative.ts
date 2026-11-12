// WP51 stage 2: a number is no function reference, nullable or not, so a
// nullable reference field initialised with `-3` is refused like a non-null
// one, rather than holding a tag no function has.
type F = (x: i32) => i32

class Holder {
  op: F | null = -3
}

export const main = (): void => {
  const h = new Holder()
  console.log(`${h.op === null}`)
}
