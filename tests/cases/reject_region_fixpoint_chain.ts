// NL2610: the walk runs to its fixpoint however long a loop-carried chain
// is. `o.node` reaches `a1` only after one run per link, seventy here; a
// walk that stopped after a fixed number of runs would accept the store.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";

class Node {
  child: Node | null = null;
  n: i32 = 0;
}

class Outer {
  node: Node;
  constructor() {
    this.node = new Node();
  }
}

const f = (root: Node, o: Outer): i32 => {
  let a1: Node = root;
  let a2: Node = root;
  let a3: Node = root;
  let a4: Node = root;
  let a5: Node = root;
  let a6: Node = root;
  let a7: Node = root;
  let a8: Node = root;
  let a9: Node = root;
  let a10: Node = root;
  let a11: Node = root;
  let a12: Node = root;
  let a13: Node = root;
  let a14: Node = root;
  let a15: Node = root;
  let a16: Node = root;
  let a17: Node = root;
  let a18: Node = root;
  let a19: Node = root;
  let a20: Node = root;
  let a21: Node = root;
  let a22: Node = root;
  let a23: Node = root;
  let a24: Node = root;
  let a25: Node = root;
  let a26: Node = root;
  let a27: Node = root;
  let a28: Node = root;
  let a29: Node = root;
  let a30: Node = root;
  let a31: Node = root;
  let a32: Node = root;
  let a33: Node = root;
  let a34: Node = root;
  let a35: Node = root;
  let a36: Node = root;
  let a37: Node = root;
  let a38: Node = root;
  let a39: Node = root;
  let a40: Node = root;
  let a41: Node = root;
  let a42: Node = root;
  let a43: Node = root;
  let a44: Node = root;
  let a45: Node = root;
  let a46: Node = root;
  let a47: Node = root;
  let a48: Node = root;
  let a49: Node = root;
  let a50: Node = root;
  let a51: Node = root;
  let a52: Node = root;
  let a53: Node = root;
  let a54: Node = root;
  let a55: Node = root;
  let a56: Node = root;
  let a57: Node = root;
  let a58: Node = root;
  let a59: Node = root;
  let a60: Node = root;
  let a61: Node = root;
  let a62: Node = root;
  let a63: Node = root;
  let a64: Node = root;
  let a65: Node = root;
  let a66: Node = root;
  let a67: Node = root;
  let a68: Node = root;
  let a69: Node = root;
  let a70: Node = root;
  let i = 0;
  while (i < 3) {
    a1 = a2;
    a2 = a3;
    a3 = a4;
    a4 = a5;
    a5 = a6;
    a6 = a7;
    a7 = a8;
    a8 = a9;
    a9 = a10;
    a10 = a11;
    a11 = a12;
    a12 = a13;
    a13 = a14;
    a14 = a15;
    a15 = a16;
    a16 = a17;
    a17 = a18;
    a18 = a19;
    a19 = a20;
    a20 = a21;
    a21 = a22;
    a22 = a23;
    a23 = a24;
    a24 = a25;
    a25 = a26;
    a26 = a27;
    a27 = a28;
    a28 = a29;
    a29 = a30;
    a30 = a31;
    a31 = a32;
    a32 = a33;
    a33 = a34;
    a34 = a35;
    a35 = a36;
    a36 = a37;
    a37 = a38;
    a38 = a39;
    a39 = a40;
    a40 = a41;
    a41 = a42;
    a42 = a43;
    a43 = a44;
    a44 = a45;
    a45 = a46;
    a46 = a47;
    a47 = a48;
    a48 = a49;
    a49 = a50;
    a50 = a51;
    a51 = a52;
    a52 = a53;
    a53 = a54;
    a54 = a55;
    a55 = a56;
    a56 = a57;
    a57 = a58;
    a58 = a59;
    a59 = a60;
    a60 = a61;
    a61 = a62;
    a62 = a63;
    a63 = a64;
    a64 = a65;
    a65 = a66;
    a66 = a67;
    a67 = a68;
    a68 = a69;
    a69 = a70;
    a70 = o.node;
    i++;
  }
  root.child = a1;
  return 0;
};

const mk = (): Node => new Node();

export const main = (): i32 => {
  const o = new Outer();
  const r = region(mk);
  const n = enterWith(r, o, f);
  free(r);
  return n;
};
