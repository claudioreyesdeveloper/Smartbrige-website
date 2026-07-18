"use client"

import { Chrome, Monitor, TriangleAlert } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

function isSupportedBrowser() {
  const agent = navigator.userAgent
  const desktop = !/Android|iPhone|iPad|iPod|Mobile/i.test(agent)
  const chrome = /Chrome\//.test(agent) && !/EdgA|EdgiOS|OPR\//.test(agent)
  const edge = /Edg\//.test(agent)
  return desktop && (chrome || edge) && "requestMIDIAccess" in navigator && window.isSecureContext
}

export function BrowserCompatibility({ children }: { children: ReactNode }) {
  const [supported, setSupported] = useState<boolean | null>(null)

  useEffect(() => setSupported(isSupportedBrowser()), [])

  if (supported === null) return <div className="demo-app compatibility-loading">Checking your browser…</div>
  if (supported) return children

  return (
    <main className="demo-app compatibility-stop">
      <span className="compatibility-icon"><TriangleAlert size={42} /></span>
      <p className="demo-kicker">Before you begin</p>
      <h1>Please open this demo in Chrome or Microsoft Edge on a computer.</h1>
      <p>
        Safari, Firefox, phones, and tablets cannot connect to your Yamaha keyboard.
      </p>
      <div className="compatibility-options">
        <a href="https://www.google.com/chrome/" target="_blank" rel="noreferrer">
          <Chrome size={24} /> Get Google Chrome
        </a>
        <a href="https://www.microsoft.com/edge/download" target="_blank" rel="noreferrer">
          <Monitor size={24} /> Get Microsoft Edge
        </a>
      </div>
      <strong>Then connect your keyboard with a USB cable and return to this page.</strong>
    </main>
  )
}
