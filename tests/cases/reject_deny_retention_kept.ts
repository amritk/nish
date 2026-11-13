// --deny-retention: NL9018, a function a loop runs that keeps an allocation on
// every call, is an error.
const relabel = (n: i32): i32 => {
  let s = "none";
  if (n > 2) {
    s = `b${n}`;
  }
  return s.length;
};

export const main = (): void => {
  const names: string[] = [];
  for (let i = 0; i < 1000; i++) {
    names.push(`${relabel(i)}`);
  }
  console.log(names.length);
};
