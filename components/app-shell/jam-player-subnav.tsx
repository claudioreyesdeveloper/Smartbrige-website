"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { JAM_PLAYER_SUB_TABS, resolveJamPlayerSubTab } from "./jam-player-routes"

export function JamPlayerSubNav() {
  const pathname = usePathname()
  const active = resolveJamPlayerSubTab(pathname)

  return (
    <nav className="jam-player-subnav" aria-label="Jam Player tools">
      <ul className="jam-player-subnav-list">
        {JAM_PLAYER_SUB_TABS.map((tab) => {
          const isActive = active?.id === tab.id
          return (
            <li key={tab.id}>
              <Link
                href={tab.path}
                className={`jam-player-subnav-item${isActive ? " is-active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
