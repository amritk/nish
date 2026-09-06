class Base {
  x: number = 0;
}

class Derived extends Base {
  y: number = 0;
}

function narrow(b: Base): Derived {
  return b;
}
