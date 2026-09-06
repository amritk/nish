import { Base } from "./lib";

class Derived extends Base {
  y: number = 1;
}

export function main(): number {
  return new Derived().y - 1;
}
