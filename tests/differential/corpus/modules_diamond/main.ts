// Diamond imports (main -> left, right -> common) plus a cycle back into main.
import { leftValue } from "./left";
import { rightValue } from "./right";
import { base } from "./common";

export function mainConstant(): number {
  return 1000;
}

export function main(): number {
  console.log(base());
  console.log(leftValue());
  console.log(rightValue());
  console.log(leftValue() + rightValue() - base());
  for (let i = 0; i < 3; i++) {
    console.log(`${i}: ${leftValue() * i}`);
  }
  return 0;
}
