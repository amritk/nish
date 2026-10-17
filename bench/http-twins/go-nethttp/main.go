// The net/http twin of bench/http1-server.ts. GOMAXPROCS=1 gives the Go
// scheduler one thread to run goroutines on, the one core the Nish server gets.
//
//	serve <port> [ignored...]
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"runtime"
	"sync/atomic"
)

var requests atomic.Int64

type message struct {
	Message string `json:"message"`
	N       int64  `json:"n"`
}

func answer(w http.ResponseWriter, r *http.Request) {
	n := requests.Add(1)
	h := w.Header()
	switch {
	case r.Method == http.MethodGet && r.URL.Path == "/plaintext":
		h.Set("Content-Type", "text/plain")
		io.WriteString(w, "Hello, World!")
	case r.Method == http.MethodGet && r.URL.Path == "/json":
		body, _ := json.Marshal(message{"Hello, World!", n})
		h.Set("Content-Type", "application/json")
		w.Write(body)
	case r.Method == http.MethodPost && r.URL.Path == "/json-echo":
		// A pointer, so that a body of `null` leaves it nil and is refused.
		var order *Order
		in, err := io.ReadAll(r.Body)
		if err == nil {
			err = json.Unmarshal(in, &order)
		}
		if err != nil || order == nil {
			h.Set("Content-Type", "text/plain")
			w.WriteHeader(http.StatusBadRequest)
			io.WriteString(w, "bad request")
			return
		}
		order.Revision++
		body, _ := json.Marshal(order)
		h.Set("Content-Type", "application/json")
		w.Write(body)
	default:
		h.Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusNotFound)
		io.WriteString(w, "not found")
	}
}

func main() {
	runtime.GOMAXPROCS(1)
	port := "8080"
	if len(os.Args) > 1 {
		port = os.Args[1]
	}
	ln, err := net.Listen("tcp", "127.0.0.1:"+port)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println("listening", port)
	err = http.Serve(ln, http.HandlerFunc(answer))
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
