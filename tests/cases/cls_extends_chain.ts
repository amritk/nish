interface Stats {
  name: string;
  hits: number;
  hp: number;
}

class Entity {
  name: string;
  hits: number = 0;

  constructor(name: string) {
    this.name = name;
  }

  hit(): number {
    this.hits += 1;
    return this.hits;
  }
}

// No constructor: `new Mob(name)` runs Entity's (an inherited constructor).
// `implements` checks the flattened layout: name, hits, hp.
class Mob extends Entity implements Stats {
  hp: number = 10;

  damage(amount: number): number {
    this.hp -= amount;
    return this.hp;
  }
}

class Boss extends Mob {
  phase: number;

  constructor(name: string, phase: number) {
    super(name);
    this.phase = phase;
  }

  enrage(): number {
    this.phase += 1;
    return this.damage(0) + this.phase;
  }
}

class Minion extends Mob {
  constructor() {
    super("minion");
  }
}

// Inherits Minion's zero-argument constructor.
class Ghost extends Minion {
  visible: boolean = false;
}

// Implicit `super()`: the nearest ancestor constructor (Minion's) takes no arguments.
class Wisp extends Ghost {
  speed: number;

  constructor(speed: number) {
    this.speed = speed;
  }
}

function describe(s: Stats): string {
  return `${s.name}:${s.hits}:${s.hp}`;
}

export function main(): number {
  const m = new Mob("slime");
  console.log(m.hit());
  console.log(m.damage(3));
  console.log(describe(m));
  const b = new Boss("dragon", 1);
  b.hit();
  b.hit();
  console.log(b.enrage());
  console.log(describe(b));
  const g = new Ghost();
  console.log(describe(g));
  console.log(g.visible ? 1 : 0);
  console.log(g.hit());
  const w = new Wisp(9);
  console.log(describe(w));
  console.log(w.speed);
  return 0;
}
