export function FeaturesOverview() {
  const features = [
    {
      image:
        "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Mixer%20interface-Aq4Ry0zzfqJXxqvvJqLqxqvvJqLqxq.jpg",
      caption: "Full 32-channel mixer with bi-directional communication. Save and reopen complete mixes instantly.",
    },
    {
      image: "/dsp-console-with-reverb-delay-eq-effects-panel.jpg",
      caption: "Direct access to Yamaha's internal effects — reverb, delay, EQ, and more — through an intuitive panel.",
    },
    {
      image:
        "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Voice%20Browser-BqXZNqvvJqLqxqvvJqLqxqvvJqLqxq.jpg",
      caption: "Fast, touch-friendly selection of voices, identical categories to your arranger.",
    },
    {
      image: "/score-studio-chord-progression-library-interface.jpg",
      caption:
        "A library of style-based chord progressions. Audition them as piano riffs or chord blocks that drive the arranger's style engine, then drag and drop into your DAW.",
    },
    {
      image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Dashboard-CqXZNqvvJqLqxqvvJqLqxqvvJqLqxq.jpg",
      caption: "Unified setup for MIDI, audio, and sync across PSR, Tyros, and Genos.",
    },
  ]

  return (
    <section className="py-20 px-4 bg-muted/20">
      <div className="container mx-auto max-w-6xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-foreground">Features Overview</h2>

        <div className="grid gap-12">
          {features.map((feature, index) => (
            <div
              key={index}
              className="glass-panel rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-300"
            >
              <div className="aspect-video w-full overflow-hidden bg-muted">
                <img
                  src={feature.image || "/placeholder.svg"}
                  alt={feature.caption}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-6">
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">{feature.caption}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
