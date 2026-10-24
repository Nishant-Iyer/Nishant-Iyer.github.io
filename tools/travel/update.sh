#!/usr/bin/env bash
# Rebuild the travel book from the latest Wikivoyage dump.
# Run from anywhere: tools/travel/update.sh   (needs python3 + numpy, ~2 minutes, ~1 GB RAM)
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p raw data state
UA="konnectingnots-travel-book/1.0 (contact@konnectingnots.com)"

# Latest finished monthly dump (Wikimedia publishes one on the 1st of each month)
DUMP=""
for d in $(curl -fsS -A "$UA" https://dumps.wikimedia.org/enwikivoyage/ | grep -o 'href="[0-9]\{8\}/"' | grep -o '[0-9]\{8\}' | sort -r); do
  if curl -fsSI -A "$UA" "https://dumps.wikimedia.org/enwikivoyage/$d/enwikivoyage-$d-pages-articles.xml.bz2" >/dev/null 2>&1; then DUMP=$d; break; fi
done
[ -n "$DUMP" ] || { echo "No finished dump found"; exit 1; }
DUMP_DATE="${DUMP:0:4}-${DUMP:4:2}-${DUMP:6:2}"
echo "Using Wikivoyage dump $DUMP_DATE"

curl -fsSL -A "$UA" -o raw/wv.xml.bz2 "https://dumps.wikimedia.org/enwikivoyage/$DUMP/enwikivoyage-$DUMP-pages-articles.xml.bz2"
curl -fsSL -o raw/airports.csv https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv

BEFORE=$(find ../../travel -name index.html 2>/dev/null | wc -l)
python3 load.py
DUMP_DATE="$DUMP_DATE" python3 build_data.py
python3 render.py ../../travel.new
cp -r assets/* ../../travel.new/assets/
AFTER=$(find ../../travel.new -name index.html | wc -l)
echo "Pages: before $BEFORE, after $AFTER"

# Safety: refuse to publish if the new build lost more than 10% of pages (a broken dump or parser)
if [ "$BEFORE" -gt 0 ] && [ "$AFTER" -lt $(( BEFORE * 9 / 10 )) ]; then
  echo "New build has too few pages; keeping the current site"; rm -rf ../../travel.new; exit 1
fi
rm -rf ../../travel && mv ../../travel.new ../../travel
echo "$DUMP_DATE" > state/last-dump.txt
