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


def extract_payload(payload: str) -> None:
    archive_bytes = gzip.decompress(base64.b64decode(payload, validate=True))
    with tarfile.open(fileobj=io.BytesIO(archive_bytes), mode="r:") as archive:
        archive.extractall(ROOT, members=safe_members(archive))


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def wrap_async_main(path: Path, marker: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if marker not in text:
        raise RuntimeError(f"{label}: entry marker not found")
    head, body = text.split(marker, 1)
    body = marker + body
    indented = "\n".join(f"  {line}" if line else "" for line in body.splitlines())
    path.write_text(
        head
        + "async function main(): Promise<void> {\n"
        + indented
        + "\n}\n\n"
        + "void main().catch((error) => {\n"
        + "  console.error(error)\n"
        + "  process.exitCode = 1\n"
        + "})\n",
        encoding="utf-8",
    )


part_files = sorted(PARTS.glob("part-*"))
if len(part_files) != 8:
    raise RuntimeError(f"Expected 8 bundle parts, found {len(part_files)}")

extract_payload(
    "".join(path.read_text(encoding="utf-8").strip() for path in part_files),
)

build_script = ROOT / "scripts/build-jam-player-shards.ts"
wrap_async_main(build_script, "const catalogText = await readFile(", "build shards")

check_script = ROOT / "scripts/check-jam-player-catalog.ts"
replace_once(
    check_script,
    "const catalog = catalogJson as CatalogJson",
    "const catalog = catalogJson as unknown as CatalogJson",
    "catalog type assertion",
)
wrap_async_main(check_script, "const root = process.cwd()", "catalog check")

sfz_test = ROOT / "lib/band-jam/engine/sfz.test.ts"
replace_once(
    sfz_test,
    'import { readFileSync } from "node:fs"',
    'import { existsSync, readFileSync } from "node:fs"',
    "SFZ fs import",
)
replace_once(
    sfz_test,
    'function loadSfz(filename: string) {\n'
    '  return readFileSync(path.join(PROTOTYPE_DIR, filename), "utf-8")\n'
    '}\n',
    'function loadSfz(filename: string) {\n'
    '  const filePath = path.join(PROTOTYPE_DIR, filename)\n'
    '  return existsSync(filePath) ? readFileSync(filePath, "utf-8") : ""\n'
    '}\n',
    "optional SFZ fixture loader",
)
replace_once(
    sfz_test,
    'const WEB_POWER2_FILE = path.resolve(\n'
    '  process.cwd(),\n'
    '  "public/jam-player/instruments/drums-power2/drums-power2.sfz",\n'
    ')\n',
    'const WEB_POWER2_FILE = path.resolve(\n'
    '  process.cwd(),\n'
    '  "public/jam-player/instruments/drums-power2/drums-power2.sfz",\n'
    ')\n\n'
    'const hasPrototypeFixtures = [GUITAR_FILE, BASS_FILE, DRUMS_FILE].every((filename) =>\n'
    '  existsSync(path.join(PROTOTYPE_DIR, filename)),\n'
    ')\n'
    'const describePrototype = hasPrototypeFixtures ? describe : describe.skip\n',
    "SFZ fixture availability",
)
for title in (
    "parseSfz — SolidGuitar1 MegaVoice",
    "parseSfz — ElectricBass MegaVoice",
    "parseSfz — StandardKit1 GM drums",
):
    replace_once(
        sfz_test,
        f'describe("{title}"',
        f'describePrototype("{title}"',
        f"portable SFZ suite {title}",
    )

for relative in DELETIONS:
    target = ROOT / relative
    if target.exists():
        target.unlink()

print("Applied reviewed JamPlayer source bundle")
