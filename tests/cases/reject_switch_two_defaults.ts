// Two `default` clauses is two answers to the same question.
export const run = (n: i32): number => {
  switch (n) {
    default:
      return 0;
    default:
      return 1;
  }
};
