import { Card } from "@/components/ui/card"
import { Music2, Sliders, Puzzle, Music, Save, Wrench, Package, Plug } from "lucide-react"

const features = [
  {
    icon: Music2,
    title: "Voice Browser",
    description: "1,000+ voices across 16 categories",
  },
  {
    icon: Sliders,
    title: "Mixer",
    description: "16-channel control of volume, pan, reverb, chorus, brightness",
  },
  {
    icon: Puzzle,
    title: "Style Controls",
    description: "Select, start/stop, variation, tempo",
  },
  {
    icon: Music,
    title: "Smart Composer",
    description: "Visual chord progression editor with drag-and-drop",
  },
  {
    icon: Save,
    title: "Registration Manager",
    description: "Save and load performance setups",
  },
  {
    icon: Wrench,
    title: "Assembly Workbench",
    description: "Create custom style assemblies from SFF files",
  },
  {
    icon: Package,
    title: "Expansion Pack Support",
    description: "Includes Yamaha Premium Packs and voices",
  },
  {
    icon: Plug,
    title: "DAW Integration",
    description: "Planned for full MIDI and VST interoperability",
  },
]

export function Features() {
  return (
    <div className="py-8">
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((feature) => {
          const Icon = feature.icon
          return (
            <Card
              key={feature.title}
              className="bg-white border border-border/50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 group"
            >
              <div className="mb-4 inline-block p-3 rounded-lg bg-primary/10 border border-primary/20 transition-all duration-300">
                <Icon className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-black">{feature.title}</h3>
              <p className="text-sm text-black leading-relaxed">{feature.description}</p>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
