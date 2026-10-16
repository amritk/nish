// #618: `--no-strict-exports` changes nothing for an exported function: its
// name is its symbol either way, so an exported `close` is refused under the
// flag as well.
export function close(fd: i32): i32 {
  return fd;
}

export const main = (): i32 => close(0);
