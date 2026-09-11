import { square } from "./math";

// `export const main` is the program entry. Its return value is the exit
// code, so `./build/multi; echo $?` prints 49.
// smoke: exit 49
export const main = (): number => square(7);
