// An interface member typed `Promise<T>`: an object never holds a promise
// (NL2636).
interface Job {
  done: Promise<i32>
}

export const main = (): i32 => 0
