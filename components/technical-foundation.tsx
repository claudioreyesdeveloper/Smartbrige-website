import { Code, Smartphone, Layers } from "lucide-react"

export function TechnicalFoundation() {
  return (
    <section className="py-24 px-6 relative">
      <div className="container mx-auto max-w-6xl">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 text-center font-heading">
          Technical Foundation
        </h2>

        <div className="max-w-4xl mx-auto">
          {/* Glass panel with technical description */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-12 shadow-2xl">
            <p className="text-lg md:text-xl text-gray-300 leading-relaxed mb-8">
              SmartBridge is a comprehensive web-based MIDI control interface for the Yamaha Tyros5 keyboard, built with
              modern technologies including Next.js 15, React 19, and TypeScript to provide professional-grade control
              over all aspects of the instrument through an intuitive interface optimized for both desktop and touch
              devices, with standalone applications utilizing the JUCE framework for the VST version and the native
              Swift/UIKit framework for the iOS application.
            </p>

            {/* Technology highlights */}
            <div className="grid md:grid-cols-3 gap-6 mt-8">
              <div className="flex items-start gap-3">
                <Code className="w-6 h-6 text-cyan-400 mt-1 flex-shrink-0" strokeWidth={1.5} />
                <div>
                  <p className="text-white font-semibold mb-1">Web Technologies</p>
                  <p className="text-sm text-gray-400">Next.js 15, React 19, TypeScript</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Layers className="w-6 h-6 text-cyan-400 mt-1 flex-shrink-0" strokeWidth={1.5} />
                <div>
                  <p className="text-white font-semibold mb-1">VST Plugin</p>
                  <p className="text-sm text-gray-400">JUCE Framework</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Smartphone className="w-6 h-6 text-cyan-400 mt-1 flex-shrink-0" strokeWidth={1.5} />
                <div>
                  <p className="text-white font-semibold mb-1">iOS Application</p>
                  <p className="text-sm text-gray-400">Swift/UIKit Framework</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
