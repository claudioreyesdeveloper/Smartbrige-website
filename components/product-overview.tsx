"use client"

import { Card } from "@/components/ui/card"
import { Play } from "lucide-react"
import { useState } from "react"
import { VideoModal } from "./video-modal"

export function ProductOverview() {
  const [isVideoOpen, setIsVideoOpen] = useState(false)

  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">See SmartBridge in Action</h2>
          <p className="text-lg text-black">Real-time control, modern workflow, no menu maze.</p>
        </div>

        <Card
          className="bg-white border border-border/50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden cursor-pointer"
          onClick={() => setIsVideoOpen(true)}
        >
          <div className="aspect-video bg-muted/50 flex items-center justify-center relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
            <div className="relative z-10 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/20 border-2 border-primary/40 mb-4 group-hover:bg-primary/30 transition-all duration-300">
                <Play className="h-10 w-10 text-primary ml-1" />
              </div>
              <p className="text-black font-medium">Watch SmartBridge Introduction</p>
            </div>
          </div>
        </Card>

        <VideoModal
          isOpen={isVideoOpen}
          onClose={() => setIsVideoOpen(false)}
          title="SmartBridge Introduction"
          videoUrl="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/SmartBridge%20Introduction-CrLN5OpazGgtpR7nsfKTqG1V24cXQy.mp4"
        />
      </div>
    </section>
  )
}
