// `s` doubled `times` times, and the length of a join, in a module of their
// own so the join crosses a call.
export const doubled = (s: string, times: i32): string => {
  let out = s;
  let i = 0;
  while (i < times) {
    out = out + out;
    i = i + 1;
  }
  return out;
};

export const joinedLength = (parts: string[], sep: string): i32 => parts.join(sep).length;
