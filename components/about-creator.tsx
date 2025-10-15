import { Card } from "@/components/ui/card"
import Image from "next/image"

export function AboutCreator() {
  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">About the Creator</h2>
          <p className="text-muted-foreground text-lg">Built by a player, not a vendor</p>
        </div>

        <div className="space-y-12">
          <Card className="bg-card/30 backdrop-blur-sm border-border/50 overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="grid md:grid-cols-[280px_1fr] gap-6 sm:gap-8 p-6 sm:p-8 items-center">
              <div className="mx-auto md:mx-0">
                <div className="rounded-xl overflow-hidden shadow-md">
                  <Image
                    src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_0038.PNG-13U9f2T88ziPvwKEqgmS0EiYjSY2nX.png"
                    alt="Claudio - Creator of SmartBridge"
                    width={280}
                    height={373}
                    className="w-full h-auto object-cover"
                  />
                </div>
              </div>

              <div className="space-y-4 text-foreground/90 leading-relaxed">
                <h3 className="text-xl sm:text-2xl font-semibold text-foreground mb-4">The Journey</h3>
                <p className="text-base sm:text-lg">
                  Claudio's journey with music and technology is deeply rooted in the powerful, yet sometimes
                  frustrating, world of Yamaha arranger keyboards. As a long-time keyboard player and arranger who has
                  spent countless hours performing and creating with the Tyros series, he knows their capabilities
                  intimately.
                </p>

                <p>
                  The sheer depth of these instruments is a double-edged sword: immense power is often buried beneath
                  layers of menus. After years of live performance and intensive studio work, Claudio grew increasingly
                  tired of navigating deep, multi-step menus instead of simply making music.
                </p>

                <p className="text-muted-foreground italic">
                  Every time a quick voice swap, pan adjustment, or style track tweak was needed, the workflow came to a
                  frustrating halt.
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-card/30 backdrop-blur-sm border-border/50 overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="grid md:grid-cols-[1fr_280px] gap-6 sm:gap-8 p-6 sm:p-8 items-center">
              <div className="space-y-4 text-foreground/90 leading-relaxed order-2 md:order-1">
                <h3 className="text-xl sm:text-2xl font-semibold text-foreground mb-4">The Solution</h3>
                <p>
                  The turning point came when he sought a software solution—a genuine, integrated control surface—that
                  could provide the kind of complete, professional-grade 32-channel mixing and control required for
                  complex arrangements. When he couldn't find a plugin or utility that offered this necessary level of
                  granular access, the decision was simple: he built it himself.
                </p>

                <p>
                  SmartBridge was born not out of commercial ambition, but as a personal, essential tool to reclaim
                  creative flow. It was originally engineered in his studio to solve his own problems, designed to be
                  the intuitive, touch-ready interface the hardware always deserved.
                </p>

                <div className="mt-6 p-4 bg-amber-500/10 border-l-4 border-amber-500 rounded-r-lg">
                  <p className="text-base sm:text-lg italic text-foreground/90">
                    "I'm not a professional developer; I'm just a musician who wanted my instruments to feel faster,
                    freer, and more musical."
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">— Claudio</p>
                </div>
              </div>

              <div className="mx-auto md:mx-0 order-1 md:order-2">
                <div className="rounded-xl overflow-hidden shadow-md">
                  <Image
                    src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/JPEG%20image-441D-9BC9-69-0.JPEG-bDgqmsdodHg4drhUeQZMU1i2yOv1De.jpeg"
                    alt="Claudio in his studio"
                    width={280}
                    height={373}
                    className="w-full h-auto object-cover"
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}
