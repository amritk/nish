// NL2209: A getter runs code where a field read is written, which the language keeps to methods.
class Box {
  value: i32 = 0;
  get size(): i32 {
    return this.value;
  }
}
