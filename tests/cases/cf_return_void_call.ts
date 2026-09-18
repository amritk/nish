// `return g()` where `g` answers nothing. The call is the whole of the
// statement and the `ret` carries no operand, so the golden is read for a bare
// `ret void` with nothing after it: the spelling this used to emit,
// `ret void void`, is not IR at all and `llvm-as` refuses the module.
const emit = (n: number): void => {
  console.log(`level ${n}`);
};

const walk = (n: number): void => {
  if (n === 0) return;
  emit(n);
  return walk(n - 1);
};

export const main = (): number => {
  walk(2);
  return 0;
};
