// WP51 stage 1: references compare by the function they name, `===` and
// `!==` on their tags.
type Pred = (x: i32) => boolean

const even = (x: i32): boolean => x % 2 === 0
const odd = (x: i32): boolean => x % 2 !== 0

const pick = (wantEven: boolean): Pred => (wantEven ? even : odd)

export const main = (): void => {
  const p = pick(true)
  const q = pick(false)
  console.log(`${p === even} ${p === odd} ${q !== even} ${p === pick(true)} ${p(4)} ${q(4)}`)
}
