// The other module of `main.ts`: an exported class whose method is called
// `read`. A method's symbol carries its class (`@File.read`), so it is not
// the C library's `read`, exported or not.
export class File {
  size: i32 = 3;

  read(n: i32): i32 {
    return this.size + n;
  }
}
