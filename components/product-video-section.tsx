"use client"

import { useState } from "react"
import { Play } from "lucide-react"
import { VideoModal } from "@/components/video-modal"

export function ProductVideoSection() {
  const [isVideoOpen, setIsVideoOpen] = useState(false)
  const videoUrl =
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/SmartBridge%20Introduction-CrLN5OpazGgtpR7nsfKTqG1V24cXQy.mp4"

  return (
    <>
      <section className="py-20 bg-gradient-section">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground">See SmartBridge in Action</h2>
            <p className="text-lg text-muted-foreground">Real-time control, modern workflow, no menu maze.</p>
            <div
              className="relative bg-white border border-border/50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden cursor-pointer group mt-8"
              onClick={() => setIsVideoOpen(true)}
            >
              <div className="aspect-video bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Play className="w-10 h-10 text-primary-foreground ml-1" fill="currentColor" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <VideoModal
        isOpen={isVideoOpen}
        onClose={() => setIsVideoOpen(false)}
        videoUrl={videoUrl}
        title="SmartBridge Introduction"
      />
    </>
  )
}
