# The quic-interop-runner's network simulator, with its run.sh made to keep
# the packets of the last fraction of a second.
#
#   docker build -f tests/interop/simulator.dockerfile --build-arg SIMULATOR="$SIMULATOR" tests/interop
#
# run.sh starts one dumpcap per interface and, on compose's SIGTERM, forwards
# the signal at once and exits. libpcap's TPACKET_V3 ring hands dumpcap a
# block only when the block fills or its timeout expires, so the packets of
# the last ~250 ms are still in the kernel when dumpcap stops, and are lost;
# then PID 1's exit kills dumpcap before it writes what it holds. The
# handshake case closes within about 80 ms of its first packet, so the server
# trace held no QUIC at all and the runner failed it with "Expected exactly
# one version. Got []". The patch waits 0.5 s before forwarding the signal,
# so the block retires, and waits until every job has exited. The build fails
# if the script no longer has the lines the patch rewrites.
ARG SIMULATOR
FROM ${SIMULATOR}
RUN sed -i \
      -e 's/^trap "kill -SIGINT /trap "sleep 0.5; kill -SIGINT /' \
      -e 's/^trap "kill -SIGTERM /trap "sleep 0.5; kill -SIGTERM /' \
      -e 's/^wait$/while [ -n "$(jobs -pr)" ]; do wait || true; done/' \
      /ns3/run.sh \
 && grep -q '^trap "sleep 0.5; kill -SIGINT ' /ns3/run.sh \
 && grep -q '^trap "sleep 0.5; kill -SIGTERM ' /ns3/run.sh \
 && grep -q '^while \[ -n "$(jobs -pr)" \]; do wait || true; done$' /ns3/run.sh
