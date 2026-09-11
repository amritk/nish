// Go twin of sieve.ts: a []bool indexed with an int32, so every store is
// bounds-checked exactly as it is in Nish and in the Rust twin (the
// compiler hoists or drops what it can prove).
package main

import "fmt"

const N = 10000000 // bench:n
const PASSES = 20

func sieve(composite []bool, n int32) int32 {
	for i := int32(0); i <= n; i++ {
		composite[i] = false
	}
	for i := int32(2); i*i <= n; i++ {
		if !composite[i] {
			for j := i * i; j <= n; j += i {
				composite[j] = true
			}
		}
	}
	count := int32(0)
	for i := int32(2); i <= n; i++ {
		if !composite[i] {
			count++
		}
	}
	return count
}

func main() {
	composite := make([]bool, N+1)
	total := int32(0)
	for pass := 0; pass < PASSES; pass++ {
		total += sieve(composite, N)
	}
	fmt.Println(total)
}
