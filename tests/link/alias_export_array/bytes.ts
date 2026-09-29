// `Bytes` is `u8[]` and `Samples` is an array of an alias, both exported.
export type Byte = u8;
export type Bytes = Byte[];
export type Samples = readonly i32[];

export const checksum = (data: Bytes): i32 => {
  let sum = 0;
  for (const b of data) {
    sum = (sum + toI32(b)) % 251;
  }
  return sum;
};
