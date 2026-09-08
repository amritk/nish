// Single inheritance without overrides: layout prefix, super(...), inherited
// fields, methods and constructors, implicit super(), upcasts into parameters,
// variables and arrays. (Overrides are excluded on purpose: AmritScript resolves
// methods by the receiver's static type, JavaScript by the runtime class.)
class Account {
  owner: string;
  balance: number;
  ops: number = 0;

  constructor(owner: string, balance: number) {
    this.owner = owner;
    this.balance = balance;
  }

  deposit(amount: number): number {
    this.balance += amount;
    this.ops += 1;
    return this.balance;
  }

  summary(): string {
    return `${this.owner}=${this.balance}/${this.ops}`;
  }
}

class Savings extends Account {
  rate: number;

  constructor(owner: string, balance: number, rate: number) {
    super(owner, balance);
    this.rate = rate;
  }

  accrue(): number {
    return this.deposit((this.balance * this.rate) / 100);
  }
}

class Locked extends Savings {
  until: number = 12;

  remaining(month: number): number {
    return this.until - month;
  }
}

class Trust extends Locked {
  beneficiaries: number;

  constructor(beneficiaries: number) {
    super("trust", 1000, 5);
    this.beneficiaries = beneficiaries;
  }
}

class Empty extends Account {
  constructor() {
    super("nobody", 0);
  }
}

class Placeholder extends Empty {
  note: string = "n/a";

  constructor() {
    this.note = "empty";
  }
}

function total(accounts: Account[]): number {
  let sum = 0;
  for (const a of accounts) {
    sum += a.balance;
  }
  return sum;
}

function richer(a: Account, b: Account): Account {
  return a.balance >= b.balance ? a : b;
}

export function main(): number {
  const s = new Savings("ann", 200, 10);
  console.log(s.deposit(50));
  console.log(s.accrue());
  console.log(s.summary());
  const l = new Locked("bob", 300, 2);
  console.log(l.remaining(4));
  console.log(l.accrue());
  const t = new Trust(3);
  console.log(t.summary());
  console.log(t.remaining(1) + t.beneficiaries);
  const all: Account[] = [s, l];
  all.push(t);
  all[1] = new Savings("cat", 1, 1);
  console.log(total(all));
  console.log(richer(s, t).owner);
  let best: Account = s;
  best = l;
  console.log(best.summary());
  const p = new Placeholder();
  console.log(p.note);
  console.log(p.summary());
  return 0;
}
