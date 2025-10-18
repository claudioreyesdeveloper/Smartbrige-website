"use client"

import { Button } from "@/components/ui/button"
import { MessageSquare, Users, Heart } from "lucide-react"
import { useState, useEffect } from "react"
import Link from "next/link"

const features = [
  { id: "home-screen", name: "Performance Dashboard", icon: "🏠" },
  { id: "voice-browser", name: "Voice Browser", icon: "🎵" },
  { id: "mixer-interface", name: "Mixer Interface", icon: "🎚️" },
  { id: "registration-manager", name: "Registration Manager", icon: "💾" },
  { id: "assembly-workbench", name: "Assembly Workbench", icon: "🔧" },
  { id: "style-editor", name: "Style Editor", icon: "✏️" },
  { id: "chord-sequencer", name: "Chord Sequencer", icon: "🎹" },
  { id: "midi-logger", name: "MIDI Logger", icon: "📊" },
]

export function CommunityCollaboration() {
  const [votes, setVotes] = useState<Record<string, number>>({})
  const [userVotes, setUserVotes] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Load votes from localStorage
    const savedVotes = localStorage.getItem("feature-votes")
    const savedUserVotes = localStorage.getItem("user-votes")
    if (savedVotes) setVotes(JSON.parse(savedVotes))
    if (savedUserVotes) setUserVotes(new Set(JSON.parse(savedUserVotes)))
  }, [])

  const handleVote = (featureId: string) => {
    const newUserVotes = new Set(userVotes)
    const newVotes = { ...votes }

    if (newUserVotes.has(featureId)) {
      // Remove vote
      newUserVotes.delete(featureId)
      newVotes[featureId] = (newVotes[featureId] || 0) - 1
    } else {
      // Add vote
      newUserVotes.add(featureId)
      newVotes[featureId] = (newVotes[featureId] || 0) + 1
    }

    setUserVotes(newUserVotes)
    setVotes(newVotes)
    localStorage.setItem("feature-votes", JSON.stringify(newVotes))
    localStorage.setItem("user-votes", JSON.stringify(Array.from(newUserVotes)))
  }

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        {/* Main heading */}
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-6">
            Built Together with the Yamaha Community.
          </h2>

          <p className="text-base sm:text-lg md:text-xl text-foreground/90 leading-relaxed max-w-3xl mx-auto">
            Although SmartBridge started as a private project, it now grows through user feedback and collaboration.
            <br className="hidden sm:block" />
            Every idea or comment helps shape the future — from performance features to new creative tools.
          </p>
        </div>

        <div className="mb-12">
          <div className="text-center mb-8">
            <h3 className="text-xl sm:text-2xl font-semibold text-foreground mb-3">Help Us Prioritize</h3>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
              Which features matter most to you? Your votes help guide development priorities.
              <br className="hidden sm:block" />
              Click the heart to show what you'd like to see improved first.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-5xl mx-auto">
            {features.map((feature) => {
              const voteCount = votes[feature.id] || 0
              const hasVoted = userVotes.has(feature.id)

              return (
                <button
                  key={feature.id}
                  onClick={() => handleVote(feature.id)}
                  className={`
                    group relative p-4 rounded-xl border transition-all duration-200
                    ${
                      hasVoted
                        ? "bg-amber-500/10 border-amber-500/30 shadow-sm"
                        : "bg-card/50 border-border hover:border-amber-500/20 hover:bg-card/80"
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{feature.icon}</span>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-foreground">{feature.name}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Heart
                        className={`w-4 h-4 transition-all ${
                          hasVoted
                            ? "fill-amber-500 text-amber-500"
                            : "text-muted-foreground group-hover:text-amber-500"
                        }`}
                      />
                      <span className="text-xs font-medium text-muted-foreground">{voteCount}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="text-center mt-6">
            <Link
              href="/feature-voting"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
            >
              View detailed feature descriptions and leave feedback
            </Link>
          </div>
        </div>

        {/* Existing buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
          <Button size="lg" className="gap-2" asChild>
            <Link href="/feature-voting">
              <MessageSquare className="w-4 h-4" />
              Leave Detailed Feedback
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="gap-2 bg-transparent">
            <Users className="w-4 h-4" />
            Join Development Conversation
          </Button>
        </div>

        <p className="text-sm text-muted-foreground text-center">
          Email:{" "}
          <a href="mailto:claudio.private@gmail.com" className="text-primary hover:underline">
            claudio.private@gmail.com
          </a>
        </p>
      </div>
    </section>
  )
}
