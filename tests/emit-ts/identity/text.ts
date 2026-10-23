// A class-A module written with CRLF line endings and UTF-8 outside ASCII:
// é, → and 😀 in a comment, and in the strings it prints. Nothing in it is
// rewritten, so --emit-ts writes it back byte for byte, \r\n and all.

const greeting = (name: string): string => `héllo, ${name} → 😀`;

export const main = (): number => {
  console.log(greeting("wörld"));
  console.log("日本語");
  return 0;
};
