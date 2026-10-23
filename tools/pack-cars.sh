#!/bin/sh
# Rebuilds assets/cars/*.json from the downloaded Sketchfab .glb files in $SRC (see CREDITS.md).
# needs NODE_PATH and GLTF_TRANSFORM pointing at a @gltf-transform/cli install
set -e
SRC=${SRC:-/home/claude/models_in/u}; TMP=$(mktemp -d)
car() { # name file materialDrop nodeDrop strip ratio error texSize
  node tools/prep-car.mjs "$SRC/$2" "$TMP/$1.glb" "$3" "$4" $5
  node tools/pack-model.mjs "$TMP/$1.glb" "assets/cars/$1.json" "$6" "$7" "$8" | tail -1
}
car model3 model3.glb 'Seat_Leather|Putih|Carpet|movsteer_1\.0\.0|belt|texture_Buttons|LCDs|light_night|mirror_inside|satin_red|^Plastic\.0|platnomor|hitam\.0|aluminium2|door_lf\.[05]' 'chrome\.001_movsteer|chrome_bonnet|platnomor' '' 0.1 0.003 512
car modely modely.glb '^black$|04_-_Default' '^$' '' 0.12 0.003 512
car cybertruck cybertruck_a.glb '^material$' '^$' strip 0.04 0.004 512
car ioniq5 ioniq5.glb '^$' '^$' '' 1 0.001 1024
car dolphin dolphin.glb 'Cuero|D_Til|D_Buttons|D_Dashboard|Orange_ST|D_Roof|phong6|D_carpet|^D_orange$|Speaker|PlasIN|Plastic_N_2|Plastic_S|D_badges' '^$' strip 0.15 0.003 512
car sealion7 sealion7.glb '^interior$' 'logo|badge|BYD' strip 0.2 0.003 512
car torino torino.glb 'bancos|^logo|floor|luz_interna' '^$' '' 0.2 0.003 512
