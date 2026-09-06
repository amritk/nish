// Strings built up in loops: a number table, a bar chart, and a run-length pattern.
function bar(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) {
    s = s + "#";
  }
  return s;
}

function pad(s: string, width: number): string {
  let out = s;
  while (out.length < width) {
    out = " " + out;
  }
  return out;
}

export function main(): number {
  for (let i = 1; i <= 10; i++) {
    console.log(`${pad(`${i}`, 3)} | ${bar(i)} ${i * i}`);
  }
  let pattern = "";
  for (let run = 1; run <= 5; run++) {
    for (let k = 0; k < run; k++) {
      pattern = pattern + (run % 2 === 0 ? "ab" : "c");
    }
    pattern = pattern + "|";
  }
  console.log(pattern);
  console.log(pattern.length);
  let words = "";
  const parts = ["alpha", "beta", "gamma", "delta"];
  for (let i = parts.length - 1; i >= 0; i--) {
    words = words === "" ? parts[i] : words + " " + parts[i];
  }
  console.log(words);
  console.log(pad("x", 1));
  console.log(pad("", 0).length);
  return 0;
}
