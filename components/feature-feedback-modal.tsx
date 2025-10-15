"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { X } from "lucide-react"
import { sendFeatureFeedback } from "@/app/actions"

interface FeatureFeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  featureName: string
}

export function FeatureFeedbackModal({ isOpen, onClose, featureName }: FeatureFeedbackModalProps) {
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null
    message: string
  }>({ type: null, message: "" })

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!message.trim()) {
      setSubmitStatus({
        type: "error",
        message: "Please enter a message before sending.",
      })
      return
    }

    setIsSubmitting(true)
    setSubmitStatus({ type: null, message: "" })

    const result = await sendFeatureFeedback(featureName, message)

    if (result.success) {
      setSubmitStatus({
        type: "success",
        message: "Thank you! Your feedback has been sent.",
      })
      setTimeout(() => {
        setMessage("")
        setSubmitStatus({ type: null, message: "" })
        onClose()
      }, 2000)
    } else {
      setSubmitStatus({
        type: "error",
        message: result.error || "Failed to send feedback. Please try again.",
      })
    }

    setIsSubmitting(false)
  }

  const handleClose = () => {
    setMessage("")
    setSubmitStatus({ type: null, message: "" })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-card border border-primary/20 rounded-lg shadow-2xl shadow-primary/10">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <h3 className="text-2xl font-bold">Feedback: {featureName}</h3>
          <Button variant="ghost" size="icon" onClick={handleClose} className="hover:bg-primary/10">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-muted-foreground">
            Share your thoughts, suggestions, or bug reports about {featureName}. Your feedback helps shape the
            development of SmartBridge.
          </p>

          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter your feedback here..."
            className="min-h-[200px] resize-none bg-background/50 border-primary/20 focus:border-primary/40"
            disabled={isSubmitting}
          />

          {submitStatus.type && (
            <div
              className={`p-3 rounded-lg text-sm ${
                submitStatus.type === "success"
                  ? "bg-green-500/10 text-green-500 border border-green-500/20"
                  : "bg-red-500/10 text-red-500 border border-red-500/20"
              }`}
            >
              {submitStatus.message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border/50">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !message.trim()}
            className="shadow-lg shadow-primary/20 hover:shadow-primary/30"
          >
            {isSubmitting ? "Sending..." : "Send Feedback"}
          </Button>
        </div>
      </div>
    </div>
  )
}
