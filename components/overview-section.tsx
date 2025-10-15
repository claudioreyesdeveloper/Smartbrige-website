export function OverviewSection() {
  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="container mx-auto max-w-4xl">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 sm:mb-6">
            What SmartBridge Is.
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-foreground/90 leading-relaxed max-w-3xl mx-auto">
            SmartBridge is a modern web-based MIDI control interface that connects directly to your Yamaha keyboard.
            <br className="hidden sm:block" />
            It runs on desktop or tablet and replaces deep navigation with clear visual control of sounds, mixer
            channels, and performance settings.
          </p>
        </div>
      </div>
    </section>
  )
}
