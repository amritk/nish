// WP22 §5.1: a module-level `const` bound to an arrow *is* a function
// declaration, so it is in scope for the whole module and not only after its
// own line. Nothing pinned that, and everything depends on it: `self/` is 721
// mutually recursive declarations in the order somebody found readable, and a
// rewrite that had to topologically sort a compiler to keep it compiling would
// not be a spelling change at all (§8b). `main` calls `isEven` above its
// declaration, and `isEven` and `isOdd` call each other, which no ordering of
// the two can avoid.
export const main = (): number => {
  console.log(isEven(10) ? "even" : "odd");
  console.log(`${countdown(4)}`);
  return 0;
};

const isEven = (n: i32): boolean => {
  if (n === 0) {
    return true;
  }
  return isOdd(n - 1);
};

const isOdd = (n: i32): boolean => {
  if (n === 0) {
    return false;
  }
  return isEven(n - 1);
};

// A concise body reaching forward as well, because §4's branch is the one that
// checks the expression rather than a block of statements.
const countdown = (n: i32): i32 => (n <= 0 ? 0 : n + countdown(n - 1));
