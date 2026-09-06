function secret(): number {
  return 7;
}

export function open(): number {
  return secret();
}
