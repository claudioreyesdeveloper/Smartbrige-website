import type { JamCatalogClient, JamSong, JamSongSummary } from "../types"
import { FIXTURE_SONGS, FIXTURE_STYLES } from "./fixtures"

function toSummary(song: JamSong): JamSongSummary {
  return {
    id: song.id,
    title: song.title,
    category: song.category,
    tempo: song.tempo,
    key: song.key,
    sectionCount: song.sections.length,
    accent: song.accent,
  }
}

export type FakeCatalogOptions = {
  songs?: JamSong[]
  latencyMs?: number
}

export function createFakeCatalogClient(
  options: FakeCatalogOptions = {},
): JamCatalogClient {
  const songs = options.songs ?? FIXTURE_SONGS
  const latencyMs = options.latencyMs ?? 0

  const wait = async () => {
    if (latencyMs > 0) await new Promise((r) => setTimeout(r, latencyMs))
  }

  return {
    async listCategories() {
      await wait()
      return Array.from(new Set(songs.map((s) => s.category))).sort()
    },

    async listSongs({ category, search } = {}) {
      await wait()
      const q = search?.trim().toLowerCase() ?? ""
      return songs
        .filter((song) => !category || song.category === category)
        .filter(
          (song) =>
            !q ||
            song.title.toLowerCase().includes(q) ||
            song.category.toLowerCase().includes(q),
        )
        .map(toSummary)
    },

    async getSong(songId) {
      await wait()
      const song = songs.find((item) => item.id === songId)
      if (!song) throw new Error(`Song not found: ${songId}`)
      return structuredClone(song)
    },

    async listStyles({ category, search }) {
      await wait()
      const q = search?.trim().toLowerCase() ?? ""
      return FIXTURE_STYLES.filter(
        (style) => !category || category === "All" || style.category === category,
      ).filter(
        (style) =>
          !q ||
          style.name.toLowerCase().includes(q) ||
          style.category.toLowerCase().includes(q),
      )
    },
  }
}
