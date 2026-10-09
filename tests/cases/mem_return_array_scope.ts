// A function that fills a fresh array with values it built and returns it
// lets nothing out but the array: a value stored into `values[k]` or pushed
// onto `pair` is reachable only through the array's elements, and nothing
// reads those but a test (`values[k] === null`), so the value is returned
// with the array rather than escaping into memory. The loop that calls the
// function and reads the elements it gets back keeps its per-pass release,
// and the arena is the same height after 1000 calls as after one.
const fieldsOf = (line: string, n: i32): (string | null)[] => {
  const values: (string | null)[] = new Array<string | null>(n);
  for (let k = 0; k < values.length; k++) {
    if (values[k] === null && k < line.length) {
      values[k] = line.substring(k, line.length);
    }
  }
  return values;
};

const pairOf = (a: string, b: string): string[] => {
  const pair: string[] = [];
  pair.push(`${a}-${b}`);
  pair.push(`${b}-${a}`);
  return pair;
};

const run = (calls: i32): string => {
  let total = 0;
  for (let i = 0; i < calls; i++) {
    const fields = fieldsOf(`line ${i}`, 3);
    const last = fields[2];
    if (last !== null) {
      total = total + last.length;
    }
    total = total + pairOf(`${i}`, "x")[1].length;
  }
  return `${total}`;
};

/** What `run(calls)` answered, and how far it moved the arena. */
const grows = (calls: i32): string => {
  const before = Arena.used();
  const total = run(calls);
  const grown = Arena.used() - before;
  return `${total} ${grown}`;
};

export const main = (): void => {
  const one = grows(1);
  const many = grows(1000);
  console.log(one);
  console.log(many);
  const g1 = one.substring(one.indexOf(" ") + 1, one.length);
  const g2 = many.substring(many.indexOf(" ") + 1, many.length);
  console.log(g1 === g2 ? "flat" : "grows");
};
