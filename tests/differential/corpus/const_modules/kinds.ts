export const TOKEN_NUMBER: i32 = 1;
export const TOKEN_NAME: i32 = TOKEN_NUMBER + 1;
export const TOKEN_END: i32 = TOKEN_NAME + 1;
export const PROMPT: string = "> ";

export function describe(token: i32): string {
  if (token === TOKEN_NUMBER) {
    return "number";
  }
  if (token === TOKEN_NAME) {
    return "name";
  }
  return "end";
}
