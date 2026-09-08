export function test(): number {
  console.log("quote:\" backslash:\\ end");
  console.log("h\u00e9llo \u2192 \u65e5\u672c");
  console.log("line1\nline2");
  console.log("h\u00e9llo".length);
  return 0;
}
