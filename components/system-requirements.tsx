import { Card } from "@/components/ui/card"
import { Monitor, HardDrive, Wifi, Cable } from "lucide-react"

export function SystemRequirements() {
  const requirements = [
    {
      icon: Monitor,
      text: "Windows 10 or later / macOS 13 or later",
    },
    {
      icon: HardDrive,
      text: "Minimum 8 GB RAM, 500 MB free space",
    },
    {
      icon: Cable,
      text: "MIDI interface or USB connection for keyboard control",
    },
    {
      icon: Wifi,
      text: "Internet connection for activation and updates",
    },
  ]

  return (
    <section className="py-24 px-6">
      <div className="container mx-auto max-w-4xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">System Requirements</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {requirements.map((req, index) => {
            const Icon = req.icon
            return (
              <Card
                key={index}
                className="bg-card border-border hover:border-primary/50 transition-all duration-300 p-6"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                    <Icon className="h-6 w-6 text-primary" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{req.text}</p>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
