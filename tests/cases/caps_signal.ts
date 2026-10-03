// WP35: `signalFd` is `signal`, reached from `main` through `listen`. Making
// the descriptor waits for nothing, so the round trip does not hang; reading
// from it would, and `tests/cases/os_signal` is the case that does.
const listen = (): i32 => signalFd();

export const main = (): number => {
  console.log(listen() >= 0);
  return 0;
};
