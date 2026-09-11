// A string builder cannot reclaim its own temporaries: the string it returns
// has to outlive it, so `join` gets no arena scope and every intermediate it
// made would live for the whole program. Its *caller* can reclaim them,
// because a call hands back exactly one value — so the call is bracketed by
// `nish_arena_mark` and `nish_arena_keep`, which moves the returned string
// down onto the mark and releases everything underneath it.
function piece(i: number): string {
  return `${i},`;
}

function join(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) {
    s = s + piece(i);
  }
  return s;
}

class Box {
  text: string;
  constructor(text: string) {
    this.text = text;
  }
}

// `fill` hands the string it built to an object its caller still holds, so
// what it allocated is not garbage and the call below carries no bracket.
function fill(b: Box, i: number): string {
  const s = `v${i}`;
  b.text = s;
  return s;
}

function report(b: Box, n: number): string {
  return join(n) + fill(b, n);
}
