class Rows {
  free: boolean[];

  constructor() {
    this.free = [];
  }

  reset(): void {
    this.free = new Array<boolean>(8);
  }

  take(r: i32): boolean {
    const was = this.free[r];
    this.free[r] = false;
    return was;
  }
}

export const run = (): boolean => {
  const rows = new Rows();
  rows.reset();
  return rows.take(3);
};
