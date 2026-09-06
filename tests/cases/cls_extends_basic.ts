class Animal {
  legs: number;
  name: string;

  constructor(legs: number, name: string) {
    this.legs = legs;
    this.name = name;
  }

  describe(): string {
    return `${this.name} has ${this.legs} legs`;
  }
}

class Dog extends Animal {
  tricks: number = 0;

  constructor(name: string) {
    super(4, name);
  }

  learn(): number {
    this.tricks += 1;
    return this.tricks;
  }
}

export function main(): number {
  const d = new Dog("rex");
  console.log(d.describe());
  console.log(d.learn());
  console.log(d.learn());
  console.log(d.legs);
  d.legs = 3;
  console.log(d.describe());
  console.log(d.tricks);
  return 0;
}
