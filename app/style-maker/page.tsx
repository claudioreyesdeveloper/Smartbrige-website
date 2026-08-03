import type { Metadata } from "next"
import { StyleMakerLanding } from "@/components/style-maker/style-maker-landing"

export const metadata: Metadata = {
  title: "Style Maker for Yamaha arrangers",
  description:
    "Import, rebuild, mix, export, and transfer Yamaha arranger styles in your browser. 14-day free trial, then $14.99/month.",
}

export default function StyleMakerProductPage() {
  return <StyleMakerLanding />
}
