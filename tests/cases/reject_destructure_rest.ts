// NL2773: a rest element would copy the array's tail.
export const main = (): void => {
  const [a, ...rest] = [1, 2, 3]
  console.log(a + rest.length)
}
