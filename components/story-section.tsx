import Image from "next/image"

export function StorySection() {
  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Built from Frustration. Refined by Passion.</h2>
        </div>

        <div className="bg-white border border-border/50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 md:p-12 mb-12">
          <p className="text-lg text-muted-foreground leading-relaxed mb-6">
            I'm not a professional developer — just a Yamaha player who grew tired of navigating endless menus.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed mb-6">
            When no plugin could manage all 32 channels efficiently, I built one that could.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed">
            SmartBridge was created for musicians who want speed, clarity, and control.
          </p>
        </div>

        <div className="bg-white border border-border/50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 md:p-12">
          <h3 className="text-3xl font-bold mb-8 text-center">About the Creator</h3>

          <div className="max-w-sm mx-auto mb-8">
            <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-primary/30 transition-all duration-500">
              <Image
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/JPEG%20image-441D-9BC9-69-0.JPEG-qIcpNL3drusk2Mph4L6eNYlRCe86gl.jpeg"
                alt="Claudio in his music production studio"
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>

          <div className="space-y-4 text-lg text-muted-foreground leading-relaxed max-w-3xl mx-auto text-center">
            <p>
              Claudio is a Yamaha keyboardist and independent creator behind SmartBridge, dedicated to making expressive
              control accessible to every performer.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
