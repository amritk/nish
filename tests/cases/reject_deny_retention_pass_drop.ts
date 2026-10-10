// --deny-retention: NL9016, an allocation dropped on every pass, is an error.
export const main = (): void => {
  let last = "";
  for (let i = 0; i < 1000; i++) {
    last = `item ${i}`;
  }
  console.log(last);
};
