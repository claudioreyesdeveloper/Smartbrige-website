"use client"

import { Drum, Guitar, Music2, Piano, Waves } from "lucide-react"
import type { BandPart } from "@/lib/band-jam/engine/types"

/**
 * Shared part labels/icons for mixer and effects UI.
 * The old BandStrip row was replaced by MixerPanel.
 */

export const PART_META: Record<
  BandPart,
  { label: string; icon: typeof Drum }
> = {
  drums: { label: "Drums", icon: Drum },
  bass: { label: "Bass", icon: Waves },
  guitar: { label: "Guitar", icon: Guitar },
  keys: { label: "Keys", icon: Piano },
  solo: { label: "Solo", icon: Music2 },
}
