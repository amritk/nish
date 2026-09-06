const WIDTH: i32 = 8;
const AREA: i32 = WIDTH * WIDTH;
const LABEL: string = "area = ";

export function main(): number {
  console.log(`${LABEL}${AREA}`);
  return AREA;
}
