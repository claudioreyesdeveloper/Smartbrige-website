import { Card } from "@/components/ui/card"

export function CompatibilitySection() {
  const models = ["PSR Series", "Genos", "Tyros"]

  return (
    <section className="py-20 px-4 bg-background">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">Designed for the Yamaha Family</h2>
          <div className="max-w-3xl mx-auto space-y-4 text-lg text-muted-foreground leading-relaxed">
            <p>Fully compatible with PSR, Genos, and Tyros models.</p>
            <p>Supports all preset voices and Yamaha Premium Packs.</p>
            <p>
              SmartBridge integrates Expansion Voices by downloading the correct Cubase Patch file, including Expansion
              Packs, directly from Yamaha.
            </p>
            <p className="text-sm italic">
              Ongoing updates maintain compatibility with new Yamaha firmware and expansion content.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-4 mt-12">
          {models.map((model) => (
            <Card
              key={model}
              className="bg-white border border-border/50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 px-8 py-4"
            >
              <p className="text-lg font-semibold text-foreground">{model}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
