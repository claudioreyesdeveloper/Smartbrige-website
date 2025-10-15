import { Card } from "@/components/ui/card"

export function RoadmapSection() {
  const roadmapPhases = [
    {
      version: "0.9",
      title: "Performance Foundation",
      status: "current",
      description:
        "This is where SmartBridge becomes your new control surface. You'll be able to perform in real time with a modern dashboard showing all four keyboard parts — Left 1, Left 2, Right 1, Right 2 — and direct control of styles, tempo, and transport (Start/Stop/Sync Start).",
      features: [
        "Change sounds instantly through the Voice Browser, which gives access to the entire Tyros5 voice library, categorized and searchable",
        "Shape your mix using the professional 32-channel Mixer — complete with volume, pan, EQ, reverb, and chorus for each part",
        "Everything responds visually and immediately. Whether on a tablet, laptop, or desktop, you get a fast, touch-optimized interface built for live performance",
      ],
    },
    {
      version: "1.0",
      title: "Chord Sequencer",
      status: "upcoming",
      description:
        "This update brings composition and arrangement directly into SmartBridge. You'll have a timeline-based chord editor with multi-section support (Intro, Verse, Chorus, Bridge, Outro), bar/beat grid for exact chord placement and duration, and support for all chord types, slash chords, extensions, and inversions.",
      features: [
        "Real-time playback synced with your Tyros5 style",
        "MIDI export so progressions can be used in your DAW",
        "It turns SmartBridge into a songwriting and practice companion — ideal for building progressions and rehearsing arrangements",
      ],
    },
    {
      version: "1.1",
      title: "Registration Manager",
      status: "upcoming",
      description:
        "Here SmartBridge adds performance memory. You'll be able to store and recall full setups — voices, mixer settings, styles, effects, and global configuration — across 8 banks with 8 slots each (64 total registrations).",
      features: [
        "Freeze controls to protect selected parameters during recall (tempo, mixer, voice, etc.)",
        "Sequences for automated, hands-free song switching via foot pedal or MIDI",
        "Import/Export in simple JSON files for backup and sharing",
        "This version is all about consistency on stage — one click (or pedal press) recalls your exact sound",
      ],
    },
    {
      version: "1.2",
      title: "Assembly Workbench",
      status: "upcoming",
      description:
        "This release focuses on creative style building. You can combine and customize style parts visually with drag & drop across 11 style sections and 8 tracks. Preview, solo, mute, and edit in real time.",
      features: [
        "Fine-tune transposition rules (NTR/NTT/RTR) and note limits",
        "Save your new hybrid style directly to Tyros5 memory",
        "It's the studio side of SmartBridge — built for arrangers who like to design their own grooves and backing patterns",
      ],
    },
    {
      version: "1.3",
      title: "MIDI Logger and Diagnostics",
      status: "upcoming",
      description:
        "The final piece of the first development cycle focuses on transparency and troubleshooting. You'll be able to monitor all incoming and outgoing MIDI messages in real time.",
      features: [
        "Filter by message type (Notes, CCs, Program Changes, etc.)",
        "View timestamps, port info, and performance metrics",
        "Export logs for detailed analysis",
        "This is the 'under-the-hood' tool for anyone who wants full visibility into how SmartBridge talks to the Tyros",
      ],
    },
  ]

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 sm:mb-6">
            The Journey Ahead: <span className="text-amber-500">Built Together.</span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-foreground/90 leading-relaxed max-w-3xl mx-auto">
            Every stage is open to feedback. Your input guides the development process and shapes the final product.
          </p>
        </div>

        <div className="space-y-6">
          {roadmapPhases.map((phase, index) => (
            <Card
              key={index}
              className={`p-6 sm:p-8 bg-card transition-all hover:shadow-lg ${
                phase.status === "current"
                  ? "border-amber-500/30 hover:border-amber-500/50 hover:shadow-amber-500/20"
                  : "border-cyan-500/30 hover:border-cyan-500/50 hover:shadow-cyan-500/20"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
                <div className="flex-shrink-0">
                  <div
                    className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${
                      phase.status === "current"
                        ? "bg-amber-500/10 border-amber-500/30 shadow-amber-500/20"
                        : "bg-cyan-500/10 border-cyan-500/30 shadow-cyan-500/20"
                    } border shadow-lg`}
                  >
                    <span
                      className={`text-lg font-bold ${phase.status === "current" ? "text-amber-400" : "text-cyan-400"}`}
                    >
                      {phase.version}
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl sm:text-2xl font-semibold text-foreground mb-3">{phase.title}</h3>
                  <p className="text-sm sm:text-base text-foreground/80 mb-4 leading-relaxed">{phase.description}</p>
                  <ul className="space-y-2">
                    {phase.features.map((feature, featureIndex) => (
                      <li
                        key={featureIndex}
                        className="flex items-start gap-2 text-sm sm:text-base text-muted-foreground"
                      >
                        <span className={phase.status === "current" ? "text-amber-400 mt-1" : "text-cyan-400 mt-1"}>
                          •
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-12 sm:mt-16 text-center">
          <h3 className="text-xl sm:text-2xl font-semibold text-foreground mb-4">Development Philosophy</h3>
          <p className="text-sm sm:text-base text-foreground/80 max-w-3xl mx-auto leading-relaxed mb-2">
            SmartBridge evolves with its users. Release timing depends on testing, feedback, and real-world use.
          </p>
          <p className="text-sm sm:text-base text-foreground/80 max-w-3xl mx-auto leading-relaxed">
            Each stage is opened for community input — your comments directly shape how the next version works and
            feels.
          </p>
          <p className="text-sm sm:text-base text-cyan-400 font-medium max-w-3xl mx-auto leading-relaxed mt-4">
            Every milestone is built, tested, and refined with one goal in mind: to make your Yamaha arranger faster,
            freer, and more musical.
          </p>
        </div>
      </div>
    </section>
  )
}
