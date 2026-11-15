// NL2193: a pattern over an `await` other than `awaitAll(...)`'s, whose names
// are the calls' answers, is refused.
const pair = async (): Promise<i32[]> => [1, 2];

export const main = async (): Promise<i32> => {
  const [a, b] = await pair();
  return a + b;
};
