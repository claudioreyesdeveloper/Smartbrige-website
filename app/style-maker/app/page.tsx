import type { Metadata } from "next"
import { StyleMakerApp } from "@/components/style-maker/style-maker-app"
import "@/app/style-maker-desktop.css"

export const metadata: Metadata = {
  title: "Style Maker",
  description:
    "Desktop Style Maker for Yamaha keyboards — Build Section lane assignment with SmartBridge phrase libraries.",
}

export default function StyleMakerAppPage() {
  return <StyleMakerApp />
}
