import type React from "react"
import type { Metadata } from "next"
import { Inter, Montserrat, JetBrains_Mono } from "next/font/google"
import { Suspense } from "react"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: "SmartBridge - Next-Gen Control Interface for Yamaha Keyboards",
  description: "Take total command of your sound. Mix, compose, and perform with precision using SmartBridge.",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${montserrat.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">
        <div className="gradient-bg min-h-screen">
          <Suspense fallback={null}>{children}</Suspense>
        </div>
      </body>
    </html>
  )
}
