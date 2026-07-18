import type { SectionManifest, TopLevelManifest } from "@/lib/catalog/manifest"

/**
 * Exact `factory_songs/manifest.json` emitted by the shipped A06 exporter from
 * its SyntheticCatalogDatabase fixture with its factory chord timing set to
 * 0.5/3.5. The nested clip bytes are the matching exported asset.
 */
export const A06_FACTORY_CLIP_BYTES = Uint8Array.from([
  0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x3d,
])

export const A06_FACTORY_SONGS_SECTION: SectionManifest = {
  section: "factory_songs",
  schema_version: 1,
  record_count: 2,
  records: [
    {
      stable_id: "factory_song:song-factory-1",
      song: {
        bpm: 120,
        category: "Pop",
        description: "factory",
        id: "song-factory-1",
        key: "C",
        name: "Factory Song",
      },
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
          clip: {
            bars: 4,
            clip_order: 0,
            created_at: 0,
            id: 1,
            name: "intro",
            notes: null,
            song_id: "song-factory-1",
            style_variation: "A",
            updated_at: 0,
          },
          asset: {
            path: "assets/factory_clip_1.mid",
            sha256: "50cb41dd95fabd125394991b2003963c63732826738bdf0cf134f347c63c1a3f",
            size_bytes: 9,
          },
          variations: [],
          melody_fingerprint: null,
        },
      ],
      chord_blocks: [
        {
          stable_id: "factory_chord_block:block-factory",
          block: {
            analysis_version: 1,
            chord_name: "C",
            clip_id: -1,
            confidence: 0.9,
            created_at: 0,
            id: "block-factory",
            is_user_override: 0,
            length_beats: 3.5,
            quality: "maj",
            root: 0,
            section_label: "A",
            song_id: "song-factory-1",
            start_bar: 1,
            start_beat: 0.5,
            updated_at: 0,
          },
        },
      ],
    },
    {
      stable_id: "roman_progression_pattern:1",
      pattern: {
        bars: null,
        beat_signature_json: null,
        category: null,
        chord_count: null,
        chord_sequence_json: null,
        chromatic_count: 0,
        created_at: null,
        duration_signature_json: null,
        id: 1,
        roman_sequence_json: "[\"I\",\"V\",\"vi\",\"IV\"]",
        section_class: null,
        section_name: null,
        seventh_count: 0,
        slash_count: 0,
        source_clip_id: 1,
        source_song_id: "song-factory-1",
        source_song_name: "Factory Song",
      },
      source: {
        library: null,
        path: "Factory Song",
        source_file: null,
        license: null,
        license_status: "UNKNOWN",
      },
    },
  ],
  records_sha256: "92d1766d501bf10162426c9c3ffebbb00d948830829ba7effe8672c7b6170618",
}

// A06's content tree for this single-section test bundle includes no nested
// clip checksum contribution: canonical SHA-256 of [records_sha256].
export const A06_FACTORY_SONGS_TOP: TopLevelManifest = {
  catalog_export_version: 1,
  schema_version: 1,
  source_provenance: {
    database_content_sha256: "a725cb8e3658f025a33498c0a48241cfca49becfad51a5a26a751f362e7d9ed9",
  },
  sections: {
    factory_songs: {
      manifest_path: "factory_songs/manifest.json",
      record_count: 2,
      records_sha256: "92d1766d501bf10162426c9c3ffebbb00d948830829ba7effe8672c7b6170618",
    },
  },
  content_tree_sha256: "a725cb8e3658f025a33498c0a48241cfca49becfad51a5a26a751f362e7d9ed9",
}
