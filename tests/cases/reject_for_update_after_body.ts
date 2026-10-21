// A `for` loop whose body is one refused statement still has its update
// checked: both the body's error and the update's are reported.
const f = (n: i32): void => {
  for (let i = 0; i < n; i = undefinedName) badCall();
};

export const main = (): void => {
  f(1);
};
