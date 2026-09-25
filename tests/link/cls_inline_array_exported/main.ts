// The importer indexes the field itself, so both modules must emit the same
// `%struct.Board` body: the header and four slots, not a pointer.
import { Board } from "./board";

export const main = (): number => {
  const b = new Board();
  b.reset();
  b.put(1, 20);
  b.cells[3] = 22;
  console.log(`${b.cells.length} ${b.cells[1] + b.cells[3]}`);
  return b.cells[3] - b.cells[1];
};
