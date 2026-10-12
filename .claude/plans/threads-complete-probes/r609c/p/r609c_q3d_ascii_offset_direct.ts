export const main = (): i32 => {
  const word = "hello";
  const at = word.indexOf("l");
  const hit = at === 2 ? 1 : 0;
  console.log(`${hit}`);
  return 0;
};
