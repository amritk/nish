export const main = (): number => {
  writeFileSync("out.txt", "hello\n");
  appendFileSync("out.txt", "world\n");
  const text = readFileSync("out.txt");
  console.log(text.length);
  return 0;
};
