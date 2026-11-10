# Regions

A region is memory your program frees when it says so. Ordinary objects in
Nish live until the program ends, which is right for a program that runs and
exits but not for a long-running one, such as a cache or a server that keeps
state per connection. A region holds things that live and die together, and
one `free` gives all of it back. The functions come from the built-in module
`nish:region`. The rules are in the reference under
[Regions: `nish:region`](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#regions-nishregion).

## Making, using and freeing a region

`region(f)` makes a region and runs `f` in it: every object `f` allocates
lands in the region, and what `f` answers is the region's *root*. You get back
a `Region<T>` handle, which is a number, not a pointer. `enter(r, f)` runs
`f(root)` in the region again and answers what `f` answers. `free(r)` gives
the memory back:

```ts nish:ok
import { Region, enter, free, region } from "nish:region";

class Session {
  hits: i32 = 0;
}

const open = (): Session => new Session();

const touch = (s: Session): i32 => {
  s.hits = s.hits + 1;
  return s.hits;
};

export const main = (): i32 => {
  const r: Region<Session> = region(open);
  enter(r, touch);
  console.log(enter(r, touch));
  free(r);
  return 0;
};
```

That prints `2`. `f` is an arrow or a named function, and an arrow inside a
region captures nothing.

## Passing a value in

`regionWith(arg, f)` and `enterWith(r, arg, f)` hand `f` one more argument:
`f(arg)` and `f(root, arg)`. Numbers that `f` copies out of the region, into an
array it was given, are yours to keep after `free`:

```ts nish:ok
import { Region, enterWith, free, regionWith } from "nish:region";

class Buffer {
  bytes: u8[];
  constructor(size: i32) {
    this.bytes = new Array<u8>(size);
    for (let k: i32 = 0; k < size; k++) {
      this.bytes[k] = 7;
    }
  }
}

const open = (size: i32): Buffer => new Buffer(size);

const copyOut = (b: Buffer, out: u8[]): i32 => {
  for (let k: i32 = 0; k < b.bytes.length && k < out.length; k++) {
    out[k] = b.bytes[k];
  }
  return b.bytes.length;
};

export const main = (): i32 => {
  const out = new Array<u8>(4);
  const r = regionWith(16, open);
  const n = enterWith(r, out, copyOut);
  free(r);
  console.log(n);
  console.log(out[3]);
  return 0;
};
```

That prints `16` and `7`.

## What may cross the edge

Once `free` runs, nothing outside the region may point into it, so the
compiler checks every way a value can cross. A number, a `boolean`, an `enum`
and a `Region` handle are copied, so they cross freely. An object, an array or
a string made inside the region may not be kept by memory outside it:

```ts nish:err NL2609
import { enterWith, free, region } from "nish:region";

class Box {
  n: i32 = 0;
}

class Holder {
  box: Box | null = null;
}

const keep = (b: Box, h: Holder): i32 => {
  h.box = b;
  return 0;
};

export const main = (): i32 => {
  const h = new Holder();
  const r = region((): Box => new Box());
  const n = enterWith(r, h, keep);
  free(r);
  return n;
};
```

And `enter` may answer only something that is copied, never region memory:

```ts nish:err NL2611
import { enter, free, region } from "nish:region";

class Box {
  items: i32[];
  constructor() {
    this.items = [];
  }
}

const itemsOf = (b: Box): i32[] => b.items;

export const main = (): i32 => {
  const r = region((): Box => new Box());
  const xs = enter(r, itemsOf);
  free(r);
  return xs.length;
};
```

The other way is refused as well: memory from outside the region may not be
stored into the region, and a region's function may not grow an array, `Map`
or `Set` from outside it. A region's handle stays on the thread that made it,
so it may not be handed to a task, a channel or a parallel body, and a region's
function may not read `Arena.mark` or `Arena.used`. An arrow the function
hands to a helper runs inside the region too, so its body is checked the same
way. The reference lists each refusal with its code.

## A region inside a region

Inside the `f` an `enter` runs, `child(f)` and `childWith(arg, f)` make a
*child* region of the one entered. A child may point into its parent's memory
that was there before this `enter`, so it can use the parent's strings and
objects without copying them, and `free` of the parent frees every child too:

```ts nish:ok
import { Region, childWith, enter, free, region } from "nish:region";

class Name {
  text: string;
  constructor(text: string) {
    this.text = text;
  }
}

class Use {
  name: Name;
  constructor(name: Name) {
    this.name = name;
  }
}

const open = (): Name => new Name("total");
const hold = (name: Name): Use => new Use(name);
const keep = (name: Name): Region<Use> => childWith(name, hold);
const length = (u: Use): i32 => u.name.text.length;

export const main = (): i32 => {
  const parent = region(open);
  const kid = enter(parent, keep);
  console.log(enter(kid, length));
  free(parent);
  return 0;
};
```

That prints `5`, and after `free(parent)` the handle `kid` is dead as well.
What the parent's `f` made during this `enter` may not go into the child: a
scope inside the `enter` could give it back while the child still lives.

```ts nish:err NL2610
import { Region, childWith, enter, free, region } from "nish:region";

class Name {
  text: string;
  constructor(text: string) {
    this.text = text;
  }
}

class Use {
  name: Name;
  constructor(name: Name) {
    this.name = name;
  }
}

const open = (): Name => new Name("total");
const hold = (name: Name): Use => new Use(name);
const keep = (root: Name): Region<Use> => childWith(new Name(root.text), hold);

export const main = (): i32 => {
  const parent = region(open);
  enter(parent, keep);
  free(parent);
  return 0;
};
```

The child's memory may not be stored into the parent's, the child's `f` may
not grow the parent's arrays, `Map`s or `Set`s, and `child` may be called only
in the `f` an `enter` runs, never in a function something else also calls
(NL2697). A plain `region()` made inside `enter` has no parent and keeps the
rules above.

## Mistakes stop the program

`enter`, `enterWith` and `free` check the handle each time. A handle that was
never made, that is freed already or that belongs to another thread stops the
program with a message, and so does entering a region that is already entered
or freeing one that is (or a parent whose child is entered). Freeing twice
is a stop, never a corruption. Under
[`--deny-panics`](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#panic-sites) each of these calls is
reported.

`nish --emit-ts` does not translate a program that imports `nish:region` yet
(NL4015); build it native.
