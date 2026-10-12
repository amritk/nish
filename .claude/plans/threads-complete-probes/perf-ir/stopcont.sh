#!/bin/bash
# usage: stopcont.sh APP RUNS -- runs APP (8 tasks, long critical sections, 4 threads)
# while sending SIGSTOP/SIGCONT every ~2 ms, so sleeping waiters return EINTR.
APP=$1; RUNS=$2; ok=0; bad=0; hang=0
for i in $(seq $RUNS); do
  NISH_NUM_THREADS=4 timeout 20 $APP 8 4000 300 0 > /tmp/sc.$$ 2>&1 & pid=$!
  # timeout's child is the app; signal the whole process group of the app
  for k in $(seq 40); do child=$(pgrep -P $pid | head -1); [ -n "$child" ] && { kill -STOP $child 2>/dev/null; kill -CONT $child 2>/dev/null; }; sleep 0.002; done
  wait $pid; c=$?
  if [ $c -eq 124 ]; then hang=$((hang+1)); elif [ $c -ne 0 ] || ! grep -q '^OK' /tmp/sc.$$; then bad=$((bad+1)); cat /tmp/sc.$$; else ok=$((ok+1)); fi
done
rm -f /tmp/sc.$$
echo "stopcont: ok=$ok bad=$bad hang=$hang"
