// `--deny tty` refuses a program that opens the terminal through
// `nish/term-io`: `openTerminal` reaches `nish:term`'s raw mode, so the
// capability travels up through the std module to `main` (NL2459).
import { defaultTerminalOptions, openTerminal } from "nish/term-io";

export const main = (): number => {
  const opened = openTerminal(defaultTerminalOptions());
  if (opened.isErr()) {
    return 1;
  }
  opened.value.close();
  return 0;
};
