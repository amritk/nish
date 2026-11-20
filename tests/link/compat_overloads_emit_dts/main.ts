// NL2802: an exported function with overload signatures has no declaration
// file or header spelling.
export function area(side: number): number
export function area(width: number, height: number): number
export function area(width: number, height: number = -1): number {
  return height < 0 ? width * width : width * height
}

export class Scale {
  factor: number
  constructor()
  constructor(factor: number)
  constructor(factor: number = 2) {
    this.factor = factor
  }

  apply(x: number): number
  apply(x: number, offset: number): number
  apply(x: number, offset: number = 0): number {
    return x * this.factor + offset
  }
}
