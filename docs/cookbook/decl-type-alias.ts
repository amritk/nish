type Byte = u8;
type Bytes = Byte[];
type Label = string;

const widen = (b: Byte): i32 => toI32(b);

export const main = (): number => {
  const data: Bytes = [toU8(2), toU8(3)];
  const label: Label = "sum = ";
  console.log(`${label}${widen(data[0]) + widen(data[1])}`);
  return 0;
};
