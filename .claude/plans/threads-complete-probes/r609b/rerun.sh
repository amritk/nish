#!/bin/bash
R=/tmp/claude-0/-home-user/495d7503-79d7-5bad-b184-656df3811dd4/scratchpad/r609
which=$1; dir=$2; tag=$3
ls $dir/*.ts | grep -v q06c_from_max | xargs -P 4 -I{} bash -c "bash $R/probe609.sh $which {} > $R/r2/out/\$(basename {} .ts).$which.$tag 2>&1"
