class Id {
  readonly value: number;
  constructor(value: number) {
    this.value = value;
  }
  reset(): void {
    this.value = 0;
  }
}
