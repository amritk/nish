// The prefix rule that replaced inheritance (WP24): several classes whose
// first fields are one interface's, used through that interface in parameters,
// variables and arrays. Every class keeps its own methods -- there is no
// dispatch to disagree about, which is why this file agrees with Node where
// the inheritance it replaced could not.
interface Account {
  owner: string;
  balance: number;
  ops: number;
}

class Savings implements Account {
  owner: string;
  balance: number;
  ops: number = 0;
  rate: number;

  constructor(owner: string, balance: number, rate: number) {
    this.owner = owner;
    this.balance = balance;
    this.rate = rate;
  }

  deposit(amount: number): number {
    this.balance += amount;
    this.ops += 1;
    return this.balance;
  }

  accrue(): number {
    return this.deposit((this.balance * this.rate) / 100);
  }

  summary(): string {
    return `${this.owner}=${this.balance}/${this.ops}`;
  }
}

class Trust implements Account {
  owner: string = "trust";
  balance: number = 1000;
  ops: number = 0;
  beneficiaries: number;
  until: number = 12;

  constructor(beneficiaries: number) {
    this.beneficiaries = beneficiaries;
  }

  remaining(month: number): number {
    return this.until - month;
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

// A write through the interface reaches the class's own bytes.
function charge(a: Account, amount: number): number {
  a.balance -= amount;
  a.ops += 1;
  return a.balance;
}

export function main(): number {
  const s = new Savings("ann", 200, 10);
  console.log(s.deposit(50));
  console.log(s.accrue());
  console.log(s.summary());
  const t = new Trust(3);
  console.log(t.remaining(1) + t.beneficiaries);
  const all: Account[] = [s, t];
  all.push(new Savings("cat", 1, 1));
  all[1] = new Savings("dan", 5, 1);
  console.log(total(all));
  console.log(richer(s, t).owner);
  console.log(charge(s, 25));
  console.log(s.balance);
  let best: Account = s;
  best = t;
  console.log(best.owner);
  console.log(s.summary());
  return 0;
}
