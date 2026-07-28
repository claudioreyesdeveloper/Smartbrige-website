import type { Metadata } from "next"
import { BandJamLanding } from "@/components/band-jam/band-jam-landing"

export const metadata: Metadata = {
  title: "Jam Player",
  description:
    "Practise with a virtual band from SmartBridge libraries — mute your instrument and play along.",
}

export default function JamPlayerProductPage() {
  return <BandJamLanding />
}
