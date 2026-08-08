import { ClerkProvider } from "@clerk/nextjs"
import type { Metadata } from "next"
import { DM_Sans, Instrument_Serif, Geist } from "next/font/google"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { isClerkPublishableEnabled } from "@/lib/billing/clerk-config"
import { SITE } from "@/lib/site"
import { cn } from "@/lib/utils"
import "./globals.css"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

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
    default: "SmartBridge — One song. Every part understands it.",
    template: "%s · SmartBridge",
  },
  description:
    "The chord-aware performance and production system for Yamaha musicians. Connect the song, Yamaha hardware, curated MIDI performances, Cubase, lyrics, Synthesizer V, and four-part harmony.",
  keywords: [
    "Yamaha arranger software",
    "Genos Cubase integration",
    "Tyros style editor",
    "chord aware MIDI",
    "Yamaha style maker",
    "Synthesizer V lyrics",
    "MegaVoice MIDI",
  ],
  openGraph: {
    title: "SmartBridge — One song. Every part understands it.",
    description:
      "Build the song once, then carry its chords and musical context through Yamaha hardware, performed MIDI, Cubase, Synthesizer V, vocals, brass, and strings.",
    url: SITE.url,
    siteName: "SmartBridge",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: `${SITE.url}/og-desktop.png`,
        width: 1200,
        height: 630,
        alt: "SmartBridge chord-aware Yamaha production system",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SmartBridge — One song. Every part understands it.",
    description: "A connected Yamaha, Cubase, and Synthesizer V production workflow built around one chord-aware song.",
    images: [`${SITE.url}/og-desktop.png`],
  },
}

const clerkConfigured = isClerkPublishableEnabled()

function Providers({ children }: { children: React.ReactNode }) {
  const body = (
    <TooltipProvider>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
      <Toaster />
    </TooltipProvider>
  )

  if (!clerkConfigured) return body
  return <ClerkProvider>{body}</ClerkProvider>
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={cn(
        dmSans.variable,
        instrumentSerif.variable,
        "font-sans",
        geist.variable,
      )}
    >
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
