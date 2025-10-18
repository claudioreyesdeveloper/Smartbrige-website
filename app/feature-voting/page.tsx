"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Heart, Users, TrendingUp, MessageSquare } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { FeatureFeedbackDialog } from "@/components/feature-feedback-dialog"

interface Feature {
  id: string
  name: string
  description: string
  detailedDescription: string
  keyFeatures: string[]
  icon: string
}

const features: Feature[] = [
  {
    id: "home-dashboard",
    name: "Home Screen - Performance Dashboard",
    description:
      "Quick access to your 4 performance parts, style controls, and real-time voice assignment. Your command center for live performance.",
    detailedDescription:
      "The Home Screen is your performance command center. It gives you instant visual access to all four keyboard parts (Right 1, Right 2, Left, Style), shows which voices are currently assigned, and provides one-tap access to the Voice Browser for quick changes. Style controls (tempo, transpose, section switching) are always visible, so you never have to dig through menus mid-performance.",
    keyFeatures: [
      "Visual overview of all 4 performance parts",
      "One-tap voice assignment from any part",
      "Real-time style controls (tempo, transpose, sections)",
      "Quick access to Voice Browser and Mixer",
    ],
    icon: "🏠",
  },
  {
    id: "voice-browser",
    name: "Voice Browser",
    description:
      "Browse and search through 1,000+ Tyros5 voices with smart collections, favorites, and a lightning-fast command palette.",
    detailedDescription:
      "The Voice Browser is a comprehensive voice management system that makes finding the right sound effortless. Browse by category and subcategory, search by name, or use the command palette (⌘K) for instant access. Mark favorites, see recently used voices, and assign sounds to any part with a single tap. No more scrolling through endless menus on the keyboard's tiny screen.",
    keyFeatures: [
      "Browse 1,000+ voices by category and subcategory",
      "Lightning-fast search with command palette (⌘K)",
      "Favorites and recently used collections",
      "One-tap assignment to any performance part",
    ],
    icon: "🎹",
  },
  {
    id: "mixer-interface",
    name: "Mixer Interface",
    description:
      "Professional 16-channel mixing console with volume, pan, reverb, chorus, and 3-band EQ for each channel.",
    detailedDescription:
      "The Mixer Interface provides professional-grade control over your sound. Adjust volume, pan, reverb, and chorus for each of the 16 MIDI channels. Each channel includes a 3-band EQ (low, mid, high) for precise tonal shaping. Visual feedback shows which channels are active, and you can save your mix settings as part of Registration Memory for instant recall.",
    keyFeatures: [
      "16-channel mixing console with visual feedback",
      "Volume, pan, reverb, and chorus per channel",
      "3-band EQ (low, mid, high) for each channel",
      "Save and recall mix settings with Registration Memory",
    ],
    icon: "🎚️",
  },
  {
    id: "registration-manager",
    name: "Registration Manager",
    description:
      "Save and recall complete performance setups with 8 banks of 8 slots each. Never lose your perfect sound again.",
    detailedDescription:
      "Registration Manager is your performance memory system. Save complete snapshots of your setup—voices, mixer settings, style selections, tempo, transpose—into 64 slots (8 banks × 8 slots). Organize by song, setlist, or genre. Switch between registrations instantly during performance. Export and import registration banks to share with other SmartBridge users or back up your work.",
    keyFeatures: [
      "64 registration slots (8 banks × 8 slots)",
      "Save complete performance snapshots (voices, mixer, style, tempo)",
      "Organize by song, setlist, or genre",
      "Export/import registration banks for backup and sharing",
    ],
    icon: "💾",
  },
  {
    id: "assembly-workbench",
    name: "Assembly Workbench",
    description:
      "Create custom hybrid styles by mixing and matching parts from different Tyros5 styles with drag-and-drop simplicity.",
    detailedDescription:
      "The Assembly Workbench lets you build custom hybrid styles by combining parts from different Tyros5 styles. Drag and drop rhythm, bass, chord, pad, and phrase tracks from any style into your assembly. Preview each part in isolation, adjust volumes and effects, and save your creation as a new style. Perfect for creating unique backing tracks that match your exact musical vision.",
    keyFeatures: [
      "Drag-and-drop style part assembly",
      "Mix rhythm, bass, chord, pad, and phrase tracks from any style",
      "Preview parts in isolation before committing",
      "Save custom hybrid styles for later use",
    ],
    icon: "🔧",
  },
  {
    id: "style-editor",
    name: "Style Editor",
    description: "Advanced style control with assembly, mixing, and chord sequencing all in one integrated workspace.",
    detailedDescription:
      "The Style Editor is an integrated workspace that combines Assembly Workbench, Mixer Interface, and Chord Sequencer into one powerful environment. Build custom styles, adjust the mix, and program chord progressions—all without switching screens. Perfect for arrangers and producers who want complete control over their backing tracks.",
    keyFeatures: [
      "Integrated workspace combining assembly, mixing, and sequencing",
      "Build and edit custom styles in one place",
      "Real-time preview of style changes",
      "Export finished styles for use in performances",
    ],
    icon: "✏️",
  },
  {
    id: "chord-sequencer",
    name: "Chord Sequencer",
    description:
      "Timeline-based chord progression editor with 60+ curated progressions from 12 genres. Build your song structure visually.",
    detailedDescription:
      "The Chord Sequencer is a standalone chord programming tool that lets you build and edit chord progressions on a visual timeline. Choose from 60+ curated progressions across 12 genres, or build your own from scratch. Add intro, verse, chorus, bridge, and ending sections. Adjust tempo, transpose, and style sections for each part. Export your progression as a MIDI file or use it to drive style playback in real-time.",
    keyFeatures: [
      "Visual timeline-based chord editor",
      "60+ curated progressions from 12 genres",
      "Build song structures with intro, verse, chorus, bridge, ending",
      "Export as MIDI or use for real-time style playback",
    ],
    icon: "🎼",
  },
  {
    id: "midi-logger",
    name: "MIDI Logger & Diagnostics",
    description:
      "Real-time MIDI monitoring and debugging tools. See exactly what's happening between SmartBridge and your keyboard.",
    detailedDescription:
      "The MIDI Logger provides complete transparency into the communication between SmartBridge and your Tyros5. See every MIDI message in real-time, filter by message type, and export logs for troubleshooting. Perfect for understanding how your keyboard responds to commands, debugging issues, or learning how MIDI works under the hood.",
    keyFeatures: [
      "Real-time MIDI message monitoring",
      "Filter by message type (Note On/Off, CC, SysEx, etc.)",
      "Export logs for troubleshooting and analysis",
      "Visual feedback for sent and received messages",
    ],
    icon: "🔍",
  },
]

export default function FeatureVotingPage() {
  const [votes, setVotes] = useState<Record<string, number>>({})
  const [userVotes, setUserVotes] = useState<Set<string>>(new Set())
  const [totalVoters, setTotalVoters] = useState(0)
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false)
  const [selectedFeature, setSelectedFeature] = useState<string>("")

  useEffect(() => {
    const savedVotes = localStorage.getItem("smartbridge-feature-votes")
    const savedUserVotes = localStorage.getItem("smartbridge-user-votes")
    const savedTotalVoters = localStorage.getItem("smartbridge-total-voters")

    if (savedVotes) {
      setVotes(JSON.parse(savedVotes))
    } else {
      const initialVotes: Record<string, number> = {}
      features.forEach((feature) => {
        initialVotes[feature.id] = Math.floor(Math.random() * 50) + 20
      })
      setVotes(initialVotes)
      localStorage.setItem("smartbridge-feature-votes", JSON.stringify(initialVotes))
    }

    if (savedUserVotes) {
      setUserVotes(new Set(JSON.parse(savedUserVotes)))
    }

    if (savedTotalVoters) {
      setTotalVoters(Number.parseInt(savedTotalVoters))
    } else {
      setTotalVoters(Math.floor(Math.random() * 100) + 50)
      localStorage.setItem("smartbridge-total-voters", String(Math.floor(Math.random() * 100) + 50))
    }
  }, [])

  const handleVote = (featureId: string) => {
    if (userVotes.has(featureId)) {
      const newVotes = { ...votes, [featureId]: votes[featureId] - 1 }
      const newUserVotes = new Set(userVotes)
      newUserVotes.delete(featureId)

      setVotes(newVotes)
      setUserVotes(newUserVotes)

      localStorage.setItem("smartbridge-feature-votes", JSON.stringify(newVotes))
      localStorage.setItem("smartbridge-user-votes", JSON.stringify([...newUserVotes]))
    } else {
      const newVotes = { ...votes, [featureId]: (votes[featureId] || 0) + 1 }
      const newUserVotes = new Set(userVotes)
      newUserVotes.add(featureId)

      setVotes(newVotes)
      setUserVotes(newUserVotes)

      localStorage.setItem("smartbridge-feature-votes", JSON.stringify(newVotes))
      localStorage.setItem("smartbridge-user-votes", JSON.stringify([...newUserVotes]))

      if (userVotes.size === 0) {
        const newTotal = totalVoters + 1
        setTotalVoters(newTotal)
        localStorage.setItem("smartbridge-total-voters", String(newTotal))
      }
    }
  }

  const handleOpenFeedback = (featureName: string) => {
    setSelectedFeature(featureName)
    setFeedbackDialogOpen(true)
  }

  const sortedFeatures = [...features].sort((a, b) => (votes[b.id] || 0) - (votes[a.id] || 0))

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a1f2e] via-[#1e2433] to-[#222938]">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Home</span>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 font-heading">Help Shape SmartBridge</h1>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
            Your voice matters. Vote for the features you want to see prioritized in development.
          </p>

          <div className="flex items-center justify-center gap-8 mb-8">
            <div className="flex items-center gap-2 text-gray-300">
              <Users className="w-5 h-5 text-amber-400" />
              <span className="text-lg">
                <strong className="text-white">{totalVoters}</strong> community members
              </span>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <TrendingUp className="w-5 h-5 text-amber-400" />
              <span className="text-lg">
                <strong className="text-white">{Object.values(votes).reduce((a, b) => a + b, 0)}</strong> total votes
              </span>
            </div>
          </div>
        </div>

        <Card className="bg-gradient-to-br from-amber-900/20 to-orange-900/20 border-amber-500/30 p-8 mb-12 backdrop-blur-sm">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="flex-shrink-0">
              <Image
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_0038.PNG-13U9f2T88ziPvwKEqgmS0EiYjSY2nX.png"
                alt="Claudio"
                width={120}
                height={120}
                className="rounded-full border-2 border-amber-400/50"
              />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-amber-400 mb-3 font-heading">A Note from Claudio</h3>
              <p className="text-gray-200 leading-relaxed mb-4">
                SmartBridge started as a personal tool to solve my own frustrations with menu diving. Now it's growing
                into something bigger, and I want to make sure I'm building what <em>you</em> actually need.
              </p>
              <p className="text-gray-200 leading-relaxed">
                Your votes help me understand which features matter most to fellow musicians. I'm not a professional
                developer—just a musician who codes—so your feedback is invaluable in guiding where I focus my time.
                Thank you for being part of this journey.
              </p>
              <p className="text-amber-300 mt-4 font-medium">— Claudio</p>
            </div>
          </div>
        </Card>

        <div className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border border-cyan-500/30 rounded-2xl p-6 mb-8 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <Heart className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">How to Vote</h3>
              <p className="text-gray-300 leading-relaxed">
                Click the vote button on any feature you'd like to see prioritized. You can vote for multiple features,
                and you can change your votes anytime. Features are ranked by total votes.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {sortedFeatures.map((feature, index) => {
            const voteCount = votes[feature.id] || 0
            const hasVoted = userVotes.has(feature.id)
            const rank = index + 1

            return (
              <Card
                key={feature.id}
                className={`bg-gradient-to-br from-gray-900/80 to-gray-800/80 border transition-all duration-300 hover:scale-[1.01] ${
                  hasVoted
                    ? "border-amber-500/50 shadow-lg shadow-amber-500/20"
                    : "border-white/10 hover:border-white/20"
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                        rank === 1
                          ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white"
                          : rank === 2
                            ? "bg-gradient-to-br from-gray-300 to-gray-400 text-gray-900"
                            : rank === 3
                              ? "bg-gradient-to-br from-amber-600 to-amber-700 text-white"
                              : "bg-gray-700 text-gray-300"
                      }`}
                    >
                      {rank}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3 mb-3">
                        <span className="text-3xl flex-shrink-0">{feature.icon}</span>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-white mb-2 font-heading">{feature.name}</h3>
                          <p className="text-gray-300 leading-relaxed mb-3">{feature.description}</p>
                          <p className="text-sm text-gray-400 leading-relaxed mb-3">{feature.detailedDescription}</p>
                          <div className="space-y-1">
                            {feature.keyFeatures.map((keyFeature, idx) => (
                              <div key={idx} className="flex items-start gap-2">
                                <span className="text-amber-400 text-xs mt-1">▸</span>
                                <span className="text-xs text-gray-400 leading-relaxed">{keyFeature}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex-shrink-0 flex flex-col items-center gap-2">
                      <Button
                        onClick={() => handleVote(feature.id)}
                        className={`transition-all duration-300 ${
                          hasVoted
                            ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/30"
                            : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                        }`}
                      >
                        <Heart className={`w-5 h-5 mr-2 ${hasVoted ? "fill-current" : ""}`} />
                        {hasVoted ? "Voted" : "Vote"}
                      </Button>
                      <span className="text-sm font-semibold text-gray-400">
                        {voteCount} {voteCount === 1 ? "vote" : "votes"}
                      </span>
                      <Button
                        onClick={() => handleOpenFeedback(feature.name)}
                        variant="outline"
                        size="sm"
                        className="mt-2 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/50 text-xs"
                      >
                        <MessageSquare className="w-3 h-3 mr-1" />
                        Leave Feedback
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-400 leading-relaxed max-w-2xl mx-auto">
            This voting helps guide development priorities, but all features will eventually be built. Your feedback
            ensures the most-wanted features come first.
          </p>
        </div>
      </div>

      <FeatureFeedbackDialog
        featureName={selectedFeature}
        open={feedbackDialogOpen}
        onOpenChange={setFeedbackDialogOpen}
      />
    </div>
  )
}
