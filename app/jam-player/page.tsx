import type { Metadata } from "next"
import { BandJamLanding } from "@/components/band-jam/band-jam-landing"

export const metadata: Metadata = {
  title: "Jam Player — a practice band you control",
  description:
    "Choose a progression, key, tempo, and style, mute the instrument you play, and practise with the rest of the band in your browser.",
}

export default function JamPlayerProductPage() {
  return <BandJamLanding />
}
