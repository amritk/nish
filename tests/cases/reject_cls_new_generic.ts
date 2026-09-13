// There are no generic classes, so there is no type argument to give one.
export class Box {
  x: number = 0;
}

export const run = (): number => {
  const b = new Box<number>();
  return b.x;
};
