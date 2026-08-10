#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
em++ native/material_kernel.cpp -O3 -std=c++20 \
  -sWASM=1 \
  -sWASM_BIGINT=1 \
  -sMODULARIZE=1 \
  -sEXPORT_NAME=createOuroborosKernel \
  -sALLOW_MEMORY_GROWTH=1 \
  -sENVIRONMENT=web \
  -sEXPORTED_FUNCTIONS="['_ok_reset','_ok_step','_ok_inject_water','_ok_inject_lava','_ok_n','_ok_terrain','_ok_sand','_ok_water','_ok_lava','_ok_lava_temp','_ok_steam','_ok_sediment','_ok_uw','_ok_vw','_ok_mass_water','_ok_mass_rock','_ok_evaporated','_ok_solidified','_ok_eroded','_ok_ticks']" \
  -o kernel.js
