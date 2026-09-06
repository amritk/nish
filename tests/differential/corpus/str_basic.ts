// String concatenation, equality, length, and empty strings.
function repeat(s: string, n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) {
    out = out + s;
  }
  return out;
}

function same(a: string, b: string): boolean {
  return a === b;
}

export function main(): number {
  const hello = "hello";
  const world = "world";
  const hw = hello + ", " + world + "!";
  console.log(hw);
  console.log(hw.length);
  console.log("".length);
  console.log(("" + "").length);
  console.log(same("abc", "abc"));
  console.log(same("abc", "abd"));
  console.log(same("", ""));
  console.log(same("a", ""));
  console.log(hello + world === "helloworld");
  console.log(hello !== world);
  console.log(repeat("ab", 5));
  console.log(repeat("ab", 0).length);
  console.log(repeat("x", 100).length);
  let s = "";
  for (let i = 0; i < 12; i++) {
    s = s + `${i},`;
  }
  console.log(s);
  console.log(s.length);
  const q = "quote:\" backslash:\\ tab:\t end";
  console.log(q);
  console.log(q.length);
  console.log("line1\nline2");
  if (hello === "hello" && world !== "hello") {
    console.log("both");
  }
  const picked = hw.length > 10 ? hello : world;
  console.log(picked);
  return 0;
}
