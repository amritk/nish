// A `?.` chain whose value is the left operand of `??`: each `?.` link tests
// its receiver for `null` and branches to the default, which every test
// shares, so `undefined` is never a value. The last link may be a field, a
// scalar, a string's `length` or a method call, and a nullable last link is
// tested too, so `o?.next ?? null` keeps its `Order | null`.
class Address {
  city: string;
  constructor(city: string) {
    this.city = city;
  }
}

class Customer {
  name: string;
  address: Address | null = null;
  constructor(name: string) {
    this.name = name;
  }
  greeting(): string {
    return `hi ${this.name}`;
  }
}

class Order {
  id: i32;
  customer: Customer | null = null;
  next: Order | null = null;
  constructor(id: i32) {
    this.id = id;
  }
}

const city = (o: Order | null): string => o?.customer?.address?.city ?? "unknown";

const nextId = (o: Order | null): i32 => o?.next?.id ?? -1;

const greet = (o: Order | null): string => o?.customer?.greeting() ?? "nobody";

const nameLength = (o: Order | null): i32 => o?.customer?.name.length ?? 0;

const nextOrNull = (o: Order | null): Order | null => o?.next ?? null;

export const main = (): i32 => {
  const a = new Order(1);
  const b = new Order(2);
  a.next = b;
  const c = new Customer("ada");
  b.customer = c;
  c.address = new Address("paris");
  console.log(`${city(null)} ${city(a)} ${city(b)}`);
  console.log(`${nextId(null)} ${nextId(a)} ${nextId(b)}`);
  console.log(`${greet(a)} ${greet(b)} ${nameLength(b)} ${nameLength(a)}`);
  const n = nextOrNull(a);
  console.log(`${n === null ? "none" : `${n.id}`} ${nextOrNull(b) === null}`);
  return 0;
};
