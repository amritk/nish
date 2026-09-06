// Embedded NUL bytes and escape sequences: length counts them, equality must not stop at NUL.
export function main(): number {
  const withNul = "a\0b";
  console.log(withNul.length);
  console.log(withNul === "a\0c");
  console.log(withNul === "a\0b");
  console.log(withNul !== "a");
  console.log((withNul + withNul).length);
  console.log(withNul);
  console.log(`[${withNul}]`);
  console.log("é".length);
  console.log("é" === "é");
  console.log("\u{1F389}".length);
  console.log("\u{1F389}" === "🎉");
  console.log("\x41\x42\x43");
  console.log("tab\there".length);
  console.log("cr\r\nlf".length);
  console.log("\\".length);
  console.log("\"'`".length);
  let s = "";
  for (let i = 0; i < 3; i++) {
    s = s + "\0";
  }
  console.log(s.length);
  console.log(s === "\0\0\0");
  console.log(s === "\0\0");
  console.log(("x" + s + "y").length);
  return 0;
}
