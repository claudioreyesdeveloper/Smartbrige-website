"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { useState } from "react"
import { sendSuggestion } from "@/app/actions"
import { useToast } from "@/hooks/use-toast"

export function SuggestionBox() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [keyboardModel, setKeyboardModel] = useState("")
  const [platform, setPlatform] = useState("")
  const [feedbackType, setFeedbackType] = useState("")
  const [message, setMessage] = useState("")
  const [consent, setConsent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!consent) {
      toast({
        title: "Consent required",
        description: "Please agree to the data storage policy.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    const formData = new FormData()
    formData.append("name", name)
    formData.append("email", email)
    formData.append("keyboardModel", keyboardModel)
    formData.append("platform", platform)
    formData.append("feedbackType", feedbackType)
    formData.append("message", message)

    const result = await sendSuggestion(formData)

    if (result.success) {
      toast({
        title: "Thanks! Your message has been sent.",
        description: "We'll review your feedback carefully.",
      })
      // Reset form
      setName("")
      setEmail("")
      setKeyboardModel("")
      setPlatform("")
      setFeedbackType("")
      setMessage("")
      setConsent(false)
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to send feedback. Please try again.",
        variant: "destructive",
      })
    }

    setIsSubmitting(false)
  }

  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="container mx-auto max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">Have an Idea?</h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            smartbridge grows through collaboration. Suggest a feature, report an issue, or share your workflow — your
            input directly shapes development.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name (optional) */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground">
              Name (optional)
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="Your name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-background border-border"
            />
          </div>

          {/* Email (required) */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">
              Email <span className="text-primary">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-background border-border"
              required
            />
          </div>

          {/* Keyboard Model (dropdown) */}
          <div className="space-y-2">
            <Label htmlFor="keyboard-model" className="text-foreground">
              Keyboard Model
            </Label>
            <Select value={keyboardModel} onValueChange={setKeyboardModel}>
              <SelectTrigger id="keyboard-model" className="bg-background border-border">
                <SelectValue placeholder="Select your keyboard model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="psr">PSR</SelectItem>
                <SelectItem value="genos">Genos</SelectItem>
                <SelectItem value="tyros">Tyros</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Version / Platform (radio) */}
          <div className="space-y-3">
            <Label className="text-foreground">Version / Platform</Label>
            <RadioGroup value={platform} onValueChange={setPlatform}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="web-demo" id="web-demo" />
                <Label htmlFor="web-demo" className="font-normal cursor-pointer">
                  Web demo
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="standalone" id="standalone" />
                <Label htmlFor="standalone" className="font-normal cursor-pointer">
                  Standalone
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="vst" id="vst" />
                <Label htmlFor="vst" className="font-normal cursor-pointer">
                  VST
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ios" id="ios" />
                <Label htmlFor="ios" className="font-normal cursor-pointer">
                  iOS
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Type of feedback (dropdown) */}
          <div className="space-y-2">
            <Label htmlFor="feedback-type" className="text-foreground">
              Type of feedback
            </Label>
            <Select value={feedbackType} onValueChange={setFeedbackType}>
              <SelectTrigger id="feedback-type" className="bg-background border-border">
                <SelectValue placeholder="Select feedback type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">Bug</SelectItem>
                <SelectItem value="feature-request">Feature request</SelectItem>
                <SelectItem value="ui-feedback">UI feedback</SelectItem>
                <SelectItem value="general-comment">General comment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Message (textarea) */}
          <div className="space-y-2">
            <Label htmlFor="message" className="text-foreground">
              Message <span className="text-primary">*</span>
            </Label>
            <Textarea
              id="message"
              placeholder="Describe your idea or issue…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[150px] bg-background border-border"
              required
            />
          </div>

          {/* Consent checkbox */}
          <div className="flex items-start space-x-2">
            <Checkbox id="consent" checked={consent} onCheckedChange={(checked) => setConsent(checked as boolean)} />
            <Label htmlFor="consent" className="text-sm font-normal cursor-pointer leading-relaxed">
              I agree that this message may be stored for support purposes.
            </Label>
          </div>

          {/* Submit button */}
          <div className="flex justify-center pt-4">
            <Button
              type="submit"
              size="lg"
              className="px-8 bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending..." : "Send Feedback"}
            </Button>
          </div>
        </form>
      </div>
    </section>
  )
}
