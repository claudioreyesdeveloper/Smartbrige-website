import { Music, Sliders, Library, Wand2, Laptop, Heart, Download } from "lucide-react"
import Image from "next/image"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <div className="min-h-screen bg-[#faf9f6] text-slate-800 font-sans selection:bg-amber-100">
      <Header />

      <main className="pt-24 pb-20">
        {/* Hero Section */}
        <section className="container mx-auto px-6 max-w-4xl mb-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-sm font-medium mb-6 border border-amber-100">
            <Heart className="w-3 h-3 fill-current" />
            <span>Made with passion, not for profit</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 mb-6 leading-tight">
            SmartBridge — A Personal Creative Companion for Keyboard Players
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
            A three-month project built by one musician for personal inspiration. Not a startup, just a tool for
            creativity.
          </p>
        </section>

        {/* About the Creator */}
        <section className="container mx-auto px-6 max-w-4xl mb-32">
          <div className="bg-white rounded-2xl p-8 md:p-12 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-10 items-center">
            <div className="w-32 h-32 md:w-40 md:h-40 shrink-0 rounded-full overflow-hidden border-4 border-amber-50 shadow-inner bg-slate-100 relative">
              <Image src="/images/claudio.jpeg" alt="Claudio" fill className="object-cover" />
            </div>
            <div className="space-y-4 text-center md:text-left">
              <h2 className="text-2xl font-bold text-slate-900">Hi, I'm Claudio.</h2>
              <div className="space-y-4 text-slate-600 leading-relaxed">
                <p>
                  I built SmartBridge completely alone over the last three months. I'm not a software company or a
                  startup—I'm just a musician who loves coding.
                </p>
                <p>
                  This project started as a personal tool to explore sounds, chords, and Yamaha mixer control in a way
                  that felt right to me. It grew naturally out of my own curiosity and musical needs.
                </p>
                <p>
                  I'm sharing it now because I think other keyboard players might find the same value and inspiration in
                  it that I have.
                </p>
                <p className="pt-2 border-t border-slate-200">
                  If you're interested in SmartBridge, feel free to contact me at{" "}
                  <a href="mailto:claudio.private@gmail.com" className="text-amber-600 hover:text-amber-700 underline">
                    claudio.private@gmail.com
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* What is SmartBridge? */}
        <section className="container mx-auto px-6 max-w-5xl mb-32">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">What is SmartBridge?</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              A musician-friendly creative environment combining a Yamaha mixer, chord and jam tools, and DAW export —
              designed to spark musical ideas without technical friction.
            </p>
          </div>

          <div className="relative aspect-video bg-slate-100 rounded-xl overflow-hidden shadow-lg border border-slate-200">
            <Image src="/images/main.png" alt="SmartBridge Main Interface" fill className="object-cover" />
          </div>
        </section>

        {/* Feature Sections */}
        <div className="space-y-32 container mx-auto px-6 max-w-5xl">
          {/* SmartBridge Mixer */}
          <section className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                  <Sliders className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">SmartBridge Mixer</h3>
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-2">What it is</h4>
                  <p className="text-slate-600">
                    A full 32-channel mixer built specifically for Yamaha-style keyboards.
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-2">Why it matters</h4>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      Full control of drums, bass, chords, pads, right-hand voices, and more
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      Everything stays synchronized with the keyboard
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      Works standalone or as VST/AU plugin
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      Import Cubase patch files for exact models and expansions
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      Instant patch search with autocomplete
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      Voice Copier keeps original insert FX
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      Save/load complete mixes
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2 relative aspect-[4/3] bg-slate-100 rounded-xl overflow-hidden shadow-md border border-slate-200">
              <Image src="/images/mixer.png" alt="SmartBridge Mixer" fill className="object-cover" />
            </div>
          </section>

          <section className="grid md:grid-cols-3 gap-8 mt-16">
            {/* DSP Effects */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <div className="relative aspect-[4/3] bg-slate-100 rounded-lg overflow-hidden mb-4">
                <Image src="/images/dsp.png" alt="DSP Effects Panel" fill className="object-cover" />
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">DSP Effects</h4>
              <p className="text-slate-600 text-sm">In the mixer you can control all of the DSP effects.</p>
            </div>

            {/* Menu Picker */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <div className="relative aspect-[4/3] bg-slate-100 rounded-lg overflow-hidden mb-4">
                <Image src="/images/menupicker.png" alt="Voice Menu Picker" fill className="object-cover" />
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Menu Picker</h4>
              <p className="text-slate-600 text-sm">
                In the mixer you can quickly pick your voice and all of the premium packs you have installed.
              </p>
            </div>

            {/* Search */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <div className="relative aspect-[4/3] bg-slate-100 rounded-lg overflow-hidden mb-4">
                <Image src="/images/search.png" alt="Voice Search with Autocomplete" fill className="object-cover" />
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Search</h4>
              <p className="text-slate-600 text-sm">You can search, with autocomplete, all of the voices.</p>
            </div>
          </section>

          {/* Jam Session */}
          <section className="grid md:grid-cols-2 gap-12 items-center">
            <div className="relative aspect-[4/3] bg-slate-100 rounded-xl overflow-hidden shadow-md border border-slate-200">
              <Image src="/images/jam-20session.png" alt="Jam Session" fill className="object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                  <Music className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Jam Session</h3>
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-2">What it is</h4>
                  <p className="text-slate-600">A flexible chord-clip looper with no hardware limitations.</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-2">Why it matters</h4>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 mt-1">•</span>
                      Unlimited clips
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 mt-1">•</span>
                      Build intros, verses, choruses, and bridges
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 mt-1">•</span>
                      Experiment freely with musical structures
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 mt-1">•</span>
                      Loop any part while playing over it
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 mt-1">•</span>
                      Great for songwriting, improvisation, and idea development
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 mt-1">•</span>
                      Input by playing chords with a style and the software extracts the chords automatically
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Jam Player */}
          <section className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                  <Library className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Jam Player</h3>
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-2">What it is</h4>
                  <p className="text-slate-600">
                    A jam environment based on a large library of ready-made chord progressions.
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-2">Why it matters</h4>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">•</span>
                      Instant inspiration
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">•</span>
                      Helps generate melodies and riffs
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">•</span>
                      Great for practice or warm-ups
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">•</span>
                      Perfect starting point when you feel stuck
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">•</span>
                      The categories correspond to the categories in PSR, Tyros and Genos
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">•</span>
                      The library contains about 300 songs and clips that work well together
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2 relative aspect-[4/3] bg-slate-100 rounded-xl overflow-hidden shadow-md border border-slate-200">
              <Image src="/images/jamplayer.png" alt="Jam Player" fill className="object-cover" />
            </div>
          </section>

          {/* Chord Builder */}
          <section className="grid md:grid-cols-2 gap-12 items-center">
            <div className="relative aspect-[4/3] bg-slate-100 rounded-xl overflow-hidden shadow-md border border-slate-200">
              <div className="absolute inset-0 flex items-center justify-center bg-slate-50/50 group-hover:bg-transparent transition-colors">
                <span className="bg-white/80 backdrop-blur px-4 py-2 rounded-full text-sm font-medium text-slate-500 border border-slate-200 shadow-sm">
                  Chord Builder Prototype
                </span>
              </div>
              <Image
                src="/music-theory-chords-circle-of-fifths-interface.jpg"
                alt="Chord Builder"
                fill
                className="object-cover opacity-90"
              />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                  <Wand2 className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">
                  Chord Builder <span className="text-sm font-normal text-slate-500 ml-2">(Work in Progress)</span>
                </h3>
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-2">What it is</h4>
                  <p className="text-slate-600">
                    A developing tool for building chord progressions in an intuitive, musical way. Choose a style, key,
                    and mood — SmartBridge suggests chords that fit.
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-2">Why it matters</h4>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 mt-1">•</span>
                      Helps spark chord ideas without theory
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 mt-1">•</span>
                      Offers harmonic variations to explore
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 mt-1">•</span>
                      Works with Jam Session and DAW Export
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 mt-1">•</span>
                      Still evolving — currently a prototype, not a finished system
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* DAW Export */}
          <section className="container mx-auto px-6 max-w-4xl mb-24">
            <div className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-amber-100 rounded-xl">
                  <Download className="w-6 h-6 text-amber-700" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900">DAW Export</h2>
              </div>
              <p className="text-lg text-slate-600 leading-relaxed">
                When you're done building your session, drag it straight into your DAW timeline. Your chords, clips, and
                settings transfer seamlessly, letting you keep working without interruption.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <img src="/images/jamplayer.png" alt="DAW Export Interface" className="w-full h-auto" />
            </div>
          </section>

          {/* Standalone + Plugin Support */}
          <section className="bg-slate-50 rounded-2xl p-8 md:p-12 border border-slate-100 text-center">
            <div className="inline-flex p-3 bg-white rounded-xl shadow-sm mb-6 text-slate-700">
              <Laptop className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-4">Standalone + Plugin Support</h3>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
              SmartBridge runs as a standalone app for jamming or as a VST/AU plugin inside a DAW.
            </p>
            <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto text-left">
              <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                <h4 className="font-semibold text-slate-900 mb-2">Jam Anywhere</h4>
                <p className="text-sm text-slate-600">Jam without opening a DAW for quick inspiration.</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                <h4 className="font-semibold text-slate-900 mb-2">Inside Your DAW</h4>
                <p className="text-sm text-slate-600">Use SmartBridge as a mixer and creative tool inside your DAW.</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                <h4 className="font-semibold text-slate-900 mb-2">Flexible Workflow</h4>
                <p className="text-sm text-slate-600">Adaptable workflows for different musicians and setups.</p>
              </div>
            </div>
          </section>
        </div>

        {/* How Everything Works Together */}
        <section className="container mx-auto px-6 max-w-4xl mt-32 mb-32">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">The SmartBridge Experience</h2>
            <p className="text-lg text-slate-600">How everything works together to help you create.</p>
          </div>

          <div className="relative">
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-200 -translate-x-1/2 hidden md:block"></div>

            <div className="space-y-12 relative">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1 md:text-right">
                  <h3 className="text-xl font-bold text-slate-900 mb-2">1. Discover Ideas</h3>
                  <p className="text-slate-600">
                    Start with Jam Player and Chord Builder to find that initial spark of inspiration.
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-white border-4 border-amber-100 flex items-center justify-center shrink-0 z-10 shadow-sm text-amber-600 font-bold">
                  1
                </div>
                <div className="flex-1"></div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1 hidden md:block"></div>
                <div className="w-12 h-12 rounded-full bg-white border-4 border-amber-100 flex items-center justify-center shrink-0 z-10 shadow-sm text-amber-600 font-bold">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-900 mb-2">2. Create Music</h3>
                  <p className="text-slate-600">
                    Build your structure in Jam Session with flexible chords and sections.
                  </p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1 md:text-right">
                  <h3 className="text-xl font-bold text-slate-900 mb-2">3. Shape the Sound</h3>
                  <p className="text-slate-600">
                    Refine your mix using the SmartBridge Mixer with full Yamaha control.
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-white border-4 border-amber-100 flex items-center justify-center shrink-0 z-10 shadow-sm text-amber-600 font-bold">
                  3
                </div>
                <div className="flex-1"></div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1 hidden md:block"></div>
                <div className="w-12 h-12 rounded-full bg-white border-4 border-amber-100 flex items-center justify-center shrink-0 z-10 shadow-sm text-amber-600 font-bold">
                  4
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-900 mb-2">4. Export to DAW</h3>
                  <p className="text-slate-600">Send everything to your DAW to finish as a professional production.</p>
                </div>
              </div>
            </div>

            <div className="mt-16 text-center">
              <div className="inline-block px-6 py-3 bg-slate-900 text-white rounded-full font-medium shadow-lg">
                Discovery → Creativity → Sound → Arrangement → Production
              </div>
            </div>
          </div>
        </section>

        {/* Why I Built This & Future */}
        <section className="container mx-auto px-6 max-w-3xl mb-32 space-y-16">
          <div className="bg-amber-50/50 rounded-2xl p-8 md:p-12 border border-amber-100">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Why I Built This</h2>
            <p className="text-slate-700 leading-relaxed">
              I built SmartBridge because I wanted a creative tool that went beyond hardware menus. I wanted something
              that felt like an instrument itself, not just a utility. Sharing it with others comes from a place of
              inspiration rather than commercial ambition—I just want to see what others can create with it.
            </p>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Future Directions</h2>
            <p className="text-slate-600 mb-8">
              A gentle, non-promising roadmap. This is a passion project evolving naturally.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <span className="px-4 py-2 bg-white border border-slate-200 rounded-full text-slate-600 text-sm">
                More Jam Session features
              </span>
              <span className="px-4 py-2 bg-white border border-slate-200 rounded-full text-slate-600 text-sm">
                Expanded mixer options
              </span>
              <span className="px-4 py-2 bg-white border border-slate-200 rounded-full text-slate-600 text-sm">
                No fixed schedule
              </span>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
