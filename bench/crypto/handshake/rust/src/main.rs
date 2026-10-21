// The handshake family's Rust twin, under the contract in
// bench/crypto/README.md and the inputs in this family's README.md. tls13 is
// rustls with the ring provider, the two connections joined by byte buffers;
// quic is quinn-proto, which does no I/O of its own, so the datagrams move
// between the two endpoints in memory. Each iteration is one full handshake,
// client and server in this process, then the message sent and read back. The
// runner copies lib/gen.rs in as src/gen.rs. ring has no portable switch.
mod gen;

use bytes::{Bytes, BytesMut};
use quinn_proto::crypto::rustls::{QuicClientConfig, QuicServerConfig};
use quinn_proto::{
    ClientConfig, Connection, ConnectionHandle, DatagramEvent, Dir, Endpoint, EndpointConfig, ServerConfig,
    StreamId, VarInt,
};
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::crypto::{ring, CryptoProvider, WebPkiSupportedAlgorithms};
use rustls::pki_types::{CertificateDer, PrivateKeyDer, PrivatePkcs8KeyDer, ServerName, UnixTime};
use rustls::{ClientConnection, ConnectionCommon, DigitallySignedStruct, ServerConnection, SignatureScheme};
use std::io::{Read, Write};
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;

// The certificate and key every twin serves: tests/link/net_tls_common/server.ts's leaf.
const LEAF_CERTIFICATE: &str = concat!(
    "308201133081bba003020102020101300a06082a8648ce3d04030230143112301006035504030c096c6f63616c686f7374301e",
    "170d3236303130313030303030305a170d3236303130323030303030305a30143112301006035504030c096c6f63616c686f",
    "73743059301306072a8648ce3d020106082a8648ce3d0301070342000460fed4ba255a9d31c961eb74c6356d68c049b8923b",
    "61fa6ce669622e60f29fb67903fe1008b8bc99a41ae9e95628bc64f2f1b20c2d7e9f5177a3c294d4462299300a06082a8648",
    "ce3d040302034700304402200c0b8258087e44f6428624ddfd22cc752379dd41ca39ecfb138a13c8a47193e102200d00e6e9",
    "e36e4d0b5caa1cc1c6feea59eb10c1b010c9edff71a38b182cb8631d",
);
const LEAF_PKCS8: &str = concat!(
    "308187020100301306072a8648ce3d020106082a8648ce3d030107046d306b0201010420c9afa9d845ba75166b5c215767b1",
    "d6934e50c3db36e89b127b8a622b120f6721a1440342000460fed4ba255a9d31c961eb74c6356d68c049b8923b61fa6ce669",
    "622e60f29fb67903fe1008b8bc99a41ae9e95628bc64f2f1b20c2d7e9f5177a3c294d4462299",
);

fn fail(what: &str) -> ! {
    eprintln!("rust: {what} failed");
    std::process::exit(1);
}

fn unhex(hex: &str) -> Vec<u8> {
    (0..hex.len()).step_by(2).map(|i| u8::from_str_radix(&hex[i..i + 2], 16).unwrap()).collect()
}

// The leaf's validity ended in 2026 and it names no trust anchor, so the
// client skips the chain; it still checks the CertificateVerify signature.
#[derive(Debug)]
struct NoChain(WebPkiSupportedAlgorithms);

impl ServerCertVerifier for NoChain {
    fn verify_server_cert(
        &self,
        _: &CertificateDer<'_>,
        _: &[CertificateDer<'_>],
        _: &ServerName<'_>,
        _: &[u8],
        _: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        Ok(ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        rustls::crypto::verify_tls12_signature(message, cert, dss, &self.0)
    }

    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        rustls::crypto::verify_tls13_signature(message, cert, dss, &self.0)
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.0.supported_schemes()
    }
}

// Both sides pinned to TLS 1.3, TLS_AES_128_GCM_SHA256 and X25519, with no
// tickets, offering `alpn`: none on tls13, as no other twin offers one there.
fn configs(alpn: &[&[u8]]) -> (Arc<rustls::ServerConfig>, Arc<rustls::ClientConfig>) {
    let provider = Arc::new(CryptoProvider {
        cipher_suites: vec![ring::cipher_suite::TLS13_AES_128_GCM_SHA256],
        kx_groups: vec![ring::kx_group::X25519],
        ..ring::default_provider()
    });
    let key = PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(unhex(LEAF_PKCS8)));
    let mut server = rustls::ServerConfig::builder_with_provider(provider.clone())
        .with_protocol_versions(&[&rustls::version::TLS13])
        .and_then(|b| b.with_no_client_auth().with_single_cert(vec![CertificateDer::from(unhex(LEAF_CERTIFICATE))], key))
        .unwrap_or_else(|_| fail("loading the leaf"));
    server.send_tls13_tickets = 0;
    server.alpn_protocols = alpn.iter().map(|a| a.to_vec()).collect();
    let mut client = rustls::ClientConfig::builder_with_provider(provider.clone())
        .with_protocol_versions(&[&rustls::version::TLS13])
        .unwrap_or_else(|_| fail("configuring the client"))
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(NoChain(provider.signature_verification_algorithms)))
        .with_no_client_auth();
    client.alpn_protocols = alpn.iter().map(|a| a.to_vec()).collect();
    (Arc::new(server), Arc::new(client))
}

fn localhost() -> ServerName<'static> {
    ServerName::try_from("localhost").unwrap()
}

// Moves what `from` has to send into `to`, and has `to` process it.
fn transfer<A, B>(from: &mut ConnectionCommon<A>, to: &mut ConnectionCommon<B>, wire: &mut Vec<u8>) {
    wire.clear();
    while from.wants_write() {
        from.write_tls(wire).unwrap_or_else(|_| fail("a write"));
    }
    let mut rest = &wire[..];
    while !rest.is_empty() {
        to.read_tls(&mut rest).unwrap_or_else(|_| fail("a read"));
        to.process_new_packets().unwrap_or_else(|_| fail("the handshake"));
    }
}

fn tls_once(server: &Arc<rustls::ServerConfig>, client: &Arc<rustls::ClientConfig>, msg: &[u8], out: &mut Vec<u8>) {
    let mut c = ClientConnection::new(client.clone(), localhost()).unwrap_or_else(|_| fail("a new client"));
    let mut s = ServerConnection::new(server.clone()).unwrap_or_else(|_| fail("a new server"));
    let mut wire = Vec::new();
    for _ in 0..16 {
        if !c.is_handshaking() && !s.is_handshaking() {
            break;
        }
        transfer(&mut c, &mut s, &mut wire);
        transfer(&mut s, &mut c, &mut wire);
    }
    if c.is_handshaking() || s.is_handshaking() {
        fail("the handshake");
    }
    let suite = u16::from(c.negotiated_cipher_suite().unwrap_or_else(|| fail("the suite")).suite());
    let group = u16::from(c.negotiated_key_exchange_group().unwrap_or_else(|| fail("the group")).name());
    let mut echo = vec![0u8; msg.len()];
    c.writer().write_all(msg).unwrap_or_else(|_| fail("the write"));
    transfer(&mut c, &mut s, &mut wire);
    s.reader().read_exact(&mut echo).unwrap_or_else(|_| fail("the server's read"));
    s.writer().write_all(&echo).unwrap_or_else(|_| fail("the server's write"));
    transfer(&mut s, &mut c, &mut wire);
    c.reader().read_exact(&mut echo).unwrap_or_else(|_| fail("the read"));
    out.clear();
    out.extend_from_slice(&suite.to_be_bytes());
    out.extend_from_slice(&group.to_be_bytes());
    out.extend_from_slice(&echo);
}

// One endpoint and its one connection; `inbox` holds the datagrams the other
// side has sent it and it has not yet read.
struct Side {
    endpoint: Endpoint,
    addr: SocketAddr,
    conn: Option<(ConnectionHandle, Connection)>,
    inbox: Vec<BytesMut>,
}

impl Side {
    fn new(server: Option<Arc<ServerConfig>>, port: u16) -> Side {
        Side {
            endpoint: Endpoint::new(Arc::new(EndpointConfig::default()), server, false, None),
            addr: SocketAddr::from(([127, 0, 0, 1], port)),
            conn: None,
            inbox: Vec::new(),
        }
    }

    // Reads the inbox, then sends what the connection has queued into `peer`;
    // false when there was nothing to do.
    fn step(&mut self, peer: &mut Side, now: Instant, buf: &mut Vec<u8>) -> bool {
        let mut moved = false;
        for datagram in std::mem::take(&mut self.inbox) {
            moved = true;
            buf.clear();
            match self.endpoint.handle(now, peer.addr, None, None, datagram, buf) {
                Some(DatagramEvent::NewConnection(incoming)) => {
                    buf.clear();
                    match self.endpoint.accept(incoming, now, buf, None) {
                        Ok(conn) => self.conn = Some(conn),
                        Err(_) => fail("the accept"),
                    }
                }
                Some(DatagramEvent::ConnectionEvent(_, event)) => {
                    self.conn.as_mut().unwrap_or_else(|| fail("a stray datagram")).1.handle_event(event)
                }
                Some(DatagramEvent::Response(t)) => peer.inbox.push(BytesMut::from(&buf[..t.size])),
                None => {}
            }
        }
        if let Some((handle, conn)) = self.conn.as_mut() {
            while let Some(event) = conn.poll_endpoint_events() {
                if let Some(event) = self.endpoint.handle_event(*handle, event) {
                    conn.handle_event(event);
                }
            }
            buf.clear();
            while let Some(t) = conn.poll_transmit(now, 1, buf) {
                moved = true;
                peer.inbox.push(BytesMut::from(&buf[..t.size]));
                buf.clear();
            }
            while conn.poll().is_some() {}
        }
        moved
    }
}

// Reads what has arrived on `id` into `into`; true once the peer has finished it.
fn read(conn: &mut Connection, id: StreamId, into: &mut Vec<u8>) -> bool {
    let mut recv = conn.recv_stream(id);
    let mut chunks = recv.read(true).unwrap_or_else(|_| fail("a read"));
    let finished = loop {
        match chunks.next(usize::MAX) {
            Ok(Some(chunk)) => into.extend_from_slice(&chunk.bytes),
            Ok(None) => break true,
            Err(quinn_proto::ReadError::Blocked) => break false,
            Err(_) => fail("a read"),
        }
    };
    let _ = chunks.finalize();
    finished
}

fn quic_once(server: &Arc<ServerConfig>, client: &ClientConfig, msg: &[u8], out: &mut Vec<u8>) {
    let mut c = Side::new(None, 1);
    let mut s = Side::new(Some(server.clone()), 2);
    let mut now = Instant::now();
    c.conn = Some(
        c.endpoint.connect(now, client.clone(), s.addr, "localhost").unwrap_or_else(|_| fail("the connect")),
    );
    let mut buf = Vec::new();
    let (mut cstream, mut sstream) = (None, None);
    let (mut echoed, mut echo, mut back) = (false, Vec::new(), Vec::new());
    for _ in 0..1000 {
        let moved = c.step(&mut s, now, &mut buf) | s.step(&mut c, now, &mut buf);
        let cc = &mut c.conn.as_mut().unwrap().1;
        if cstream.is_none() && !cc.is_handshaking() {
            let id = cc.streams().open(Dir::Bi).unwrap_or_else(|| fail("opening a stream"));
            cc.send_stream(id).write(msg).unwrap_or_else(|_| fail("the write"));
            cc.send_stream(id).finish().unwrap_or_else(|_| fail("the finish"));
            cstream = Some(id);
        }
        if let Some((_, sc)) = s.conn.as_mut() {
            if sstream.is_none() {
                sstream = sc.streams().accept(Dir::Bi);
            }
            if let Some(id) = sstream.filter(|_| !echoed) {
                if read(sc, id, &mut echo) {
                    sc.send_stream(id).write(&echo).unwrap_or_else(|_| fail("the server's write"));
                    sc.send_stream(id).finish().unwrap_or_else(|_| fail("the server's finish"));
                    echoed = true;
                }
            }
        }
        if let Some(id) = cstream {
            if read(cc, id, &mut back) {
                break;
            }
        }
        if !moved {
            // Nothing in flight: let the next timer fire, as a clock would.
            let next = [&mut c, &mut s].into_iter().filter_map(|side| side.conn.as_mut()?.1.poll_timeout()).min();
            now = next.unwrap_or_else(|| fail("the exchange"));
            for side in [&mut c, &mut s] {
                if let Some((_, conn)) = side.conn.as_mut() {
                    conn.handle_timeout(now);
                }
            }
        }
    }
    if back.len() != msg.len() {
        fail("the echo");
    }
    c.conn.as_mut().unwrap().1.close(now, VarInt::from_u32(0), Bytes::new());
    // quinn-proto exposes no negotiated suite or group, so these are the
    // provider's only two, as configs pins them: any other would have failed.
    out.clear();
    out.extend_from_slice(&u16::from(ring::cipher_suite::TLS13_AES_128_GCM_SHA256.suite()).to_be_bytes());
    out.extend_from_slice(&u16::from(ring::kx_group::X25519.name()).to_be_bytes());
    out.extend_from_slice(&back);
}

fn main() {
    let (kernel, size, iterations) = gen::parse_args("rust");
    if kernel != "tls13" && kernel != "quic" {
        eprintln!("rust: no kernel {kernel}");
        std::process::exit(2);
    }
    if size < 4 {
        eprintln!("rust: the size is at least 4 bytes");
        std::process::exit(2);
    }
    let alpn: &[&[u8]] = if kernel == "quic" { &[b"nish-echo"] } else { &[] };
    let (server, client) = configs(alpn);
    let quic_server = Arc::new(ServerConfig::with_crypto(Arc::new(
        QuicServerConfig::try_from(server.clone()).unwrap_or_else(|_| fail("the QUIC server config")),
    )));
    let quic_client = ClientConfig::new(Arc::new(
        QuicClientConfig::try_from(client.clone()).unwrap_or_else(|_| fail("the QUIC client config")),
    ));
    let mut inp = gen::inputs(&kernel, size, 0, 0, 0, size);
    let base = [inp.msg[0], inp.msg[1], inp.msg[2], inp.msg[3]];
    let mut out = Vec::with_capacity(size + 4);
    let mut sum = gen::FOLD_START;
    let started = Instant::now();
    for i in 0..iterations {
        gen::tweak(&mut inp.msg, 0, base, i as u32);
        if kernel == "tls13" {
            tls_once(&server, &client, &inp.msg, &mut out);
        } else {
            quic_once(&quic_server, &quic_client, &inp.msg, &mut out);
        }
        sum = gen::fold(sum, &out);
    }
    gen::report(sum, started);
}
