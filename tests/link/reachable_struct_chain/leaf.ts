export class Leaf {
  value: number;

  constructor(value: number) {
    this.value = value;
  }

  doubled(): number {
    return this.value * 2;
  }
}
