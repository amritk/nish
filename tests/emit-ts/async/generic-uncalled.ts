// An async generic that nothing instantiates still makes the program async:
// the launcher reads the declarations, not the instances the native build
// compiles, so it awaits `main` and the spawned tasks here too.
async function echo<T>(x: T): Promise<T> {
  return x
}

export function main(): i32 {
  console.log("plain")
  return 0
}
