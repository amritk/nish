// #612: `first` is not generic, so the importer's `functions` lists it with
// this file's offsets and node ids. `pad` is sized so that `first`'s `d` gets
// the node id of `main`'s `d`, and the filler below stretches `first` over
// the offset of `main`'s `parallelMapInto` call, inside `main`'s own span. A
// host found by offset alone is then `first`, whose one `d` maps to `main`'s
// `d` in `main`'s table and whose body hands nothing on: the call was admitted
// while `ts[1]` is `d`. The host is now looked for in `main.ts` alone.
const pad = (a: i32): i32 => a + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1;
export const first = (n: i32): i32 => {
  const d = new Array<i32>(n);
  // filler: keeps `first` spanning the offset of main's `parallelMapInto`.
  // filler: keeps `first` spanning the offset of main's `parallelMapInto`.
  // filler: keeps `first` spanning the offset of main's `parallelMapInto`.
  // filler: keeps `first` spanning the offset of main's `parallelMapInto`.
  // filler: keeps `first` spanning the offset of main's `parallelMapInto`.
  // filler: keeps `first` spanning the offset of main's `parallelMapInto`.
  // filler: keeps `first` spanning the offset of main's `parallelMapInto`.
  // filler: keeps `first` spanning the offset of main's `parallelMapInto`.
  // filler: keeps `first` spanning the offset of main's `parallelMapInto`.
  // filler: keeps `first` spanning the offset of main's `parallelMapInto`.
  // filler: keeps `first` spanning the offset of main's `parallelMapInto`.
  // filler: keeps `first` spanning the offset of main's `parallelMapInto`.
  // filler: keeps `first` spanning the offset of main's `parallelMapInto`.
  // filler: keeps `first` spanning the offset of main's `parallelMapInto`.
  // filler: keeps `first` spanning the offset of main's `parallelMapInto`.
  // filler: keeps `first` spanning the offset of main's `parallelMapInto`.
  // filler: keeps `first` spanning the offset of main's `parallelMapInto`.
  // filler: keeps `first` spanning the offset of main's `parallelMapInto`.
  // filler: keeps `first` spanning the offset of main's `parallelMapInto`.
  // filler: keeps `first` spanning the offset of main's `parallelMapInto`.
  // filler: keeps `first` spanning the offset of main's `parallelMapInto`.
  // filler: keeps `first` spanning the offset of main's `parallelMapInto`.
  return d.length;
};

// This note sits last so that it moves no offset. The collision depends on
// node ids and offsets, so a parser change can make this test pass without
// exercising the fix. To re-check it, drop `fn.definedIn(program.source) &&`
// from `dstHostDecl` in `src/parallel.ts`, rebuild, and compile `main.ts`: it
// must compile. If it is refused, retune the `+ 1` count in `pad` and the
// filler lines above and in `main.ts` until it compiles again, then restore
// the guard.
