export function Journey() {
  return (
    <section className="py-20 px-4 bg-background">
      <div className="container mx-auto max-w-5xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-foreground">The Journey</h2>

        <div className="space-y-8 text-base md:text-lg text-foreground/90 leading-relaxed">
          <p className="text-pretty">
            Claudio's journey with music and technology is deeply rooted in the powerful, yet sometimes frustrating,
            world of Yamaha arranger keyboards. As a long-time keyboard player and arranger who has spent countless
            hours performing and creating with the Tyros series, he knows their capabilities intimately.
          </p>

          <p className="text-pretty">
            The sheer depth of these instruments is a double-edged sword: immense power is often buried beneath layers
            of menus. After years of live performance and intensive studio work, Claudio grew increasingly tired of
            navigating deep, multi-step menus instead of simply making music.
          </p>

          <p className="text-pretty">
            Every time a quick voice swap, pan adjustment, or style track tweak was needed, the workflow came to a
            frustrating halt.
          </p>

          {/* Image of Claudio reading */}
          <div className="mt-12 flex justify-center">
            <div className="glass-panel rounded-2xl overflow-hidden max-w-md">
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_0038.PNG-13U9f2T88ziPvwKEqgmS0EiYjSY2nX.png"
                alt="Claudio"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
