"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { MessageSquare, Star } from "lucide-react"

interface FeatureFeedbackDialogProps {
  featureName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeatureFeedbackDialog({ featureName, open, onOpenChange }: FeatureFeedbackDialogProps) {
  const [easeOfUseRating, setEaseOfUseRating] = useState(0)
  const [easeOfUseComment, setEaseOfUseComment] = useState("")
  const [additionalComments, setAdditionalComments] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = () => {
    const existingFeedback = JSON.parse(localStorage.getItem("smartbridge-feedback") || "[]")
    existingFeedback.push({
      feature: featureName,
      easeOfUse: {
        rating: easeOfUseRating,
        comment: easeOfUseComment,
      },
      additionalComments,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    })
    localStorage.setItem("smartbridge-feedback", JSON.stringify(existingFeedback))

    setSubmitted(true)
    setTimeout(() => {
      onOpenChange(false)
      setSubmitted(false)
      setEaseOfUseRating(0)
      setEaseOfUseComment("")
      setAdditionalComments("")
    }, 2000)
  }

  const isValid = easeOfUseRating > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-900 to-slate-800 border-amber-500/20">
        <DialogHeader>
          <DialogTitle className="text-2xl font-heading text-amber-400 flex items-center gap-2">
            <MessageSquare className="w-6 h-6" />
            Share Your Experience: {featureName}
          </DialogTitle>
          <DialogDescription className="text-slate-300 text-base">
            Your honest feedback helps shape SmartBridge's development. Rate the ease of use and share any additional
            thoughts.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-12 text-center">
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-amber-400" />
            </div>
            <h3 className="text-2xl font-heading text-amber-400 mb-2">Thank You!</h3>
            <p className="text-slate-300">Your feedback has been received and will help improve SmartBridge.</p>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="space-y-3 p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <Label className="text-amber-400 font-medium text-base">Ease of Use</Label>

              {/* Star Rating */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400 w-16">Rating:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setEaseOfUseRating(star)}
                      className="transition-all hover:scale-110"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= easeOfUseRating
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-600 hover:text-amber-400/50"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <span className="text-sm text-amber-400 font-medium ml-2">
                  {easeOfUseRating > 0 ? `${easeOfUseRating}/5` : "Not rated"}
                </span>
              </div>

              {/* Comment */}
              <div className="space-y-2">
                <Label className="text-sm text-slate-400">Your thoughts on ease of use:</Label>
                <Textarea
                  value={easeOfUseComment}
                  onChange={(e) => setEaseOfUseComment(e.target.value)}
                  placeholder="Share your experience with how easy this feature is to use..."
                  className="bg-slate-900/50 border-slate-700 text-slate-200 placeholder:text-slate-500 min-h-[80px] resize-none"
                />
              </div>
            </div>

            <div className="space-y-3 p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <Label className="text-amber-400 font-medium text-base">Additional Comments</Label>
              <div className="space-y-2">
                <Label className="text-sm text-slate-400">Any other feedback or suggestions:</Label>
                <Textarea
                  value={additionalComments}
                  onChange={(e) => setAdditionalComments(e.target.value)}
                  placeholder="Share any other thoughts, suggestions, or ideas about this feature..."
                  className="bg-slate-900/50 border-slate-700 text-slate-200 placeholder:text-slate-500 min-h-[100px] resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!isValid}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit Feedback
              </Button>
            </div>

            {!isValid && (
              <p className="text-sm text-amber-400/70 text-center">
                Please provide an ease of use rating before submitting
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
