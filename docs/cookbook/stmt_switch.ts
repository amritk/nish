const KIND_CALL: i32 = 4;

const classify = (kind: number): number => {
  switch (kind) {
    case 0:
      return 10;
    case 1:
    case 2:
      return 20;
    case KIND_CALL:
      return 30;
    default:
      return 40;
  }
};
