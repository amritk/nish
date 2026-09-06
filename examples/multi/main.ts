import { square } from "./math";

// `export function main` is the program entry. Its return value is the exit
// code, so `./build/multi; echo $?` prints 49.
// smoke: exit 49
export function main(): number {
  return square(7);
}
