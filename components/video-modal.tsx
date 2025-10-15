"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface VideoModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  videoUrl: string
}

export function VideoModal({ isOpen, onClose, title, videoUrl }: VideoModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[98vw] w-[98vw] max-h-[98vh] p-0 overflow-hidden bg-background border-2 border-primary/30">
        <DialogHeader className="p-6 bg-gradient-to-b from-background to-transparent absolute top-0 left-0 right-0 z-10">
          <DialogTitle className="text-2xl font-bold text-foreground">{title}</DialogTitle>
        </DialogHeader>
        <div className="bg-background flex items-center justify-center min-h-[80vh] max-h-[90vh]">
          {videoUrl && (
            <video
              className="w-full h-full max-h-[90vh] object-contain"
              controls
              autoPlay
              controlsList="nodownload"
              src={videoUrl}
            >
              Your browser does not support the video tag.
            </video>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
