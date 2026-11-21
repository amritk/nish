// An `async` function with no return annotation is told what it must write:
// `Promise<T>`, not just "a return type".
async function h() {}

const main = (): void => {};
