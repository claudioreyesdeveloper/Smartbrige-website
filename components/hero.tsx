"use client"

import { Button } from "@/components/ui/button"
import { Play } from "lucide-react"
import { useState } from "react"
import { VideoModal } from "@/components/video-modal"

export function Hero() {
  const [showVideo, setShowVideo] = useState(false)

  return (
    <section className="relative pt-32 pb-24 px-4 min-h-[85vh] flex items-center bg-background overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0 z-0 opacity-20">
        <img
          src="/professional-music-studio-with-yamaha-keyboard-syn.jpg"
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" />
      </div>

      <div className="container mx-auto relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-8 text-balance leading-tight">
            SmartBridge – Your Yamaha, <span className="text-primary">Unlocked</span>.
          </h1>

          <p className="text-xl md:text-2xl text-black mb-6 text-pretty leading-relaxed font-medium">
            Browse, mix, and perform without menus or limits.
          </p>

          <p className="text-base md:text-lg text-black mb-10 max-w-3xl mx-auto leading-relaxed">
            SmartBridge is a unified control interface for Yamaha keyboards. It combines a 32-channel mixer, voice
            browser, style engine, and visual composer into one intuitive workspace. Built for live performers,
            producers, and arrangers, SmartBridge eliminates menu-diving and puts expressive control at your fingertips.
          </p>

          <div className="inline-block px-6 py-2 rounded-full bg-primary/10 border border-primary/30 mb-10">
            <p className="text-sm text-primary font-medium">Compatible with Yamaha PSR, Genos, and Tyros</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <Button
              size="lg"
              className="text-base px-8 py-6 bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-300"
              asChild
            >
              <a href="#demo">Try Live Demo</a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-base px-8 py-6 border-border hover:bg-card bg-transparent hover:border-primary/60 transition-all duration-300"
              onClick={() => setShowVideo(true)}
            >
              <Play className="mr-2 h-5 w-5" />
              Watch Overview
            </Button>
          </div>

          <p className="text-sm text-black italic mb-16">Developed by a Yamaha keyboardist for Yamaha players.</p>

          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="bg-white border border-border/50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6">
              <div className="text-4xl font-bold text-primary mb-2">1,000+</div>
              <div className="text-sm text-black">Voices</div>
            </div>
            <div className="bg-white border border-border/50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6">
              <div className="text-4xl font-bold text-primary mb-2">32</div>
              <div className="text-sm text-black">Channels</div>
            </div>
            <div className="bg-white border border-border/50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6">
              <div className="text-4xl font-bold text-primary mb-2">Real-time</div>
              <div className="text-sm text-black">Control</div>
            </div>
            <div className="bg-white border border-border/50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6">
              <div className="text-4xl font-bold text-primary mb-2">Stage-Ready</div>
              <div className="text-sm text-black">UI</div>
            </div>
          </div>
        </div>
      </div>

      <VideoModal
        isOpen={showVideo}
        onClose={() => setShowVideo(false)}
        title="SmartBridge Overview"
        videoUrl="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/SmartBridge%20Introduction-CrLN5OpazGgtpR7nsfKTqG1V24cXQy.mp4"
      />
    </section>
  )
}
