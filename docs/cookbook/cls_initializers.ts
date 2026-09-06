class Defaults {
  n: number = 42;
  flag: boolean = true;
  name: string = "anon";
}

function make(): Defaults {
  return new Defaults();
}
