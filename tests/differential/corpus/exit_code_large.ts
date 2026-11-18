// Exit codes are truncated to 8 bits by the OS; 300 becomes 44, negative codes wrap.
export const main = (): number => {
  console.log("a");
  if ("a".length === 1) {
    process.exit(300);
  }
  return 0;
};
