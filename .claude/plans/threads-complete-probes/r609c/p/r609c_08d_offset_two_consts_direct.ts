export const main = (): i32 => {
  const word = "héllo";
  const pad: i32[] = [7, 7];
  const at = word.indexOf("l");
  const a = at + pad.length;
  const b = a;
  const hit = b === 4 ? 1 : 0;
  console.log(`${hit}`);
  return 0;
};
