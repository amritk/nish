// The hash family's Go twin: crypto/sha256, crypto/sha512, crypto/hmac and
// crypto/hkdf, under the contract in bench/crypto/README.md and the inputs in
// this family's README.md. The runner builds it with lib/gen.go beside it;
// `-tags purego` is the portable column.
package main

import (
	"crypto/hkdf"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/sha512"
	"fmt"
	"os"
	"time"
)

func main() {
	kernel, size, iterations := parseArgs("go")
	shapes := map[string][2]int{"sha256": {0, 0}, "sha512": {0, 0}, "hmac-sha256": {32, 0}, "hkdf-sha256": {32, 10}}
	shape, ok := shapes[kernel]
	if !ok {
		fmt.Fprintf(os.Stderr, "go: no kernel %s\n", kernel)
		os.Exit(2)
	}
	inp := inputs(kernel, size, shape[0], 0, shape[1], size)
	msg := inp.msg
	var base [4]byte
	copy(base[:], msg)
	var once func() []byte
	switch kernel {
	case "sha256":
		once = func() []byte { d := sha256.Sum256(msg); return d[:] }
	case "sha512":
		once = func() []byte { d := sha512.Sum512(msg); return d[:] }
	case "hmac-sha256":
		// Keyed per message, as every other twin's one-shot HMAC is.
		once = func() []byte { mac := hmac.New(sha256.New, inp.key); mac.Write(msg); return mac.Sum(nil) }
	case "hkdf-sha256":
		info := string(inp.aad)
		once = func() []byte {
			out, err := hkdf.Key(sha256.New, msg, inp.key, info, 42)
			if err != nil {
				fmt.Fprintf(os.Stderr, "go: hkdf: %v\n", err)
				os.Exit(1)
			}
			return out
		}
	}
	sum := foldStart
	started := time.Now()
	for i := 0; i < iterations; i++ {
		tweak(msg, 0, base, uint32(i))
		sum = fold(sum, once())
	}
	report(sum, started)
}
