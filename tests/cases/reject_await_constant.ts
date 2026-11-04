// A module constant is no async function, so it cannot `await`.
const x: number = await 3

function main(): void {
  console.log(x)
}
