interface Shape {
  width: number;
}

class Rect {
  width: number = 1;
}

const area = (s: Shape): number => {
  return s.width;
};

export const test = (): number => {
  return area(new Rect());
};
