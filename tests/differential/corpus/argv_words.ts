// process.argv (WP7): argv[0] is the program on both sides (the binary natively,
// the script under Node) and differs in text, so only its presence is checked;
// the rest comes from argv_words.argv. Every array operation applies to the
// read-only array (here: passing it on, `.length`, indexing, `for...of`).
function longest(words: string[]): string {
  let best = "";
  let first = true;
  for (const w of words) {
    if (!first && w.length > best.length) best = w;
    first = false;
  }
  return best;
}

export function main(): number {
  const args = process.argv;
  console.log(`${args.length - 1} words after the program name`);
  console.log(args.length > 0 && args[0].length > 0 ? "argv[0] is set" : "argv[0] is empty");
  let total = 0;
  for (let i = 1; i < args.length; i++) {
    console.log(`${i}: ${args[i]} (${args[i].length} bytes)`);
    total += args[i].length;
  }
  console.log(`longest: ${longest(args)}`);
  console.log(`total bytes: ${total}`);
  return total % 256;
}
