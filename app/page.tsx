"use client"

import { useState } from "react"
import Image from "next/image"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ChevronRight, X, Play, ArrowRight } from "lucide-react"

const features = [
  {
    id: "tyros-mixer",
    title: "Tyros Mixer",
    image: "/images/tyros_mixer.jpeg",
    whatItIs: "A full computer-based mixer and control interface for Yamaha Tyros. It gives you visual access to channel levels, pan, voice setup, sends, and other mix-related controls in one place.",
    whyItMatters: "It lets you shape the keyboard sound faster and with better overview than working only from the hardware screen. This makes it easier to stay focused on arranging and performing instead of menu diving."
  },
  {
    id: "motif-mixer",
    title: "Motif Mixer",
    image: "/images/motif_mixer.jpeg",
    whatItIs: "A dedicated mixer and control view for Yamaha Motif integration. It helps manage parts, layers, and sound balance from SmartBridge in a more visual and connected way.",
    whyItMatters: "It gives you quicker control over the Motif inside your wider setup, so you can treat it as part of the same creative workflow instead of a separate keyboard that slows you down."
  },
  {
    id: "jam-player",
    title: "Jam Player",
    image: "/images/jam_player_tyros.jpeg",
    whatItIs: "Jam Player is the place where chord progressions, song sections, and phrase-driven musical ideas come together. Instead of browsing disconnected clips, you work inside a musical context.",
    whyItMatters: "It helps you hear ideas as part of a real song flow. That makes it easier to develop sections, test arrangements, and build something musical rather than collecting random MIDI fragments."
  },
  {
    id: "jam-session",
    title: "Jam Session",
    image: "/images/jam_session.jpeg",
    whatItIs: "Jam Session is designed for shaping larger song structures and working with sections over time. It supports progression-based playback and helps organize ideas into a fuller arrangement.",
    whyItMatters: "It gives you a better path from sketch to song. Instead of stopping at a loop or one good phrase, you can start building a complete form with verses, choruses, and transitions."
  },
  {
    id: "solo-generator",
    title: "Solo Generator",
    image: "/images/solo_generator.jpeg",
    whatItIs: "The Solo Generator uses phrase-based material in a more intelligent way than a normal MIDI loop browser. It works inside the section and musical context of the song rather than treating phrases as isolated files.",
    whyItMatters: "It helps you generate solos that feel more connected to the arrangement. That means less time searching through unrelated MIDI and more time shaping a lead line that actually fits the song."
  },
  {
    id: "vocal-generator",
    title: "Vocal Generator",
    image: "/images/vocal_generator.jpeg",
    whatItIs: "The Vocal Generator extends the phrase workflow into vocal writing. It gives you a way to create melodic vocal material that can become lead vocals, choirs, or backing layers.",
    whyItMatters: "It helps turn a musical sketch into a more complete production idea. Instead of stopping with chords and instrument parts, you can start hearing how vocal lines may sit in the arrangement."
  },
  {
    id: "lyrics",
    title: "Lyrics Workflow",
    image: "/images/lyrics.jpeg",
    whatItIs: "The Lyrics workflow brings words into the same environment as chords, phrases, and vocal ideas. It supports the writing and editing process as part of the song-building workflow.",
    whyItMatters: "It helps connect musical inspiration with lyric writing while the song is still alive in your ears. That makes it easier to move from instrumental ideas toward a complete song concept."
  },
  {
    id: "riff-maker",
    title: "Riff Maker / Motif Workflow",
    image: "/images/riff_maker.jpeg",
    whatItIs: "Riff Maker is focused on motif and riff creation around chord progressions. It helps you audition and shape repeating ideas that can become hooks, accompaniment patterns, or section material.",
    whyItMatters: "It gives you a practical way to develop strong recurring musical ideas instead of relying only on static loops. That can make the arrangement feel more personal and composition-driven."
  }
]

const supportingFeatures = [
  {
    title: "Tyros DSP and Sound Control",
    image: "/images/tyros_dsp_effects.jpeg",
    whatItIs: "A dedicated view for DSP-related sound shaping and detailed Tyros control from the computer interface.",
    whyItMatters: "It makes it easier to refine sound character and polish the keyboard mix while staying inside the same working environment."
  },
  {
    title: "Record Section Output",
    image: "/images/record_section_motif.jpeg",
    whatItIs: "A workflow for recording generated or performance-based material so it can move into the next production stage.",
    whyItMatters: "It helps turn ideas into usable material quickly, which is important when you want to capture inspiration and continue building in the DAW."
  },
  {
    title: "Settings and System Setup",
    image: "/images/settings.jpeg",
    whatItIs: "A central setup area for managing the SmartBridge environment and workflow options.",
    whyItMatters: "It helps keep the system stable and organized so you can spend more time making music and less time troubleshooting your setup."
  }
]

const galleryImages = [
  { src: "/images/jam_player_motif.jpeg", caption: "Jam Player Motif View" },
  { src: "/images/gallery-1.jpeg", caption: "Settings Configuration" },
  { src: "/images/gallery-2.jpeg", caption: "Lyrics Editor" },
  { src: "/images/gallery-3.jpeg", caption: "Jam Session Timeline" }
]

export default function Home() {
  const [activeFeature, setActiveFeature] = useState(0)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [expandedDiff, setExpandedDiff] = useState<number | null>(null)

  const differentiators = [
    { title: "Beyond static MIDI loops", desc: "SmartBridge treats phrases as part of a song workflow, not just drag-and-drop content." },
    { title: "Arrangement-aware workflow", desc: "It helps build sections, structure, and musical development rather than isolated clips." },
    { title: "Harmonization across multiple layers", desc: "SmartBridge can grow into brass, strings, and vocal harmonization as part of the arrangement process." },
    { title: "Lyrics and vocals connected to the music", desc: "It does not stop at MIDI ideas; it can move toward words and vocal production." },
    { title: "Yamaha + DAW integration", desc: "It connects keyboard workflow with computer-based production in a practical way." }
  ]

  return (
    <div className="min-h-screen bg-stone-50 text-slate-800 font-sans">
      <Header />

      <main className="pt-20">
        {/* HERO SECTION */}
        <section className="bg-gradient-to-b from-white to-stone-100 py-20 lg:py-28">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div className="order-2 lg:order-1">
                <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-bold text-slate-900 mb-6 leading-[1.15] tracking-tight text-balance">
                  From MIDI Phrase to Full Arrangement
                </h1>
                <p className="text-lg text-slate-600 leading-relaxed mb-6">
                  SmartBridge combines Yamaha keyboard control, phrase-driven songwriting, harmonization for brass, strings, and vocals, lyrics generation, Synthesizer V workflow, and direct DAW export in one connected system.
                </p>
                <p className="text-base text-slate-500 leading-relaxed mb-8">
                  Instead of working with isolated MIDI clips, SmartBridge helps musicians build full arrangements with chord-aware phrases, vocal ideas, harmonization layers, and hardware-to-DAW workflow.
                </p>
                <div className="flex flex-wrap gap-4">
                  <a 
                    href="#features" 
                    className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-all hover:shadow-lg hover:shadow-amber-500/25"
                  >
                    See Features
                    <ChevronRight className="w-4 h-4" />
                  </a>
                  <button className="inline-flex items-center gap-2 px-6 py-3 border-2 border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-white font-medium rounded-lg transition-all">
                    <Play className="w-4 h-4" />
                    Watch Demo
                  </button>
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <div 
                  className="relative aspect-video bg-slate-200 rounded-2xl overflow-hidden shadow-2xl shadow-slate-300/50 cursor-pointer group"
                  onClick={() => setLightboxImage("/images/jam_player_tyros.jpeg")}
                >
                  <Image
                    src="/images/jam_player_tyros.jpeg"
                    alt="Jam Player Tyros"
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    priority
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-medium text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to expand
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CORE FEATURES - INTERACTIVE TAB SECTION */}
        <section id="features" className="py-20 lg:py-28 bg-white">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Core Features</h2>
              <p className="text-lg text-slate-500">Eight integrated modules for complete creative control</p>
            </div>

            {/* Feature Tabs */}
            <div className="flex flex-wrap gap-2 mb-8 border-b border-slate-200 pb-4">
              {features.map((feature, index) => (
                <button
                  key={feature.id}
                  onClick={() => setActiveFeature(index)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    activeFeature === index 
                      ? "bg-amber-500 text-white shadow-lg shadow-amber-500/25" 
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {feature.title}
                </button>
              ))}
            </div>

            {/* Active Feature Display */}
            <div className="grid lg:grid-cols-2 gap-12 items-start">
              <div 
                className="relative aspect-video bg-slate-200 rounded-2xl overflow-hidden shadow-xl cursor-pointer group"
                onClick={() => setLightboxImage(features[activeFeature].image)}
              >
                <Image
                  src={features[activeFeature].image}
                  alt={features[activeFeature].title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-medium text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                  Click to expand
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-6">{features[activeFeature].title}</h3>
                <div className="space-y-6">
                  <div className="bg-stone-50 rounded-xl p-6 border border-stone-200">
                    <h4 className="text-sm font-semibold text-amber-600 uppercase tracking-wide mb-3">What it is</h4>
                    <p className="text-slate-600 leading-relaxed">{features[activeFeature].whatItIs}</p>
                  </div>
                  <div className="bg-stone-50 rounded-xl p-6 border border-stone-200">
                    <h4 className="text-sm font-semibold text-amber-600 uppercase tracking-wide mb-3">Why it matters for you</h4>
                    <p className="text-slate-600 leading-relaxed">{features[activeFeature].whyItMatters}</p>
                  </div>
                </div>
                <div className="mt-6 flex gap-2">
                  <button 
                    onClick={() => setActiveFeature(prev => prev > 0 ? prev - 1 : features.length - 1)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                  >
                    Previous
                  </button>
                  <button 
                    onClick={() => setActiveFeature(prev => prev < features.length - 1 ? prev + 1 : 0)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* WHY SMARTBRIDGE IS DIFFERENT - ACCORDION */}
        <section className="py-20 lg:py-28 bg-gradient-to-b from-stone-100 to-white">
          <div className="container mx-auto px-6 max-w-3xl">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-12 text-center">Why SmartBridge Is Different</h2>
            <div className="space-y-4">
              {differentiators.map((item, index) => (
                <div 
                  key={index}
                  className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <button
                    onClick={() => setExpandedDiff(expandedDiff === index ? null : index)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left"
                  >
                    <span className="font-semibold text-slate-900">{item.title}</span>
                    <ChevronRight 
                      className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${
                        expandedDiff === index ? "rotate-90" : ""
                      }`} 
                    />
                  </button>
                  <div 
                    className={`overflow-hidden transition-all duration-300 ${
                      expandedDiff === index ? "max-h-40 pb-5" : "max-h-0"
                    }`}
                  >
                    <p className="px-6 text-slate-600 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CREATIVE FLOW */}
        <section className="py-20 lg:py-28 bg-white">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">A Connected Creative Flow</h2>
              <p className="text-lg text-slate-500">SmartBridge helps you move from a musical idea to a fuller arrangement without jumping between disconnected tools</p>
            </div>

            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div className="space-y-0">
                {[
                  { step: 1, title: "Start with a progression or song section", desc: "Choose from curated chord progressions or create your own foundation" },
                  { step: 2, title: "Explore phrases, riffs, solos, and arrangement layers", desc: "Generate and audition musical ideas that fit your progression" },
                  { step: 3, title: "Add lyrics, vocals, and harmonization", desc: "Build out full arrangements with complete musical layers" },
                  { step: 4, title: "Export into the DAW", desc: "Move your complete arrangements directly into production" }
                ].map((item, index) => (
                  <div key={item.step} className="flex gap-6 group">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-lg shadow-lg shadow-amber-500/25 group-hover:scale-110 transition-transform">
                        {item.step}
                      </div>
                      {index < 3 && <div className="w-0.5 h-16 bg-gradient-to-b from-amber-500 to-amber-200" />}
                    </div>
                    <div className="pb-8">
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">{item.title}</h3>
                      <p className="text-slate-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div 
                className="relative aspect-[4/3] bg-slate-200 rounded-2xl overflow-hidden shadow-xl cursor-pointer group"
                onClick={() => setLightboxImage("/images/riff_maker.jpeg")}
              >
                <Image
                  src="/images/riff_maker.jpeg"
                  alt="Creative Flow"
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </div>
            </div>
          </div>
        </section>

        {/* SUPPORTING FEATURES */}
        <section className="py-20 lg:py-28 bg-stone-50">
          <div className="container mx-auto px-6 max-w-6xl">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-12">Advanced Workflow</h2>

            <div className="grid md:grid-cols-3 gap-8">
              {supportingFeatures.map((feature, index) => (
                <div 
                  key={index}
                  className="bg-white rounded-xl overflow-hidden border border-stone-200 shadow-sm hover:shadow-lg transition-all duration-300 group"
                >
                  <div 
                    className="relative aspect-video bg-slate-200 overflow-hidden cursor-pointer"
                    onClick={() => setLightboxImage(feature.image)}
                  >
                    <Image
                      src={feature.image}
                      alt={feature.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">{feature.title}</h3>
                    <div className="space-y-3 text-sm">
                      <p className="text-slate-600"><span className="font-medium text-slate-700">What it is:</span> {feature.whatItIs}</p>
                      <p className="text-slate-600"><span className="font-medium text-slate-700">Why it matters:</span> {feature.whyItMatters}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SCREENSHOT GALLERY */}
        <section className="py-20 lg:py-28 bg-white">
          <div className="container mx-auto px-6 max-w-6xl">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-12">More Screens from SmartBridge</h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {galleryImages.map((img, index) => (
                <div 
                  key={index}
                  className="group cursor-pointer"
                  onClick={() => setLightboxImage(img.src)}
                >
                  <div className="relative aspect-video bg-slate-200 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300">
                    <Image
                      src={img.src}
                      alt={img.caption}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  </div>
                  <p className="mt-3 text-sm text-slate-500 text-center">{img.caption}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="py-20 lg:py-28 bg-gradient-to-b from-stone-100 to-stone-200">
          <div className="container mx-auto px-6 max-w-3xl text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 text-balance">
              From keyboard control to full arrangement workflow
            </h2>
            <p className="text-lg text-slate-600 mb-10 leading-relaxed">
              SmartBridge brings together Yamaha integration, phrase-based creativity, harmonization, lyrics, and vocal workflow in one connected system.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a 
                href="#features" 
                className="inline-flex items-center gap-2 px-8 py-4 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-all hover:shadow-lg hover:shadow-amber-500/25"
              >
                Explore SmartBridge
                <ArrowRight className="w-4 h-4" />
              </a>
              <button className="px-8 py-4 border-2 border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-white font-medium rounded-lg transition-all">
                Request Access
              </button>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* LIGHTBOX */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 md:p-8 cursor-zoom-out"
          onClick={() => setLightboxImage(null)}
        >
          <button 
            className="absolute top-6 right-6 text-white/80 hover:text-white transition-colors"
            onClick={() => setLightboxImage(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <div className="relative w-full max-w-5xl aspect-video">
            <Image
              src={lightboxImage}
              alt="Expanded view"
              fill
              className="object-contain"
            />
          </div>
        </div>
      )}
    </div>
  )
}
