declare function calloc(count: u64, size: u64): CPtr | null;
declare function free(block: CPtr): void;

export const main = (): i32 => {
  const block = calloc(4, 16);
  if (block === null) {
    return 1;
  }
  free(block);
  return 0;
};
