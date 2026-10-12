export const main = (): i32 => {
  const word = "héllo";
  const c = word.charCodeAt(1);
  const hit = c === 233 ? 1 : 0;
  console.log(`${hit}`);
  return 0;
};
