import type { Metadata } from "next"
import { StyleMakerLanding } from "@/components/style-maker/style-maker-landing"

export const metadata: Metadata = {
  title: "Style Maker",
  description:
    "Standalone Style Maker for Yamaha keyboards — rebuild styles with SmartBridge bass, drums, and guitar libraries or your own MIDI.",
}

export default function StyleMakerProductPage() {
  return <StyleMakerLanding />
}
