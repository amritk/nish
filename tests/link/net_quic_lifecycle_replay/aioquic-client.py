"""The aioquic side of `net_quic_lifecycle_replay`: one QUIC client per
scenario against the Nish server on 127.0.0.1:<port>, each checking what it
observed and exiting 0 only if the server behaved as the scenario says.

- `version`: open in QUIC version 2, which the server does not speak; expect
  Version Negotiation, then a handshake and an echo in version 1.
- `retry`: expect a Retry, return its token, then a handshake and an echo.
- `keys`: update keys before the first line and expect the echo under the
  new phase; wait past a probe timeout, send a second line, and expect the
  server to have started an update of its own.
- `idle`: after an echo, stay silent past the server's three-second idle
  timeout, and expect the connection to have ended.
- `reset`: after an echo, send again; expect a datagram ending in the
  stateless reset token the server gave in its transport parameters. aioquic
  1.3.0 keeps that token but does not check incoming datagrams against it,
  so this script does, as RFC 9000 §10.3.1 describes.

`record.sh` runs it; `npm test` never does. aioquic is BSD-3-Clause and is
installed with pip, not vendored: nothing of it is in this repository.
"""

import asyncio
import ssl
import sys

from aioquic import tls
from aioquic.asyncio.protocol import QuicConnectionProtocol
from aioquic.quic.configuration import QuicConfiguration
from aioquic.quic.connection import QuicConnection
from aioquic.quic.events import ConnectionTerminated
from aioquic.quic.packet import QuicProtocolVersion


class Watched(QuicConnectionProtocol):
    """A client protocol that also notices a stateless reset."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.reset_seen = False
        self.terminated = None

    def datagram_received(self, data, addr):
        token = self._quic._peer_cid.stateless_reset_token
        if len(data) >= 21 and token and data[-16:] == token:
            self.reset_seen = True
        super().datagram_received(data, addr)

    def quic_event_received(self, event):
        if isinstance(event, ConnectionTerminated):
            self.terminated = event
        super().quic_event_received(event)


async def echo(client, message):
    reader, writer = await client.create_stream()
    writer.write(message)
    writer.write_eof()
    return await asyncio.wait_for(reader.read(), timeout=5)


async def run(port: int, scenario: str) -> int:
    configuration = QuicConfiguration(is_client=True, alpn_protocols=["nish-echo"])
    # The server's certificate is self-signed for "localhost"; what is under
    # test is the transport, not the PKI.
    configuration.verify_mode = ssl.CERT_NONE
    configuration.server_name = "localhost"
    if scenario == "version":
        configuration.original_version = QuicProtocolVersion.VERSION_2
        configuration.supported_versions = [
            QuicProtocolVersion.VERSION_2,
            QuicProtocolVersion.VERSION_1,
        ]
    # aioquic's `connect` opens an IPv6 socket, which a host without IPv6
    # refuses; an IPv4 endpoint driven by the same protocol works everywhere.
    loop = asyncio.get_running_loop()
    transport, client = await loop.create_datagram_endpoint(
        lambda: Watched(QuicConnection(configuration=configuration)),
        local_addr=("127.0.0.1", 0),
    )
    ok = False
    try:
        client.connect(("127.0.0.1", port))
        await client.wait_connected()
        quic = client._quic
        if scenario == "keys":
            # Wait for HANDSHAKE_DONE: an update needs a confirmed handshake.
            for _ in range(50):
                if quic._handshake_confirmed:
                    break
                await asyncio.sleep(0.02)
            quic.request_key_update()
            first = await echo(client, b"after the client's key update")
            phase_after_first = quic._cryptos[tls.Epoch.ONE_RTT].key_phase
            await asyncio.sleep(1.5)
            second = await echo(client, b"after the server's key update")
            phase_after_second = quic._cryptos[tls.Epoch.ONE_RTT].key_phase
            ok = (
                first == b"after the client's key update"
                and second == b"after the server's key update"
                and phase_after_first == 1
                and phase_after_second == 0
            )
            print(f"aioquic: key phases {phase_after_first} then {phase_after_second}")
            client.close()
            await client.wait_closed()
        elif scenario == "idle":
            echoed = await echo(client, b"then silence")
            await asyncio.sleep(4.5)
            ok = echoed == b"then silence" and client.terminated is not None
            print(f"aioquic: echoed {echoed!r}, then the connection ended: {client.terminated}")
        elif scenario == "reset":
            echoed = await echo(client, b"then the server forgets")
            reader, writer = await client.create_stream()
            writer.write(b"anyone there?")
            client.transmit()
            for _ in range(150):
                if client.reset_seen:
                    break
                await asyncio.sleep(0.02)
            ok = echoed == b"then the server forgets" and client.reset_seen
            print(f"aioquic: echoed {echoed!r}, stateless reset seen: {client.reset_seen}")
            # aioquic does not know its connection was reset, so a transmit it
            # scheduled fires after the socket is closed; that is not the test.
            loop.set_exception_handler(lambda _loop, _context: None)
        else:
            echoed = await echo(client, f"hello after {scenario}".encode())
            ok = echoed == f"hello after {scenario}".encode()
            if scenario == "version":
                ok = ok and quic._version == QuicProtocolVersion.VERSION_1
            if scenario == "retry":
                ok = ok and quic._retry_count == 1
            print(f"aioquic: echoed {echoed!r} in version {quic._version:#x}, retries {quic._retry_count}")
            client.close()
            await client.wait_closed()
    finally:
        transport.close()
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(asyncio.wait_for(run(int(sys.argv[1]), sys.argv[2]), timeout=30)))
