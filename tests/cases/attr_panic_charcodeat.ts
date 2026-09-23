// #183: an unproven `s.charCodeAt(i)` branches to `nish_panic_index`, which is
// `noreturn`, so neither `at` nor `main` may be `willreturn`. With the attribute
// LLVM deleted the loop in `main` and the program exited 0 under the speed
// profile; it must print `before`, then panic with `5 >= 0` and exit 1.
// `first` is the other half of the rule: its guard proves the access, so no
// check is emitted and it keeps `willreturn`.
const at = (s: string, i: i32): number => s.charCodeAt(i);

const first = (s: string): number => {
  if (s.length > 0) {
    return s.charCodeAt(0);
  }
  return 0;
};

export const main = (): number => {
  console.log("before");
  let t = first("ab");
  for (let i = 0; i < 3; i++) {
    t = t + at("", i + 5);
  }
  return t;
};
