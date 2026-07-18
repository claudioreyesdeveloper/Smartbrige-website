import type { ServiceDefinition, ServiceKey } from "./types"

export const SERVICE_CATALOG: Record<ServiceKey, ServiceDefinition> = {
  "jam-player": {
    key: "jam-player",
    name: "Jam Player",
    tagline: "Play & arrange",
    description:
      "Load songs, follow chord grids, and sync tempo and key with your keyboard.",
    path: "/app/jam-player",
  },
  "bass-drums": {
    key: "bass-drums",
    name: "Bass & Drums",
    tagline: "Layer the arrangement",
    description:
      "Browse section-aware bass lines and drum grooves matched to your chart.",
    path: "/app/bass-drums",
  },
  "solo-phrases": {
    key: "solo-phrases",
    name: "Solo Phrases",
    tagline: "Solos & harmonization",
    description:
      "Audition solo ideas and harmonize leads with brass or strings.",
    path: "/app/solo-phrases",
  },
  lyrics: {
    key: "lyrics",
    name: "Lyrics",
    tagline: "Vocals & lyrics",
    description:
      "Generate lyric ideas tied to your melody and hand off to Synthesizer V.",
    path: "/app/lyrics",
  },
  "genos-mixer": {
    key: "genos-mixer",
    name: "Genos Mixer",
    tagline: "Control your keyboard",
    description:
      "Balance Style and Song parts, FX, and voice search from one screen.",
    path: "/app/genos-mixer",
  },
  "style-maker": {
    key: "style-maker",
    name: "Style Maker",
    tagline: "Coming soon",
    description:
      "Edit Yamaha styles in the browser with before/after audition lanes.",
    path: "/app/style-maker",
  },
}

export const SERVICE_NAV_ORDER: ServiceKey[] = [
  "jam-player",
  "bass-drums",
  "solo-phrases",
  "lyrics",
  "genos-mixer",
  "style-maker",
]
