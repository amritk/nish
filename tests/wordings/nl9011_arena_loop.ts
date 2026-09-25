// NL9011: a loop over a call that leaves arena memory behind, in a function
// that gets no automatic arena scope, names what refused the scope.
class Log {
  last: string = "";
}

const digits = (n: i32): string => `${n}`;

export const count = (log: Log, rounds: i32): i32 => {
  let total = 0;
  for (let i = 0; i < rounds; i++) {
    total += digits(i).length;
  }
  log.last = `${total}`;
  return total;
};
