// `fieldsOf` fills a fresh array with strings it built and returns it. Each
// string is reachable only through `values`, which nothing reads but a
// `=== null` test, `length` and the `return`, so the strings go to the caller
// with the array and `fieldsOf` lets nothing else out. The caller follows the
// elements it reads as the call itself, and nothing it reads outlives the
// pass, so its loop keeps its per-pass release.
const fieldsOf = (line: string, n: i32): (string | null)[] => {
  const values: (string | null)[] = new Array<string | null>(n)
  for (let k = 0; k < values.length; k++) {
    if (values[k] === null && k < line.length) {
      values[k] = line.substring(k, line.length)
    }
  }
  return values
}

export const measure = (calls: i32): string => {
  let total = 0
  for (let i = 0; i < calls; i++) {
    const last = fieldsOf(`line ${i}`, 3)[2]
    if (last !== null) {
      total = total + last.length
    }
  }
  return `${total}`
}
