import { KIND_IF, KIND_WHILE, KIND_COUNT, LANGUAGE, offset } from "./kinds";

export function main(): number {
  console.log(LANGUAGE);
  console.log(KIND_IF);
  console.log(KIND_WHILE);
  console.log(offset(KIND_WHILE));
  return KIND_COUNT;
}
