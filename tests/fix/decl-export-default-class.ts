// `export default C` for a class, with the `;` after it: the line goes whole.
class C {
  x: i32 = 0
}
export default C;
export const main = (): number => new C().x
