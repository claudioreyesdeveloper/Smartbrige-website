"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CheckCircle2, Clock, Mail } from "lucide-react"
import { FeatureFeedbackModal } from "./feature-feedback-modal"

export function DevelopmentProgress() {
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false)
  const [selectedFeature, setSelectedFeature] = useState("")

  const currentFeatures = [
    {
      name: "Mixer",
      description: "Channel volume, pan, reverb, chorus, and brightness controls",
    },
    {
      name: "Voice Browser",
      description: "Browse and assign voices across 16 categories",
    },
    {
      name: "Live Visual Feedback",
      description: "State persistence and real-time updates",
    },
  ]

  const upcomingFeatures = [
    {
      name: "Style Controls",
      description: "Accompaniment style playback and variations",
    },
    {
      name: "Smart Composer",
      description: "Visual chord progression editor",
    },
    {
      name: "Registration Manager",
      description: "Save/load performance setups",
    },
    {
      name: "Assembly Workbench",
      description: "Custom style creation",
    },
  ]

  const feedbackAreas = [
    { name: "Mixer Feedback", available: true },
    { name: "Voice Browser Feedback", available: true },
    { name: "Style Controls Feedback", available: false },
    { name: "Smart Composer Feedback", available: false },
    { name: "Registration Manager Feedback", available: false },
    { name: "Assembly Workbench Feedback", available: false },
  ]

  const handleFeedbackClick = (featureName: string) => {
    setSelectedFeature(featureName)
    setIsFeedbackModalOpen(true)
  }

  return (
    <section className="py-24 px-4 bg-gradient-to-b from-background to-background/50">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-balance text-foreground">Development in Progress</h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto text-pretty">
            SmartBridge is being built step by step — with input from the Yamaha community. The first release focuses on
            the Mixer and Voice Browser, allowing real-time control of volume, panning, and sound selection. Additional
            tabs and modules are in active development.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Current Focus */}
          <Card className="p-8 bg-card/50 backdrop-blur border-primary/20 shadow-lg shadow-primary/5">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-primary/10">
                <CheckCircle2 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">Current Focus</h3>
            </div>
            <div className="space-y-4">
              {currentFeatures.map((feature, index) => (
                <div key={index} className="flex gap-3 p-4 rounded-lg bg-background/50 border border-primary/10">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-foreground">{feature.name}</div>
                    <div className="text-sm text-muted-foreground">{feature.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Next in Line */}
          <Card className="p-8 bg-card/50 backdrop-blur border-primary/20 shadow-lg shadow-primary/5">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">Next in Line</h3>
            </div>
            <div className="space-y-4">
              {upcomingFeatures.map((feature, index) => (
                <div key={index} className="flex gap-3 p-4 rounded-lg bg-background/50 border border-border/50">
                  <Clock className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-foreground">{feature.name}</div>
                    <div className="text-sm text-muted-foreground">{feature.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Give Feedback on Each Feature */}
        <Card className="p-8 bg-card/50 backdrop-blur border-primary/20 shadow-lg shadow-primary/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-2xl font-bold text-foreground">Give Feedback on Each Feature</h3>
          </div>
          <p className="text-muted-foreground mb-6">
            You can test the live mockup and share suggestions or bug reports directly for each tab or feature area.
            Your feedback guides development priorities.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {feedbackAreas.map((area, index) => (
              <Button
                key={index}
                variant={area.available ? "default" : "outline"}
                className={
                  area.available
                    ? "w-full shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
                    : "w-full opacity-50 cursor-not-allowed"
                }
                disabled={!area.available}
                onClick={() => area.available && handleFeedbackClick(area.name)}
              >
                {area.available ? area.name : `${area.name} (coming soon)`}
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-6 text-center">
            All feedback is read personally and incorporated into release planning.
          </p>
        </Card>
      </div>

      {/* Feedback Modal */}
      <FeatureFeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        featureName={selectedFeature}
      />
    </section>
  )
}
