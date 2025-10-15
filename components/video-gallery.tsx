"use client"

import { Card } from "@/components/ui/card"
import { Play } from "lucide-react"
import { useState } from "react"
import { VideoModal } from "@/components/video-modal"

const videos = [
  {
    id: "introduction",
    title: "SmartBridge Introduction",
    description: "Complete overview of SmartBridge features and capabilities",
    thumbnail: "/keyboard-interface-dashboard.jpg",
    videoUrl:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/SmartBridge%20Introduction-CrLN5OpazGgtpR7nsfKTqG1V24cXQy.mp4",
  },
  {
    id: "mixer",
    title: "SmartBridge Mixer",
    description: "16-channel mixer controls and real-time audio effects",
    thumbnail: "/audio-mixer-interface-dark-theme.jpg",
    videoUrl:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/SmartBrige%20Mixer-ZtNhpkmkW0g5UeIAKjRT3pT9wTad80.mp4",
  },
  {
    id: "composer",
    title: "Smart Composer",
    description: "Intelligent chord progression editor and composition tools",
    thumbnail: "/music-composition-interface.jpg",
    videoUrl:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Smart%20Composer-1bX40u9ZO5qpx6QFEJ5C7YNXcI5fUC.mp4",
  },
]

export function VideoGallery() {
  const [selectedVideo, setSelectedVideo] = useState<{
    url: string
    title: string
  } | null>(null)

  const handleVideoClick = (videoUrl: string, title: string) => {
    setSelectedVideo({ url: videoUrl, title })
  }

  return (
    <section id="videos" className="py-20 px-4 bg-background">
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">See SmartBridge in Action</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-pretty">
            Watch detailed demonstrations of each feature and interface
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {videos.map((video) => (
            <Card
              key={video.id}
              className="overflow-hidden cursor-pointer group hover:border-primary transition-all duration-300 bg-card border-2 border-border hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-1"
              onClick={() => handleVideoClick(video.videoUrl, video.title)}
            >
              <div className="relative aspect-video bg-muted">
                <img
                  src={video.thumbnail || "/placeholder.svg"}
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-center group-hover:from-black/90 group-hover:via-black/60 transition-all duration-300">
                  <div className="bg-primary rounded-full p-6 group-hover:scale-125 transition-transform duration-300 shadow-lg shadow-primary/50">
                    <Play className="h-10 w-10 text-primary-foreground fill-current" />
                  </div>
                </div>
              </div>
              <div className="p-6 bg-card/95 backdrop-blur-sm">
                <h3 className="text-xl font-bold mb-2 text-card-foreground group-hover:text-primary transition-colors">
                  {video.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{video.description}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <VideoModal
        isOpen={selectedVideo !== null}
        onClose={() => setSelectedVideo(null)}
        title={selectedVideo?.title || ""}
        videoUrl={selectedVideo?.url || ""}
      />
    </section>
  )
}
