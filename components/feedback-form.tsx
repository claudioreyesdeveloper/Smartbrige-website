"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function FeedbackForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    keyboardModel: "",
    platform: "",
    feedbackType: "",
    message: "",
  })

  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle form submission
    console.log("Feedback submitted:", formData)
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 3000)
  }

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 bg-muted/30">
      <div className="container mx-auto max-w-2xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Contribute to SmartBridge.</h2>
          <p className="text-base sm:text-lg text-muted-foreground">
            SmartBridge evolves through real input from musicians. Use the form below to send suggestions, ideas, or
            feature requests.
          </p>
        </div>

        <Card className="p-6 sm:p-8 bg-card border-border">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                Name
              </label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Your name"
                className="bg-background border-border"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="your@email.com"
                className="bg-background border-border"
                required
              />
            </div>

            <div>
              <label htmlFor="keyboardModel" className="block text-sm font-medium text-foreground mb-2">
                Keyboard Model
              </label>
              <Input
                id="keyboardModel"
                value={formData.keyboardModel}
                onChange={(e) => setFormData({ ...formData, keyboardModel: e.target.value })}
                placeholder="e.g., Genos, PSR-SX900, Tyros5"
                className="bg-background border-border"
              />
            </div>

            <div>
              <label htmlFor="platform" className="block text-sm font-medium text-foreground mb-2">
                Platform
              </label>
              <Select
                value={formData.platform}
                onValueChange={(value) => setFormData({ ...formData, platform: value })}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="web">Web</SelectItem>
                  <SelectItem value="standalone">Standalone</SelectItem>
                  <SelectItem value="vst">VST</SelectItem>
                  <SelectItem value="ios">iOS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="feedbackType" className="block text-sm font-medium text-foreground mb-2">
                Feedback Type
              </label>
              <Select
                value={formData.feedbackType}
                onValueChange={(value) => setFormData({ ...formData, feedbackType: value })}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="suggestion">Suggestion</SelectItem>
                  <SelectItem value="bug">Bug Report</SelectItem>
                  <SelectItem value="feature">Feature Request</SelectItem>
                  <SelectItem value="question">Question</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-foreground mb-2">
                Message
              </label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Share your thoughts, suggestions, or questions..."
                rows={6}
                className="bg-background border-border"
                required
              />
            </div>

            <Button type="submit" className="w-full">
              Send Feedback
            </Button>

            {submitted && <p className="text-center text-sm text-primary">Thank you! Your message has been sent.</p>}
          </form>
        </Card>
      </div>
    </section>
  )
}
