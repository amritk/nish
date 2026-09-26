const identity = <T>(x: T): T => x;

export const main = (): i32 => {
  console.log(identity(7));
  console.log(identity("hi"));
  return 0;
};
