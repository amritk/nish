// The byte methods against Node: the shim runs them over the UTF-8 bytes, so
// a multi-byte character is several indices on both sides. Cuts stay on
// character boundaries — half a character is a byte sequence a JavaScript
// string cannot hold (docs/wp13-differential.md).
function show(s: string, cut: number): void {
  console.log(`${s} len=${s.length} first=${s.charCodeAt(0)}`);
  console.log(`[${s.substring(1)}] [${s.substring(0, cut)}] [${s.substring(cut, 0)}] [${s.substring(-5, 99)}]`);
  console.log(`${s.indexOf("l")} ${s.indexOf("lo")} ${s.indexOf("zz")} ${s.indexOf("")}`);
  console.log(`${s.startsWith("h")} ${s.endsWith("o")} ${s.startsWith(s)} ${s.endsWith(`${s}!`)}`);
}

export function main(): number {
  show("hello", 2);
  show("héllo", 3);
  console.log(`${"".length} ${"".indexOf("")} ${"".startsWith("")} ${"".endsWith("x")}`);
  let acc = "";
  for (let i = 0; i < 5; i++) {
    acc = acc + String.fromCharCode(65 + i);
  }
  console.log(acc);
  const text = "one,two,three";
  let start = 0;
  for (;;) {
    const rest = text.substring(start);
    const at = rest.indexOf(",");
    if (at < 0) {
      console.log(rest);
      break;
    }
    console.log(rest.substring(0, at));
    start = start + at + 1;
  }
  return 0;
}
