// `export default C` for a class, with the `;` after it: the line goes whole.
export class C {
  x: i32 = 0
}
export const main = (): number => new C().x
