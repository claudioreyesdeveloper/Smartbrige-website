import { Card } from "@/components/ui/card"
import Image from "next/image"

export function AboutCreator() {
  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">About the Creator.</h2>
        </div>

        <div className="grid md:grid-cols-[300px_1fr] gap-8 items-start">
          <Card className="bg-card border-border overflow-hidden">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/JPEG%20image-441D-9BC9-69-0.JPEG-qIcpNL3drusk2Mph4L6eNYlRCe86gl.jpeg"
              alt="Claudio"
              width={300}
              height={300}
              className="w-full h-auto object-cover"
            />
          </Card>

          <div className="space-y-4 text-foreground leading-relaxed">
            <p>
              Claudio is a long-time Yamaha keyboard player and arranger. After years of performing with Tyros and
              Genos, he grew tired of navigating menus instead of making music.
            </p>

            <p>When he couldn't find a plugin that offered complete 32-channel control, he built one himself.</p>

            <p>SmartBridge began as a tool for personal use — but has grown into something worth sharing.</p>

            <p className="italic text-muted-foreground border-l-2 border-primary pl-4">
              "I'm not a professional developer," Claudio says, "just a musician who wanted my instruments to feel
              faster, freer, and more musical."
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
