// WP29: a bad function argument inside a generic's body is one mistake,
// however many instantiations reach it. `useFnArg` is instantiated at two
// types and `useOther` at one, so the run reports exactly two errors, the
// count the `.err` pins; one per instantiation would be three.
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);

const notAFunction: i32 = 5;

const useFnArg = <T>(x: T): i32 => apply(notAFunction, 0);

const useOther = <T>(x: T): i32 => apply(3, 0);

export const main = (): i32 => {
  console.log(`${useFnArg(1)} ${useFnArg("a")} ${useOther(true)}`);
  return 0;
};
