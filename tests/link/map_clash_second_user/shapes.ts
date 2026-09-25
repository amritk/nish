export class Map {
  width: i32 = 2;
}

export const area = (): i32 => new Map().width * 2;
