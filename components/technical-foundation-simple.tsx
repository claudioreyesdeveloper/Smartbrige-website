export function TechnicalFoundation() {
  return (
    <section className="py-20 px-4 bg-background">
      <div className="container mx-auto max-w-5xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-foreground">Technical Foundation</h2>

        <div className="space-y-8">
          <p className="text-base md:text-lg text-foreground/90 leading-relaxed text-pretty text-center max-w-3xl mx-auto">
            SmartBridge is a comprehensive web-based MIDI control interface for Yamaha arranger keyboards, combining the
            strengths of web and native technologies to provide responsive, professional-grade control.
          </p>

          <div className="glass-panel rounded-2xl p-8 md:p-12 mt-12">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center space-y-3">
                <h3 className="text-xl font-semibold text-foreground">Web</h3>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Next.js 15</p>
                  <p>React 19</p>
                  <p>TypeScript</p>
                </div>
              </div>

              <div className="text-center space-y-3">
                <h3 className="text-xl font-semibold text-foreground">VST Plugin</h3>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>JUCE Framework</p>
                </div>
              </div>

              <div className="text-center space-y-3">
                <h3 className="text-xl font-semibold text-foreground">iOS Application</h3>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Swift</p>
                  <p>UIKit Framework</p>
                </div>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-border">
              <p className="text-sm text-muted-foreground text-center italic">
                Future development includes Cubase Remote MIDI integration to automatically align the 32 SmartBridge
                channels with matching Cubase tracks.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
