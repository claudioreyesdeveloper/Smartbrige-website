import { canonicalJsonSha256, sha256Bytes } from "@/lib/catalog/canonical"
import type { SectionManifest, TopLevelManifest } from "@/lib/catalog/manifest"
import { CATALOG_EXPORT_VERSION, SECTION_SCHEMA_VERSION } from "@/lib/catalog/constants"

export function midiBytes(seed: string): Uint8Array {
  return new TextEncoder().encode(`MThd-fixture-${seed}`)
}

export function buildSection(
  section: string,
  records: Record<string, unknown>[],
): SectionManifest {
  const recordsSha = canonicalJsonSha256(records)
  return {
    section,
    schema_version: SECTION_SCHEMA_VERSION,
    record_count: records.length,
    records,
    records_sha256: recordsSha,
  }
}

export function buildTopManifest(
  sections: SectionManifest[],
): { top: TopLevelManifest; contentParts: string[] } {
  const sectionSummaries: TopLevelManifest["sections"] = {}
  const contentParts: string[] = []

  for (const section of sections) {
    const assetChecksums = collectTopLevelAssetChecksums(section.records).sort()
    sectionSummaries[section.section] = {
      manifest_path: `${section.section}/manifest.json`,
      record_count: section.record_count,
      records_sha256: section.records_sha256,
    }
    contentParts.push(section.records_sha256)
    contentParts.push(...assetChecksums)
  }

  const contentTreeSha256 = canonicalJsonSha256(contentParts)
  return {
    top: {
      catalog_export_version: CATALOG_EXPORT_VERSION,
      schema_version: SECTION_SCHEMA_VERSION,
      source_provenance: {
        database_content_sha256: contentTreeSha256,
      },
      sections: sectionSummaries,
      content_tree_sha256: contentTreeSha256,
    },
    contentParts,
  }
}

function collectTopLevelAssetChecksums(records: Record<string, unknown>[]): string[] {
  const out: string[] = []
  for (const record of records) {
    if (record.asset && typeof record.asset === "object" && record.asset) {
      const asset = record.asset as Record<string, unknown>
      if (typeof asset.sha256 === "string") {
        out.push(asset.sha256.toLowerCase())
      }
    }
  }
  return out
}

export function assetRef(path: string, body: Uint8Array) {
  return {
    path,
    sha256: sha256Bytes(body),
    size_bytes: body.byteLength,
  }
}

export function createMinimalFactoryBundle(options?: {
  includeJamSong?: boolean
  tamperAssetHash?: boolean
  omitAssetBytes?: boolean
  absoluteAssetPath?: boolean
}) {
  const bassBody = midiBytes("bass")
  const soloBody = midiBytes("solo")
  const vocalBody = midiBytes("vocal")
  const clipBody = midiBytes("clip")

  const bassAsset = assetRef("assets/midi_clip_1.mid", bassBody)
  if (options?.tamperAssetHash) {
    bassAsset.sha256 = "a".repeat(64)
  }
  if (options?.absoluteAssetPath) {
    bassAsset.path = "/etc/passwd"
  }

  const midiSection = buildSection("midi_clips", [
    {
      stable_id: "midi_clip:1",
      clip: {
        id: 1,
        source_kind: "bass",
        category_name: "Funk",
        clip_name: "Groove A",
        midi_path: "a.mid",
      },
      source: {
        library: "EZbass",
        path: "a.mid",
        source_file: null,
        license: null,
        license_status: "UNKNOWN",
      },
      asset: bassAsset,
    },
  ])

  const soloSection = buildSection("solo_phrases", [
    {
      stable_id: "solo_phrase:solo-1",
      phrase: { id: "solo-1", instrument_family: "sax", genre: "jazz" },
      source: {
        library: "Twiddly",
        path: "a.mid",
        source_file: null,
        license: null,
        license_status: "UNKNOWN",
      },
      asset: assetRef("assets/solo_phrase_solo-1.mid", soloBody),
    },
  ])

  const vocalSection = buildSection("vocal_phrases", [
    {
      stable_id: "vocal_phrase:vocal-1",
      phrase: { id: "vocal-1", voice_profile: "male" },
      source: {
        library: "male",
        path: null,
        source_file: null,
        license: null,
        license_status: "UNKNOWN",
      },
      asset: assetRef("assets/vocal_phrase_vocal-1.mid", vocalBody),
    },
  ])

  const cmudictSection = buildSection("cmudict", [
    {
      stable_id: "cmudict:hello",
      entry: { word: "hello", phonemes: "HH AH0 L OW1", syllable_count: 2 },
      source: {
        library: "CMUdict",
        path: null,
        source_file: null,
        license: null,
        license_status: "UNKNOWN",
      },
    },
  ])

  const factoryRecords: Record<string, unknown>[] = [
    {
      stable_id: "factory_song:song-1",
      song: { id: "song-1", name: "Factory Song", category: "Pop", bpm: 120 },
      source: {
        library: "Pop",
        path: null,
        source_file: null,
        license: null,
        license_status: "UNKNOWN",
      },
      clips: [
        {
          stable_id: "factory_clip:1",
          clip: { id: 1, song_id: "song-1", name: "intro" },
          asset: assetRef("assets/factory_clip_1.mid", clipBody),
          variations: [],
          melody_fingerprint: null,
        },
      ],
      chord_blocks: [
        {
          stable_id: "factory_chord_block:block-1",
          block: {
            id: "block-1",
            song_id: "song-1",
            chord_name: "C",
            is_user_override: 0,
          },
        },
      ],
    },
  ]

  if (options?.includeJamSong) {
    factoryRecords.push({
      stable_id: "jam_song:user-1",
      song: { id: "user-1", name: "Private" },
    })
  }

  const factorySection = buildSection("factory_songs", factoryRecords)

  const keyboardSection = buildSection("keyboard_catalog", [
    {
      stable_id: "keyboard_model:1",
      model: { id: 1, model_key: "tyros5", display_name: "Tyros 5" },
      source: {
        library: null,
        path: null,
        source_file: "Tyros5.dat",
        license: null,
        license_status: "UNKNOWN",
      },
      styles: [{ id: 1, name: "8 Beat Basic", style_number: 1 }],
      voices: [{ id: 1, name: "Grand Piano" }],
      multipads: [{ id: 1, name: "Pad 1" }],
    },
  ])

  const sections = [
    midiSection,
    soloSection,
    vocalSection,
    cmudictSection,
    factorySection,
    keyboardSection,
  ]
  const { top } = buildTopManifest(sections)

  const assets: Record<string, Uint8Array> = {
    "midi_clips/assets/midi_clip_1.mid": bassBody,
    "solo_phrases/assets/solo_phrase_solo-1.mid": soloBody,
    "vocal_phrases/assets/vocal_phrase_vocal-1.mid": vocalBody,
    "factory_songs/assets/factory_clip_1.mid": clipBody,
  }
  if (options?.omitAssetBytes) {
    delete assets["midi_clips/assets/midi_clip_1.mid"]
  }

  return {
    top,
    sections: Object.fromEntries(sections.map((section) => [section.section, section])),
    assets,
    bodies: { bassBody, soloBody, vocalBody, clipBody },
  }
}
