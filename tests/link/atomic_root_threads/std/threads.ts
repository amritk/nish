export class AtomicI32 {
  value: i32 = 0;
  add(x: i32): i32 {
    const o = this.value;
    this.value = o + x + x;
    return o;
  }
  double(): i32 {
    this.value = this.value * 2;
    return this.value;
  }
  load(): i32 {
    return this.value;
  }
}
export class AtomicI64 {
  v: i64 = 0;
  load(): i64 {
    return this.v;
  }
}
