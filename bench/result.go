// Go twin of result.ts. Go has no Result type, so this is the same eight-byte
// two-word struct `amritc --emit-header` declares for `Result<number, number>`
// and result.c uses; Go's register ABI returns and passes it in registers for
// the same reason AmritScript does since WP17. (Go's own idiom, a `(value, ok)`
// pair of results, is the same two words in the same registers.)
package main

import "fmt"

const N = 200000000 // bench:n

type Result struct {
	ok    int32 // 1 = value, 0 = error
	value int32 // the error payload when ok == 0
}

func half(n int32) Result {
	if n%2 != 0 {
		return Result{ok: 0, value: n}
	}
	return Result{ok: 1, value: n / 2}
}

func combine(r Result) int32 {
	if r.ok == 0 {
		return -1
	}
	return r.value
}

func main() {
	acc := int32(0)
	for i := int32(0); i < N; i++ {
		acc = (acc + combine(half((i+acc)&0xffff))) & 0xffff
	}
	fmt.Println(acc)
}
