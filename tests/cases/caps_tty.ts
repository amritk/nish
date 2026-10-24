// `terminalSize` is `tty`, reached from `main` through `columns`. A program
// that reads keys or sizes its frame answers what the terminal it runs in
// says, so the capability is nondeterministic.
const columns = (): i32 => terminalSize()[0];

export const main = (): number => {
  console.log(columns());
  return 0;
};
