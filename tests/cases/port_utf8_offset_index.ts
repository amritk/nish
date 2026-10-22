// WP33 NL8001 (#629): an offset used as an array's index picks a different
// element under TypeScript, which counts "héllo" in 5 units, not 6 bytes. A
// string's own index counts in the string's unit and stays quiet.
export const main = (): number => {
  const word = "héllo";
  const scores: i32[] = [10, 20, 30, 40, 50, 60, 70];
  console.log(scores[word.indexOf("l")]);
  const last = word.indexOf("o");
  console.log(scores[last]);
  if (word.charCodeAt(word.indexOf("l")) === 108) {
    console.log("l");
  }
  return 0;
};
