class Account {
  balance: number;
  fee: number;

  constructor(balance: number, fee: number) {
    this.balance = balance;
    this.fee = fee;
  }

  charge(): void {
    this.balance -= this.fee;
  }

  withdraw(amount: number): boolean {
    if (amount > this.balance) {
      return false;
    }
    this.balance -= amount;
    this.charge();
    return true;
  }

  // Method recursion: drain in fixed steps until nothing is left.
  drain(step: number): number {
    if (!this.withdraw(step)) {
      return this.balance;
    }
    return this.drain(step);
  }

  same(other: Account): boolean {
    return this === other;
  }
}

export function main(): number {
  const a = new Account(100, 1);
  console.log(a.withdraw(30));
  console.log(a.balance);
  console.log(a.drain(20));
  console.log(a.same(a));
  console.log(a.same(new Account(1, 1)));
  return 0;
}
