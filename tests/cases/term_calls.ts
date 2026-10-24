// `nish:term`'s five builtins as globals, with stdin the empty stream the
// round trip gives a case (`/dev/null`) and stdout a pipe: the read is the end
// of the stream (0), waiting answers at once because the end is readable, and
// neither descriptor is a terminal, so the size and raw mode answer -25.
// `tests/run.js` asks the same of a pipe with bytes in it and of a
// pseudo-terminal; `term_import` reaches the names through the import.
export const main = (): number => {
  const buf: u8[] = new Array<u8>(8);
  console.log(readStdin(buf, 2, 4));
  console.log(waitStdin(50));
  console.log(isTerminal(0));
  console.log(isTerminal(1));
  const size = terminalSize();
  console.log(`${size.length} ${size[0]} ${size[1]}`);
  console.log(setRawMode(true));
  console.log(setRawMode(false));
  return 0;
};
