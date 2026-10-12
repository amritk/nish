class Address {
  city: string

  constructor(city: string) {
    this.city = city
  }
}

class Customer {
  name: string
  address: Address | null = null

  constructor(name: string) {
    this.name = name
  }

  greeting(): string {
    return `hi ${this.name}`
  }
}

// One `icmp eq` and one branch per `?.`, all to the shared default.
export const cityOf = (c: Customer | null): string => c?.address?.city ?? "unknown"

// A scalar at the end: the chain is the `i32` its last link reads.
export const nameLength = (c: Customer | null): i32 => c?.name.length ?? 0

// A method call is a link, made only where the receiver is not `null`.
export const greet = (c: Customer | null): string => c?.greeting() ?? "nobody"
