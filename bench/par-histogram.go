// Go twin of par-histogram.ts: four goroutines bin a stream each into one
// [16]int32 behind a sync.Mutex, taking the lock once per value, sixteen
// rounds, each round four goroutines joined by a sync.WaitGroup. Adding to a
// bin commutes, so the checksum is the same whatever order the critical
// sections ran in, and the total is the count of values binned.
package main

import (
	"fmt"
	"sync"
)

const rounds = 16 // bench:n
const tasks = 4
const count = 50000

type hist struct {
	mu   sync.Mutex
	bins [16]int32
}

// binStream draws count values of the ZX81's generator from seed, each binned under the lock.
func binStream(seed int32, h *hist) {
	v := seed
	for i := 0; i < count; i++ {
		v = (v*75 + 74) % 65537
		bin := v & 15
		h.mu.Lock()
		h.bins[bin]++
		h.mu.Unlock()
	}
}

func main() {
	h := &hist{}
	check := int32(0)
	total := int32(0)
	var wg sync.WaitGroup
	for r := int32(0); r < rounds; r++ {
		for t := int32(0); t < tasks; t++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				binStream(r*tasks+t+1, h)
			}()
		}
		wg.Wait()
		h.mu.Lock()
		for b := range h.bins {
			check = (check*31 + h.bins[b]) % 65521
			total += h.bins[b]
			h.bins[b] = 0
		}
		h.mu.Unlock()
	}
	fmt.Println(check, total)
}
