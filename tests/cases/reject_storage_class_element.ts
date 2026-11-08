// A class element is a pointer, so storage refuses it.
class Body {
  x: f64 = 0
}

const bodies = new Array<Body>(4)

export const main = (): void => {
  console.log(`${bodies.length}`)
}
