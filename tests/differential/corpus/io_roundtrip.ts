// writeFileSync truncates, appendFileSync appends, readFileSync reads the whole file.
function lines(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) {
    s = `${s}line ${i}\n`;
  }
  return s;
}

export function main(): number {
  const path = "build/test/differential/io_roundtrip.txt";
  writeFileSync(path, "hello\n");
  appendFileSync(path, "wörld\n");
  const text = readFileSync(path);
  console.log(text.length);
  console.log(text);
  console.log(text === "hello\nwörld\n");
  writeFileSync(path, lines(5));
  const again = readFileSync(path);
  console.log(again.length);
  console.log(again === lines(5));
  for (let i = 0; i < 3; i++) {
    appendFileSync(path, `${i * i}|`);
  }
  console.log(readFileSync(path));
  writeFileSync(path, "");
  console.log(readFileSync(path).length);
  writeFileSync(path, "日本語");
  const utf = readFileSync(path);
  console.log(utf.length);
  console.log(utf + "!");
  return 0;
}
