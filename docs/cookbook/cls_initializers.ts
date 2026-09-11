class Defaults {
  n: number = 42;
  flag: boolean = true;
  name: string = "anon";
}

const make = (): Defaults => new Defaults();
