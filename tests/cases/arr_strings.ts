function join(words: string[]): string {
  let out = "";
  for (const w of words) {
    out = out + w;
  }
  return out;
}

export function main(): number {
  const words = ["hello", ", ", "world"];
  words.push("!");
  console.log(join(words));
  console.log(words[3] === "!");
  words[0] = "goodbye";
  console.log(words[0]);
  return 0;
}
