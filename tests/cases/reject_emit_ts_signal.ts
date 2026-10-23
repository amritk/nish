// WP33 R4: `signalFd` and `readSignal` are refused under --emit-ts (NL4011):
// the descriptor one makes is read by the other, so neither translates within
// its own statement.

export const main = (): number => {
  const fd = signalFd();
  console.log(readSignal(fd));
  return 0;
};
