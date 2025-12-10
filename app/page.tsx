import { Music, Sliders, Library, Laptop, Heart, Download, Play, Database, Zap, FileMusic } from "lucide-react"
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
            <span>A Personal Creative Tool</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 mb-6 leading-tight">
            SmartBridge
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
            A personal creative tool designed for keyboard players who want a more inspiring musical workflow.
          </p>
        </section>

        {/* Origin Story */}
        <section className="container mx-auto px-6 max-w-4xl mb-32">
          <div className="prose prose-lg max-w-none text-slate-600 space-y-6">
            <p className="text-lg leading-relaxed">
              SmartBridge was created by a single musician who wanted something that felt natural, intuitive, and
              musical rather than technical. It did not begin as a commercial idea or a software product. It grew out of
              a musician's desire to explore the full richness of content that the Tyros and Motif have, but which is
              often locked behind technical barriers.
            </p>
            <p className="text-lg leading-relaxed">
              The decision to share it with others comes from the simple hope that fellow musicians might find the same
              spark of inspiration in it.
            </p>
          </div>
        </section>

        {/* About the Creator */}
        <section className="container mx-auto px-6 max-w-4xl mb-32">
          <div className="bg-white rounded-2xl p-8 md:p-12 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-10 items-center">
            <div className="w-40 h-40 md:w-48 md:h-48 shrink-0 rounded-full overflow-hidden border-4 border-amber-50 shadow-inner bg-slate-100 relative">
              <Image src="/images/claudio.jpeg" alt="Claudio" fill className="object-cover" />
            </div>
            <div className="space-y-4 text-center md:text-left">
              <div className="space-y-4 text-slate-600 leading-relaxed">
                <p>
                  This project started as a personal tool to explore sounds, chords, and Yamaha mixer control in a way
                  that felt right. It grew naturally out of curiosity and musical needs.
                </p>
                <p>
                  I'm sharing it now because I think other keyboard players might find the same value and inspiration in
                  it that I have.
                </p>
                <p className="pt-4 border-t border-slate-200">
                  If you're interested in SmartBridge, feel free to contact me at{" "}
                  <a
                    href="mailto:claudio.private@gmail.com"
                    className="text-amber-600 hover:text-amber-700 underline font-medium"
                  >
                    claudio.private@gmail.com
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Overview - What is SmartBridge */}
        <section className="container mx-auto px-6 max-w-5xl mb-32">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">Overview</h2>
            <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
              SmartBridge combines a Yamaha-focused mixer, chord tools, jam environments, and DAW export features into a
              coherent creative ecosystem. It aims to remove friction from the creative process and make experimentation
              enjoyable and immediate.
            </p>
          </div>

          <div className="relative aspect-video bg-slate-100 rounded-xl overflow-hidden shadow-lg border border-slate-200">
            <Image src="/images/main.png" alt="SmartBridge Main Interface" fill className="object-cover" />
          </div>
        </section>

        {/* The Core Foundation */}
        <section className="container mx-auto px-6 max-w-4xl mb-32">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-8 md:p-12 border border-amber-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <Database className="w-6 h-6 text-amber-600" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900">The Core of SmartBridge</h2>
            </div>
            <div className="space-y-4 text-slate-700 leading-relaxed">
              <p>
                At its foundation lies a large musical database: more than 700 chord progressions stored as songs, each
                categorized by musical sections (intro, verse, pre-chorus, chorus, bridge, etc.) and stylistic families
                such as rock, soul, and ballads.
              </p>
              <p>
                These progressions are intentionally curated so they fit together and provide rich harmonic variations
                suitable for each genre. This database powers Jam Player, Jam Session, and multiple creative workflows.
              </p>
            </div>
          </div>
        </section>

        {/* Two Main Workflows */}
        <section className="container mx-auto px-6 max-w-5xl mb-32">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Two Main Musical Workflows</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              SmartBridge supports two primary creative approaches, each designed for different musical needs.
            </p>
          </div>

          {/* Workflow One */}
          <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium mb-4">
                Workflow One
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Improvisation & Exploration</h3>
              <p className="text-slate-600 leading-relaxed mb-6">
                Playing through chord progressions using Jam Player while improvising. The clear chord timeline enables
                effortless following and musical exploration.
              </p>
              <ul className="space-y-3 text-slate-600">
                <li className="flex items-start gap-2">
                  <Play className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <span>Browse and audition chord progressions instantly</span>
                </li>
                <li className="flex items-start gap-2">
                  <Play className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <span>Follow the timeline for effortless improvisation</span>
                </li>
                <li className="flex items-start gap-2">
                  <Play className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <span>Generate melodies and musical ideas on the fly</span>
                </li>
              </ul>
            </div>
            <div className="relative aspect-[4/3] bg-slate-100 rounded-xl overflow-hidden shadow-lg border border-blue-200">
              <Image
                src="/images/jamming-musician.jpg"
                alt="Musician improvising with keyboard"
                fill
                className="object-cover"
              />
            </div>
          </div>

          {/* Workflow Two */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="relative aspect-[4/3] bg-slate-100 rounded-xl overflow-hidden shadow-lg border border-purple-200 order-2 md:order-1">
              <Image
                src="/images/studio-musician.jpg"
                alt="Musician recording in home studio"
                fill
                className="object-cover"
              />
            </div>
            <div className="order-1 md:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-sm font-medium mb-4">
                Workflow Two
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Recording & Production</h3>
              <p className="text-slate-600 leading-relaxed mb-6">
                Creating a mock-up by recording a performance section. SmartBridge captures keyboard MIDI (Tyros
                channels 9–16, Motif channels 1–4) and stores it internally, allowing the musician to drag the recorded
                material directly into a DAW for immediate production work.
              </p>
              <ul className="space-y-3 text-slate-600">
                <li className="flex items-start gap-2">
                  <FileMusic className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                  <span>Record complete performances with full MIDI data</span>
                </li>
                <li className="flex items-start gap-2">
                  <FileMusic className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                  <span>Drag and drop directly into your DAW timeline</span>
                </li>
                <li className="flex items-start gap-2">
                  <FileMusic className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                  <span>Seamless transition from idea to production</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Motif Creative Tools */}
        <section className="container mx-auto px-6 max-w-4xl mb-32">
          <div className="bg-white rounded-2xl p-8 md:p-12 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-emerald-50 rounded-xl">
                <Zap className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900">Creative Tools for Motif Arpeggios</h3>
            </div>
            <div className="space-y-6 text-slate-600 leading-relaxed">
              <p>Beyond these workflows, SmartBridge includes creative tools for working with Motif arpeggios.</p>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                  <h4 className="font-semibold text-slate-900 mb-2">Beat Maker</h4>
                  <p className="text-sm">
                    Allows auditioning and recording drum arps, then dragging them directly into the DAW timeline.
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                  <h4 className="font-semibold text-slate-900 mb-2">Riff Maker</h4>
                  <p className="text-sm">
                    Lets you set specific chords for each bar of a multi-bar arp (for example, a four-bar bass arp),
                    audition it, record it, and transfer it straight into the DAW.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 relative aspect-video bg-slate-100 rounded-xl overflow-hidden shadow-lg border border-slate-200">
            <Image src="/images/yamaha-motif.jpg" alt="Yamaha Motif synthesizer" fill className="object-cover" />
          </div>
        </section>

        {/* SmartBridge Mixer Module */}
        <section className="container mx-auto px-6 max-w-5xl mb-32">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">The SmartBridge Mixer</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Full control of your Yamaha keyboard, perfectly synchronized and musician-friendly.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center mb-12">
            <div className="space-y-6">
              <p className="text-slate-600 leading-relaxed">
                SmartBridge offers a full 32-channel mixer for Yamaha Tyros-style keyboards. This mixer provides
                bi-directional control so UI changes appear on the keyboard and keyboard changes appear in the UI.
              </p>
              <ul className="space-y-3 text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span>Voice selection through dropdown menus or autocomplete search</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span>Cubase patch import for exact models and expansions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span>Voice Copier that automatically preserves original insert effects</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span>Control of drums, bass, chord parts, pads, melody voices, and accompaniment channels</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span>Everything stays perfectly synchronized with the keyboard</span>
                </li>
              </ul>
            </div>
            <div className="relative aspect-[4/3] bg-slate-100 rounded-xl overflow-hidden shadow-lg border border-slate-200">
              <Image src="/images/mixer.png" alt="SmartBridge Mixer" fill className="object-cover" />
            </div>
          </div>

          {/* DSP Manager, Menu Picker, Search */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <div className="relative aspect-[4/3] bg-slate-100 rounded-lg overflow-hidden mb-4">
                <Image src="/images/dsp.png" alt="DSP Effects Manager" fill className="object-cover" />
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">DSP Manager</h4>
              <p className="text-slate-600 text-sm leading-relaxed">
                Detailed control of insert effects. Assign effect types to DSP blocks and channels. SmartBridge
                automatically applies the correct insert effects when a voice requires them. This behavior is also
                bi-directional.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <div className="relative aspect-[4/3] bg-slate-100 rounded-lg overflow-hidden mb-4">
                <Image src="/images/menupicker.png" alt="Voice Menu Picker" fill className="object-cover" />
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Voice Selection</h4>
              <p className="text-slate-600 text-sm leading-relaxed">
                Quickly pick voices from all available packs including premium packs you have installed. Navigate
                through familiar categories that match your keyboard's organization.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <div className="relative aspect-[4/3] bg-slate-100 rounded-lg overflow-hidden mb-4">
                <Image src="/images/search.png" alt="Voice Search with Autocomplete" fill className="object-cover" />
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Smart Search</h4>
              <p className="text-slate-600 text-sm leading-relaxed">
                Search all voices with autocomplete functionality. Find exactly what you need instantly without
                navigating through menus.
              </p>
            </div>
          </div>

          <div className="mt-12 bg-slate-50 rounded-xl p-6 border border-slate-100">
            <h4 className="font-semibold text-slate-900 mb-3">Motif Mixer</h4>
            <p className="text-slate-600 text-sm leading-relaxed">
              For Motif users, SmartBridge includes a streamlined mixer focused on ARPs and voices. It enables fast
              voice swapping and arp filtering while keeping complexity out of the way. While deep programming is
              available through official editors, SmartBridge focuses on speed and musical flow.
            </p>
          </div>
        </section>

        {/* Jam Session Module */}
        <section className="container mx-auto px-6 max-w-5xl mb-32">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="relative aspect-[4/3] bg-slate-100 rounded-xl overflow-hidden shadow-lg border border-slate-200">
              <Image src="/images/jam-20session.png" alt="Jam Session" fill className="object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-amber-50 rounded-xl">
                  <Music className="w-6 h-6 text-amber-600" />
                </div>
                <h3 className="text-3xl font-bold text-slate-900">Jam Session</h3>
              </div>
              <p className="text-slate-600 leading-relaxed mb-6">
                A flexible chord-clip looper with no hardware limitations. It supports unlimited clips, custom song
                sections, looping, improvisation, songwriting, and experimentation with musical structure.
              </p>
              <ul className="space-y-3 text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-1">•</span>
                  <span>Unlimited clips</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-1">•</span>
                  <span>Build intros, verses, choruses, and bridges</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-1">•</span>
                  <span>Loop any part while playing over it</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-1">•</span>
                  <span>Chords can be automatically extracted from played input or edited manually</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-1">•</span>
                  <span>Chord editor supports advanced harmony, tensions, and slash chords</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Jam Player Module */}
        <section className="container mx-auto px-6 max-w-5xl mb-32">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-emerald-50 rounded-xl">
                  <Library className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-3xl font-bold text-slate-900">Jam Player</h3>
              </div>
              <p className="text-slate-600 leading-relaxed mb-6">
                Provides a library of approximately 300 ready-made chord progressions. These progressions are
                categorized in the same way as PSR, Tyros, and Genos instruments, making them immediately familiar and
                practical.
              </p>
              <ul className="space-y-3 text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">•</span>
                  <span>Quick inspiration and warm-ups</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">•</span>
                  <span>Melody creation and practice sessions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">•</span>
                  <span>Tempo sync can follow the keyboard (Keyboard Master) or SmartBridge (SmartBridge Master)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">•</span>
                  <span>Transpose freely and choose which MIDI channel drives the chord progression</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">•</span>
                  <span>Timeline uses A–D Style parts on Tyros and arp parts 1–5 on Motif</span>
                </li>
              </ul>
            </div>
            <div className="order-1 md:order-2 relative aspect-[4/3] bg-slate-100 rounded-xl overflow-hidden shadow-lg border border-slate-200">
              <Image src="/images/jamplayer.png" alt="Jam Player" fill className="object-cover" />
            </div>
          </div>
        </section>

        {/* Standalone + Plugin */}
        <section className="container mx-auto px-6 max-w-4xl mb-32">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 md:p-12 border border-blue-100">
            <div className="text-center mb-8">
              <div className="inline-flex p-3 bg-white rounded-xl shadow-sm mb-4">
                <Laptop className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Standalone + Plugin</h3>
              <p className="text-slate-600 leading-relaxed max-w-2xl mx-auto">
                SmartBridge can run as a standalone application or as a VST/AU plugin inside a DAW. Standalone mode is
                ideal for spontaneous jamming and quick inspiration. Plugin mode allows SmartBridge to operate as a
                creative engine inside a DAW workflow, enabling a tight connection between musical exploration and
                production tools.
              </p>
            </div>
          </div>
        </section>

        {/* Creative Flow */}
        <section className="container mx-auto px-6 max-w-5xl mb-32">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">The Creative Flow</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">Four stages from inspiration to production</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Step 1 */}
            <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-100 relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center font-bold text-lg shadow-lg">
                1
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-50 rounded-lg">
                  <Music className="w-5 h-5 text-amber-600" />
                </div>
                <h4 className="text-xl font-semibold text-slate-900">Create Structure</h4>
              </div>
              <p className="text-slate-600">
                Use Jam Session to build your musical structure with unlimited clips and sections.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-100 relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center font-bold text-lg shadow-lg">
                2
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <Library className="w-5 h-5 text-emerald-600" />
                </div>
                <h4 className="text-xl font-semibold text-slate-900">Discover Ideas</h4>
              </div>
              <p className="text-slate-600">
                Browse Jam Player's library of 300+ progressions for instant inspiration.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-100 relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-white flex items-center justify-center font-bold text-lg shadow-lg">
                3
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Sliders className="w-5 h-5 text-blue-600" />
                </div>
                <h4 className="text-xl font-semibold text-slate-900">Shape Sound</h4>
              </div>
              <p className="text-slate-600">Use the Mixer and DSP controls to craft the perfect sonic palette.</p>
            </div>

            {/* Step 4 */}
            <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-100 relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 text-white flex items-center justify-center font-bold text-lg shadow-lg">
                4
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <Download className="w-5 h-5 text-purple-600" />
                </div>
                <h4 className="text-xl font-semibold text-slate-900">Export to DAW</h4>
              </div>
              <p className="text-slate-600">
                Drag everything into your DAW to complete the arrangement and production.
              </p>
            </div>
          </div>
        </section>

        {/* Philosophy */}
        <section className="container mx-auto px-6 max-w-4xl mb-32">
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-8 md:p-12 border border-slate-200 text-center">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">Philosophy</h2>
            <p className="text-lg text-slate-700 leading-relaxed max-w-2xl mx-auto">
              The philosophy behind SmartBridge is rooted in musical curiosity. Instead of navigating hardware menus and
              technical layers, the musician can focus directly on creativity—finding progressions, shaping sound,
              experimenting with structure, and refining inspiration.
            </p>
          </div>
        </section>

        {/* Technical Notes */}
        <section className="container mx-auto px-6 max-w-4xl mb-32">
          <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">Technical Notes</h2>
          <div className="bg-white rounded-2xl p-8 md:p-10 shadow-sm border border-slate-100 space-y-6 text-slate-600 leading-relaxed">
            <div>
              <h4 className="font-semibold text-slate-900 mb-2">Data Storage</h4>
              <p>SmartBridge stores content in a local database.</p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-2">Voice Imports</h4>
              <p>
                Voice imports for PSR, Tyros, and Genos rely on Yamaha Cubase script patch files. Motif imports require
                a CSV file containing voices, arps, and multis in a specific format.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-2">Compatibility</h4>
              <p>Designed specifically for Yamaha PSR, Tyros, Genos, and Motif keyboards.</p>
            </div>
          </div>
        </section>

        {/* Future Direction */}
        <section className="container mx-auto px-6 max-w-4xl mb-32">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-8 md:p-12 border border-amber-100 text-center">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">Future Direction</h2>
            <p className="text-lg text-slate-700 leading-relaxed max-w-2xl mx-auto">
              SmartBridge is a personal passion project with an open-ended, gentle roadmap. It will evolve naturally
              over time, without fixed schedules, as ideas and inspiration emerge. Future plans include deeper Jam
              Session functionality and expanded mixer capabilities.
            </p>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="container mx-auto px-6 max-w-4xl mb-20">
          <p className="text-center text-sm text-slate-500">SmartBridge is not affiliated with Yamaha Corporation.</p>
        </section>
      </main>

      <Footer />
    </div>
  )
}
