// A handle class owns a C resource, so an initializer does not build one:
// open it in a constructor, where its `using` or close is in sight.
declare function fopen(path: string, mode: string): CPtr | null;
declare function fclose(p: CPtr): i32;

class File {
  readonly file: CPtr | null;

  constructor(path: string) {
    this.file = fopen(path, "r");
  }

  [Symbol.dispose](): void {
    const p = this.file;
    if (p !== null) {
      fclose(p);
    }
  }
}

export class Holder {
  file: File = new File("x");
}
