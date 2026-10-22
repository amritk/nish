// The handshake family's Go twin, under the contract in
// bench/crypto/README.md and the inputs in this family's README.md. tls13 is
// crypto/tls over net.Pipe; quic is quic-go over a pair of in-memory
// net.PacketConns, the only transport it needs. Each iteration is one full
// handshake, client and server in this process, then the message sent and
// read back. The runner builds it with lib/gen.go beside it; `-tags purego`
// is the portable column.
package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"time"

	"github.com/quic-go/quic-go"
)

// The certificate and key every twin serves: tests/link/net_tls_common/server.ts's leaf.
const leafCertificate = "308201133081bba003020102020101300a06082a8648ce3d04030230143112301006035504030c096c6f63616c686f7374301e" +
	"170d3236303130313030303030305a170d3236303130323030303030305a30143112301006035504030c096c6f63616c686f" +
	"73743059301306072a8648ce3d020106082a8648ce3d0301070342000460fed4ba255a9d31c961eb74c6356d68c049b8923b" +
	"61fa6ce669622e60f29fb67903fe1008b8bc99a41ae9e95628bc64f2f1b20c2d7e9f5177a3c294d4462299300a06082a8648" +
	"ce3d040302034700304402200c0b8258087e44f6428624ddfd22cc752379dd41ca39ecfb138a13c8a47193e102200d00e6e9" +
	"e36e4d0b5caa1cc1c6feea59eb10c1b010c9edff71a38b182cb8631d"
const leafPKCS8 = "308187020100301306072a8648ce3d020106082a8648ce3d030107046d306b0201010420c9afa9d845ba75166b5c215767b1" +
	"d6934e50c3db36e89b127b8a622b120f6721a1440342000460fed4ba255a9d31c961eb74c6356d68c049b8923b61fa6ce669" +
	"622e60f29fb67903fe1008b8bc99a41ae9e95628bc64f2f1b20c2d7e9f5177a3c294d4462299"

func fail(what string, err error) {
	fmt.Fprintf(os.Stderr, "go: %s failed: %v\n", what, err)
	os.Exit(1)
}

// configs pins both sides to TLS 1.3 over X25519 alone; Go 1.24's default
// would offer X25519MLKEM768 first. Go cannot choose a TLS 1.3 suite, so the
// folded suite is what shows it picked TLS_AES_128_GCM_SHA256.
func configs(alpn []string) (*tls.Config, *tls.Config) {
	certificate, _ := hex.DecodeString(leafCertificate)
	pkcs8, _ := hex.DecodeString(leafPKCS8)
	key, err := x509.ParsePKCS8PrivateKey(pkcs8)
	if err != nil {
		fail("loading the leaf", err)
	}
	groups := []tls.CurveID{tls.X25519}
	server := &tls.Config{
		Certificates:           []tls.Certificate{{Certificate: [][]byte{certificate}, PrivateKey: key}},
		MinVersion:             tls.VersionTLS13,
		CurvePreferences:       groups,
		NextProtos:             alpn,
		SessionTicketsDisabled: true,
	}
	// The leaf's validity ended in 2026 and it names no trust anchor, so the
	// client skips the chain; it still checks the CertificateVerify signature.
	client := &tls.Config{
		InsecureSkipVerify: true,
		MinVersion:         tls.VersionTLS13,
		CurvePreferences:   groups,
		NextProtos:         alpn,
	}
	return server, client
}

// negotiated is the suite and the group, two bytes each, big-endian. Go 1.24's
// ConnectionState has no group, so the group is X25519, the only one either
// side offers: any other would have failed the handshake.
func negotiated(state tls.ConnectionState) []byte {
	return []byte{byte(state.CipherSuite >> 8), byte(state.CipherSuite), byte(tls.X25519 >> 8), byte(tls.X25519)}
}

func tlsOnce(server, client *tls.Config) func([]byte) []byte {
	return func(msg []byte) []byte {
		a, b := net.Pipe()
		s := tls.Server(b, server)
		c := tls.Client(a, client)
		done := make(chan error, 1)
		go func() {
			if err := s.Handshake(); err != nil {
				done <- err
				return
			}
			echo := make([]byte, len(msg))
			if _, err := io.ReadFull(s, echo); err != nil {
				done <- err
				return
			}
			_, err := s.Write(echo)
			done <- err
		}()
		if err := c.Handshake(); err != nil {
			fail("the client handshake", err)
		}
		out := negotiated(c.ConnectionState())
		if _, err := c.Write(msg); err != nil {
			fail("the write", err)
		}
		echo := make([]byte, len(msg))
		if _, err := io.ReadFull(c, echo); err != nil {
			fail("the read", err)
		}
		if err := <-done; err != nil {
			fail("the server", err)
		}
		// The pipe ends, not the TLS conns: a close_notify would wait on an
		// unbuffered pipe that no one reads any more.
		a.Close()
		b.Close()
		return append(out, echo...)
	}
}

// memConn is one end of an in-memory datagram link: what one end writes, the
// other reads, whole, as UDP would deliver it. A full queue drops, as UDP does.
type memConn struct {
	local, remote net.Addr
	in, out       chan []byte
	wake, closed  chan struct{}
}

type timeout struct{}

func (timeout) Error() string   { return "i/o timeout" }
func (timeout) Timeout() bool   { return true }
func (timeout) Temporary() bool { return true }

func memPair() (*memConn, *memConn) {
	ab, ba := make(chan []byte, 256), make(chan []byte, 256)
	a := &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1), Port: 1}
	b := &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1), Port: 2}
	return &memConn{a, b, ba, ab, make(chan struct{}, 1), make(chan struct{})},
		&memConn{b, a, ab, ba, make(chan struct{}, 1), make(chan struct{})}
}

func (m *memConn) ReadFrom(p []byte) (int, net.Addr, error) {
	select {
	case d := <-m.in:
		return copy(p, d), m.remote, nil
	case <-m.wake:
		return 0, nil, timeout{}
	case <-m.closed:
		return 0, nil, net.ErrClosed
	}
}

func (m *memConn) WriteTo(p []byte, _ net.Addr) (int, error) {
	select {
	case m.out <- append([]byte(nil), p...):
	default:
	}
	return len(p), nil
}

func (m *memConn) Close() error {
	close(m.closed)
	return nil
}

func (m *memConn) LocalAddr() net.Addr { return m.local }

func (m *memConn) SetDeadline(t time.Time) error { return m.SetReadDeadline(t) }

// SetReadDeadline is honoured for a deadline already past, which is how
// quic-go unblocks a read it is closing; it sets no other.
func (m *memConn) SetReadDeadline(t time.Time) error {
	if !t.IsZero() && !t.After(time.Now()) {
		select {
		case m.wake <- struct{}{}:
		default:
		}
	}
	return nil
}

func (m *memConn) SetWriteDeadline(time.Time) error { return nil }

func quicOnce(server, client *tls.Config) func([]byte) []byte {
	a, b := memPair()
	listener, err := (&quic.Transport{Conn: b}).Listen(server, nil)
	if err != nil {
		fail("listening", err)
	}
	dialer := &quic.Transport{Conn: a}
	ctx := context.Background()
	return func(msg []byte) []byte {
		done := make(chan error, 1)
		go func() {
			conn, err := listener.Accept(ctx)
			if err != nil {
				done <- err
				return
			}
			stream, err := conn.AcceptStream(ctx)
			if err != nil {
				done <- err
				return
			}
			echo, err := io.ReadAll(stream)
			if err == nil {
				_, err = stream.Write(echo)
			}
			if err == nil {
				err = stream.Close()
			}
			done <- err
		}()
		conn, err := dialer.Dial(ctx, b.LocalAddr(), client, nil)
		if err != nil {
			fail("the dial", err)
		}
		stream, err := conn.OpenStreamSync(ctx)
		if err != nil {
			fail("opening a stream", err)
		}
		if _, err := stream.Write(msg); err != nil {
			fail("the write", err)
		}
		stream.Close()
		echo, err := io.ReadAll(stream)
		if err != nil {
			fail("the read", err)
		}
		if err := <-done; err != nil {
			fail("the server", err)
		}
		out := negotiated(conn.ConnectionState().TLS)
		conn.CloseWithError(0, "")
		return append(out, echo...)
	}
}

func main() {
	kernel, size, iterations := parseArgs("go")
	var once func([]byte) []byte
	switch kernel {
	case "tls13":
		once = tlsOnce(configs(nil))
	case "quic":
		// An in-memory conn has no socket buffer to size; quic-go would say so on stderr.
		os.Setenv("QUIC_GO_DISABLE_RECEIVE_BUFFER_WARNING", "true")
		once = quicOnce(configs([]string{"nish-echo"}))
	default:
		fmt.Fprintf(os.Stderr, "go: no kernel %s\n", kernel)
		os.Exit(2)
	}
	if size < 4 {
		fmt.Fprintln(os.Stderr, "go: the size is at least 4 bytes")
		os.Exit(2)
	}
	msg := inputs(kernel, size, 0, 0, 0, size).msg
	var base [4]byte
	copy(base[:], msg)
	sum := foldStart
	started := time.Now()
	for i := 0; i < iterations; i++ {
		tweak(msg, 0, base, uint32(i))
		out := once(msg)
		if len(out) != 4+size {
			fail("the echo", errors.New("a short record"))
		}
		sum = fold(sum, out)
	}
	report(sum, started)
}
