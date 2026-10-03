"""The aioquic side of `net_quic_conn_replay`: a QUIC client that completes a
handshake with the Nish server on 127.0.0.1:<port>, sends one line on a
bidirectional stream with FIN, reads the echo, checks it and closes.

`record.sh` runs it; `npm test` never does. aioquic is BSD-3-Clause and is
installed with pip, not vendored: nothing of it is in this repository.
"""

import asyncio
import ssl
import sys

from aioquic.asyncio.protocol import QuicConnectionProtocol
from aioquic.quic.configuration import QuicConfiguration
from aioquic.quic.connection import QuicConnection

MESSAGE = b"hello from aioquic"


async def run(port: int) -> int:
    configuration = QuicConfiguration(is_client=True, alpn_protocols=["nish-echo"])
    # The server's certificate is self-signed for "localhost"; what is under
    # test is the transport, not the PKI.
    configuration.verify_mode = ssl.CERT_NONE
    configuration.server_name = "localhost"
    # aioquic's `connect` opens an IPv6 socket, which a host without IPv6
    # refuses; an IPv4 endpoint driven by the same protocol works everywhere.
    loop = asyncio.get_running_loop()
    transport, client = await loop.create_datagram_endpoint(
        lambda: QuicConnectionProtocol(QuicConnection(configuration=configuration)),
        local_addr=("127.0.0.1", 0),
    )
    try:
        client.connect(("127.0.0.1", port))
        await client.wait_connected()
        reader, writer = await client.create_stream()
        writer.write(MESSAGE)
        writer.write_eof()
        echoed = await asyncio.wait_for(reader.read(), timeout=5)
        print(f"aioquic: handshake complete, echoed {echoed!r}")
        client.close()
        await client.wait_closed()
    finally:
        transport.close()
    return 0 if echoed == MESSAGE else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(asyncio.wait_for(run(int(sys.argv[1])), timeout=20)))
