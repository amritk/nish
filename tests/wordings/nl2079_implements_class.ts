// NL2079: `implements` takes an interface; naming a class is refused with the name it was given.
class Base {
  x: i32 = 0;
}

class Point implements Base {
  x: i32 = 0;
}
