// `join` stores a part of one byte rather than copying it: the
// `String.fromCharCode` a byte-at-a-time encoder pushes. Every other length,
// the empty part included, is still one `memcpy`. One-byte parts end to end,
// one-byte parts mixed with empty and longer ones, a separator between
// one-byte parts, a one-byte part last so its store is the final byte before
// the NUL, the top ASCII byte and a NUL byte, and an empty array are each read
// back byte for byte.
const codes = (s: string): string => {
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    out.push(`${s.charCodeAt(i)}`);
  }
  return `${s.length}:${out.join(" ")}`;
};

const bytes = (n: i32, from: i32): string[] => {
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    parts.push(String.fromCharCode(from + i));
  }
  return parts;
};

export const main = (): number => {
  console.log(bytes(5, 97).join(""));
  const mixed: string[] = ["", "a", "", "bcd", "e", "", "fg", "h"];
  console.log(`[${mixed.join("")}] [${mixed.join("|")}]`);
  console.log(bytes(4, 65).join(", "));
  const high: string[] = [String.fromCharCode(127), String.fromCharCode(0), String.fromCharCode(126)];
  console.log(codes(high.join("")));
  console.log(codes(high.join("-")));
  const empty: string[] = [];
  console.log(`[${empty.join("")}] ${empty.join("").length}`);
  const lone: string[] = ["z"];
  console.log(`[${lone.join("--")}]`);
  console.log(bytes(64, 48).join("").length);
  return 0;
};
