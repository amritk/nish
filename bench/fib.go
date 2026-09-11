// Go twin of fib.ts: same shape, same checksum line. Go's integers wrap on
// overflow like Nish's; fib(40) does not overflow an int32 anyway.
package main

import "fmt"

const N = 40 // bench:n

func fib(n int32) int32 {
	if n < 2 {
		return n
	}
	return fib(n-1) + fib(n-2)
}

func main() {
	fmt.Println(fib(N))
}
