class Version {
  readonly major: number;
  readonly minor: number;
  private readonly tag: string = "v";
  public patch: number;

  constructor(major: number, minor: number) {
    this.major = major;
    this.minor = minor;
    this.patch = 0;
  }

  bump(): number {
    this.patch += 1;
    return this.patch;
  }

  render(): string {
    return `${this.tag}${this.major}.${this.minor}.${this.patch}`;
  }
}

export function main(): number {
  const v = new Version(1, 4);
  v.bump();
  v.bump();
  v.patch = 9;
  console.log(v.render());
  console.log(v.major * 100 + v.minor);
  return 0;
}
