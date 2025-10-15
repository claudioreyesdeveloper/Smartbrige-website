import { Rocket } from "lucide-react"

export function QuickStart() {
  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="container mx-auto max-w-4xl">
        <div className="bg-white border border-border/50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-12 text-center">
          <div className="inline-flex p-4 rounded-full bg-primary/10 border border-primary/30 mb-6">
            <Rocket className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">Start Instantly</h2>
          <p className="text-xl text-black leading-relaxed">
            SmartBridge includes curated performance templates, ready-made voice setups, and style shortcuts — so you
            can make music right away.
          </p>
        </div>
      </div>
    </section>
  )
}
