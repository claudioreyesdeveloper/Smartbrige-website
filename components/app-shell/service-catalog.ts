import {
  SHARED_SERVICE_CATALOG,
  getPrimaryNavOrder,
  getServiceNavOrder,
  type ServiceKey,
} from "@/lib/services/catalog"
import type { ServiceDefinition } from "./types"

const APP_SHELL_PRESENTATION: Record<
  ServiceKey,
  Pick<ServiceDefinition, "tagline" | "description" | "path">
> = {
  "jam-player": {
    tagline: "Play & arrange",
    description:
      "Load songs, follow chord grids, and sync tempo and key with your keyboard.",
    path: "/app/jam-player",
  },
  "bass-drums": {
    tagline: "Layer the arrangement",
    description:
      "Browse section-aware bass lines and drum grooves matched to your chart.",
    path: "/app/jam-player/bass",
  },
  "solo-phrases": {
    tagline: "Solos & harmonization",
    description:
      "Audition solo ideas and harmonize leads with brass or strings.",
    path: "/app/jam-player/solo",
  },
  lyrics: {
    tagline: "Vocals & lyrics",
    description:
      "Generate lyric ideas tied to your melody and hand off to Synthesizer V.",
    path: "/app/jam-player/lyrics",
  },
  "genos-mixer": {
    tagline: "Control your keyboard",
    description:
      "Balance Style and Song parts, FX, and voice search from one screen.",
    path: "/app/genos-mixer",
  },
  "style-maker": {
    tagline: "Coming soon",
    description:
      "Edit Yamaha styles in the browser with before/after audition lanes.",
    path: "/app/style-maker",
  },
}

export const SERVICE_CATALOG = Object.fromEntries(
  SHARED_SERVICE_CATALOG.map((entry) => [
    entry.key,
    {
      key: entry.key,
      name: entry.name,
      ...APP_SHELL_PRESENTATION[entry.key],
    },
  ]),
) as Record<ServiceKey, ServiceDefinition>

/** Full entitlement / account order. */
export const SERVICE_NAV_ORDER = getServiceNavOrder()

/** Top-level product tabs only (Jam Player + Genos Mixer). */
export const PRIMARY_SERVICE_NAV_ORDER = getPrimaryNavOrder()
