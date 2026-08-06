from __future__ import annotations

import base64
import gzip
import io
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PARTS = ROOT / "scripts/.jamplayer-rest"

DELETIONS = [
    "components/band-jam/band-jam-app.tsx",
    "components/band-jam/progression-picker.tsx",
    "lib/band-jam/stem-player.ts",
    "lib/band-jam/catalog.ts",
    "lib/band-jam/styles.ts",
    "lib/band-jam/progressions.ts",
    "lib/band-jam/types.ts",
    "lib/band-jam/packs.generated.json",
    "docs/jam-player-pilot.md",
]


def safe_members(archive: tarfile.TarFile):
    root = ROOT.resolve()
    for member in archive.getmembers():
        destination = (ROOT / member.name).resolve()
        if destination != root and root not in destination.parents:
            raise RuntimeError(f"Unsafe archive path: {member.name}")
        yield member


part_files = sorted(PARTS.glob("part-*"))
if len(part_files) != 8:
    raise RuntimeError(f"Expected 8 bundle parts, found {len(part_files)}")

payload = "".join(path.read_text(encoding="utf-8").strip() for path in part_files)
archive_bytes = gzip.decompress(base64.b64decode(payload, validate=True))

with tarfile.open(fileobj=io.BytesIO(archive_bytes), mode="r:") as archive:
    archive.extractall(ROOT, members=safe_members(archive))

for relative in DELETIONS:
    target = ROOT / relative
    if target.exists():
        target.unlink()

print("Applied reviewed JamPlayer source bundle")
