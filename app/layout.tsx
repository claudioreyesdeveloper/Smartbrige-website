import type { Metadata } from "next"
import { DM_Sans, Instrument_Serif } from "next/font/google"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { SITE } from "@/lib/site"
import "./globals.css"

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
})

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "SmartBridge — Songwriting workflow for Yamaha keyboards",
    template: "%s · SmartBridge",
  },
  description:
    "From MIDI phrase to full arrangement. SmartBridge connects your Yamaha keyboard to chord-aware phrases, vocals, lyrics, and DAW production.",
  openGraph: {
    title: "SmartBridge — From phrase to full arrangement",
    description:
      "Arrangement workflow for Yamaha Tyros, Genos, PSR-SX, and Motif — phrases, vocals, lyrics, and Cubase integration.",
    url: SITE.url,
    siteName: "SmartBridge",
    locale: "en_US",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${instrumentSerif.variable}`}
      // Required when globals.css sets scroll-behavior: smooth — without this,
      // Next.js injects style="scroll-behavior: auto" on the client and React
      // reports a hydration attribute mismatch on <html>.
      data-scroll-behavior="smooth"
      // Browser extensions (e.g. Scribe) inject attributes like
      // data-scribe-recorder-ready onto <html> before React hydrates.
      suppressHydrationWarning
    >
      <body className="antialiased">
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  )
}
