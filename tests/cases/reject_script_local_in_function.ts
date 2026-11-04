// A variable of the top-level code is a local of the `main` it runs as, so a
// function cannot read it, and the message says so rather than that the name
// is unknown.
let count = 0
const bump = (): void => {
  count += 1
}
bump()
