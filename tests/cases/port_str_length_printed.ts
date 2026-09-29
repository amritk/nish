// WP33 NL8001: a UTF-8 byte count that meets a fact from outside the string is
// a different number under TypeScript, which counts UTF-16 units: "héllo" is 6
// bytes here and 5 units there. Each shape below is one outside fact — printed,
// printed into a template, stored in a field, pushed on to an array, compared
// with a hard-coded count, and taken from a column width — reached from the
// method itself or through the local that holds it.
class Label {
  width: i32;

  constructor() {
    this.width = 0;
  }
}

const describe = (name: string): string => `${name} is ${name.length} bytes`;

const room = (name: string, column: i32): i32 => column - name.length;

export const main = (): number => {
  const name = "héllo";
  console.log(name.length);
  const n = name.length;
  const label = new Label();
  label.width = n;
  const widths: i32[] = [];
  widths.push(name.indexOf("l"));
  console.log(describe(name));
  console.log(room(name, 10));
  if (name.length > 5) {
    console.log("long");
  }
  console.log(label.width + widths[0]);
  return 0;
};
