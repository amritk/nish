// FNV-1a: one `^` per byte and one wrapping multiply per round. This is the
// loop the bitwise operators were added for, and it is the reason the mask
// and the i32 wrap have to agree with JavaScript byte for byte.
function fnv1a(bytes: number[]): number {
  let hash = -2128831035; // the 2166136261 offset basis, read as a signed i32
  for (const b of bytes) {
    hash ^= b;
    hash *= 16777619;
  }
  return hash;
}

/** The bucket a hash lands in, which is what the `&` is really for. */
function bucket(bytes: number[], size: number): number {
  return fnv1a(bytes) & (size - 1);
}

export function main(): number {
  const hello = [104, 101, 108, 108, 111];
  const world = [119, 111, 114, 108, 100];
  const empty: number[] = [];
  console.log(fnv1a(empty));
  console.log(fnv1a(hello));
  console.log(fnv1a(world));
  console.log(bucket(hello, 1024));
  console.log(bucket(world, 1024));
  console.log(bucket(empty, 64));
  const bytes: number[] = [];
  for (let i = 0; i < 256; i++) {
    bytes.push(i);
    console.log(`${fnv1a(bytes)} ${fnv1a(bytes) >>> 24} ${bucket(bytes, 4096)}`);
  }
  return 0;
}
