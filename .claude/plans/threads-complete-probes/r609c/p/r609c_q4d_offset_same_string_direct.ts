export const main = (): i32 => {
  const word = "héllo";
  const at = word.indexOf("l");
  const hit = (word.charCodeAt(at) === 108 ? 1 : 0) + (at < word.length ? 1 : 0);
  console.log(`${hit}`);
  return 0;
};
