import type { ReactNode } from "react"
import { JamPlayerSubNav } from "@/components/app-shell/jam-player-subnav"

export default function JamPlayerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="jam-player-shell">
      <JamPlayerSubNav />
      {children}
    </div>
  )
}
