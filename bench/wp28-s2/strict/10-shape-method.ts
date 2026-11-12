// biome-ignore-all lint/plugin: the declared shape is what the example measures
// biome-ignore-all lint/suspicious/useAwait: an `async` function with no wait is the shape measured
// Shape: the `async` function is a method of a class.
class Store {
  async size(): Promise<i32> {
    return 0
  }
}

export async function main(): Promise<i32> {
  const store = new Store()
  const n = await store.size()
  console.log(n)
  return 0
}
