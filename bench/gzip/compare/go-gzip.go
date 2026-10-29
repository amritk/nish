// bench/gzip/compare's Go comparator: the standard library's compress/gzip and
// klauspost/compress/gzip, each with a reused writer (Reset onto a reused
// buffer) and a reused reader (Reset onto the stream). Same arguments and row
// format as bench/gzip/main.ts: compare.mjs reads the lines.
package main

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"strconv"
	"time"

	stdgzip "compress/gzip"

	kgzip "github.com/klauspost/compress/gzip"
)

type writer interface {
	io.WriteCloser
	Reset(io.Writer)
}

type reader interface {
	io.Reader
	Reset(io.Reader) error
}

func run(name string, newWriter func(level int) writer, newReader func(r io.Reader) reader, body []byte, streams [2][]byte, calls int) {
	var buf bytes.Buffer
	buf.Grow(2*len(body) + 64)
	for k, level := range []int{1, 6} {
		w := newWriter(level)
		compress := func() {
			buf.Reset()
			w.Reset(&buf)
			w.Write(body)
			w.Close()
		}
		for i := 0; i < 200; i++ {
			compress()
		}
		t := time.Now()
		for i := 0; i < calls; i++ {
			compress()
		}
		fmt.Printf("%s gzip -%d %d %d %d %d\n", name, level, len(body), buf.Len(), time.Since(t).Nanoseconds(), calls)

		stream := streams[k]
		back := make([]byte, len(body))
		src := bytes.NewReader(stream)
		r := newReader(src)
		decompress := func() {
			src.Reset(stream)
			if err := r.Reset(src); err != nil {
				panic(err)
			}
			if n, err := io.ReadFull(r, back); err != nil || n != len(body) {
				panic(err)
			}
		}
		for i := 0; i < 200; i++ {
			decompress()
		}
		t = time.Now()
		for i := 0; i < calls; i++ {
			decompress()
		}
		fmt.Printf("%s gunzip -%d %d %d %d %d\n", name, level, len(body), len(stream), time.Since(t).Nanoseconds(), calls)
	}
}

func main() {
	body, _ := os.ReadFile(os.Args[1])
	calls, _ := strconv.Atoi(os.Args[2])
	gz1, _ := os.ReadFile(os.Args[3])
	gz6, _ := os.ReadFile(os.Args[4])
	streams := [2][]byte{gz1, gz6}
	run("go-std",
		func(level int) writer { w, _ := stdgzip.NewWriterLevel(nil, level); return w },
		func(r io.Reader) reader { z, _ := stdgzip.NewReader(r); return z },
		body, streams, calls)
	run("go-klauspost",
		func(level int) writer { w, _ := kgzip.NewWriterLevel(nil, level); return w },
		func(r io.Reader) reader { z, _ := kgzip.NewReader(r); return z },
		body, streams, calls)
}
