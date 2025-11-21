export function Solution() {
  return (
    <section className="py-20 px-4 bg-muted/20">
      <div className="container mx-auto max-w-5xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-foreground">The Solution</h2>

        <div className="space-y-8 text-base md:text-lg text-foreground/90 leading-relaxed">
          <p className="text-pretty">
            The turning point came when he sought a software solution — a genuine, integrated control surface — that
            could provide the kind of complete, professional-grade 32-channel mixing and control required for complex
            arrangements. When no existing plugin or utility offered that level of access, the decision was simple: he
            built it himself.
          </p>

          <p className="text-pretty">
            SmartBridge was born not out of commercial ambition, but as a personal tool to reclaim creative flow. It was
            engineered in his studio to solve his own problems, designed to be the intuitive, touch-ready interface the
            hardware always deserved.
          </p>

          {/* Image of Claudio in studio */}
          <div className="mt-12 mb-12 flex justify-center">
            <div className="glass-panel rounded-2xl overflow-hidden max-w-md">
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/JPEG%20image-441D-9BC9-69-0.JPEG-bDgqmsdodHg4drhUeQZMU1i2yOv1De.jpeg"
                alt="Claudio in studio"
                className="w-full h-auto"
              />
            </div>
          </div>

          {/* Quote */}
          <div className="glass-panel rounded-2xl p-8 md:p-12 border-l-4 border-primary">
            <blockquote className="text-lg md:text-xl italic text-foreground/80 text-pretty">
              "I'm not a professional developer; I'm just a musician who wanted my instruments to feel faster, freer,
              and more musical."
            </blockquote>
            <p className="mt-4 text-sm text-muted-foreground">— Claudio</p>
          </div>
        </div>
      </div>
    </section>
  )
}
