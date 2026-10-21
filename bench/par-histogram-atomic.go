// Go twin of par-histogram-atomic.ts: four goroutines bin a stream each into
// sixteen atomic.Int32s, one Add per value, sixteen rounds, each round four
// goroutines joined by a sync.WaitGroup. Adding to a bin commutes, so the
// checksum is the same whatever order the adds landed in, and the total is
// the count of values binned.
package main

import (
	"fmt"
	"sync"
	"sync/atomic"
)

const rounds = 16 // bench:n
const tasks = 4
const count = 50000

// binStream draws count values of the ZX81's generator from seed, each one atomic add on its bin.
func binStream(seed int32, bins *[16]atomic.Int32) {
	v := seed
	for i := 0; i < count; i++ {
		v = (v*75 + 74) % 65537
		bins[v&15].Add(1)
	}
}

func main() {
	var bins [16]atomic.Int32
	check := int32(0)
	total := int32(0)
	var wg sync.WaitGroup
	for r := int32(0); r < rounds; r++ {
		for t := int32(0); t < tasks; t++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				binStream(r*tasks+t+1, &bins)
			}()
		}
		wg.Wait()
		for b := range bins {
			n := bins[b].Swap(0)
			check = (check*31 + n) % 65521
			total += n
		}
	}
	fmt.Println(check, total)
}
