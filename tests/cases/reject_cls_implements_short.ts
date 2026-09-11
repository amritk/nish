// The interface's fields must all be there: a prefix rule widens what a class
// may declare *after* them, it does not let one go missing.
interface Point3 {
  x: number;
  y: number;
  z: number;
}

class Point2 implements Point3 {
  x: number = 0;
  y: number = 0;
}
