import Image from "next/image"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <Header />

      <main className="pt-20 pb-20">
        {/* HERO SECTION */}
        <section className="container mx-auto px-6 max-w-6xl mb-32">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                From MIDI Phrase to Full Arrangement
              </h1>
              <p className="text-lg text-slate-300 leading-relaxed mb-8">
                SmartBridge combines Yamaha keyboard control, phrase-driven songwriting, harmonization for brass, strings, and vocals, lyrics generation, Synthesizer V workflow, and direct DAW export in one connected system.
              </p>
              <p className="text-base text-slate-400 leading-relaxed mb-8">
                Instead of working with isolated MIDI clips, SmartBridge helps you build full arrangements with chord-aware phrases, vocal ideas, harmonization layers, and hardware-to-DAW workflow.
              </p>
              <div className="flex flex-wrap gap-4">
                <button className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold rounded-lg transition">
                  See Features
                </button>
                <button className="px-6 py-3 border border-slate-400 text-slate-100 hover:bg-slate-800 font-semibold rounded-lg transition">
                  Watch Demo
                </button>
              </div>
            </div>
            <div className="relative aspect-video bg-slate-800 rounded-xl overflow-hidden shadow-2xl border border-slate-700">
              <Image
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/jam_player_tyros-IG8pDsx54QdktB69HhD9K9olJy3cBx.jpeg"
                alt="Jam Player Tyros"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </section>

        {/* CORE FEATURES SECTION */}
        <section className="container mx-auto px-6 max-w-6xl mb-32">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Core Features</h2>
            <p className="text-lg text-slate-400">Eight integrated modules for complete creative control</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Feature 1: Tyros Mixer */}
            <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700 hover:border-slate-600 transition">
              <div className="relative aspect-video bg-slate-800 overflow-hidden">
                <Image
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/tyros_mixer-iMzSg6fkuzEAO1UXYSoAW1CacMdFYZ.jpeg"
                  alt="Tyros Mixer"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-white mb-3">Tyros Mixer</h3>
                <p className="text-slate-300">A full computer-based mixer workflow for Yamaha Tyros. Control channel levels, pan, voices, sends, and arrangement-related settings from one screen.</p>
              </div>
            </div>

            {/* Feature 2: Motif Mixer */}
            <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700 hover:border-slate-600 transition">
              <div className="relative aspect-video bg-slate-800 overflow-hidden">
                <Image
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/motif_mixer-Gw1Cy2G2PFNJYS94PKPIG23KQq2RRe.jpeg"
                  alt="Motif Mixer"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-white mb-3">Motif Mixer</h3>
                <p className="text-slate-300">A dedicated mixer and control surface for Yamaha Motif integration. Manage Motif parts and sound layers visually while staying connected to SmartBridge and your DAW.</p>
              </div>
            </div>

            {/* Feature 3: Jam Player */}
            <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700 hover:border-slate-600 transition">
              <div className="relative aspect-video bg-slate-800 overflow-hidden">
                <Image
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/jam_player_tyros-IG8pDsx54QdktB69HhD9K9olJy3cBx.jpeg"
                  alt="Jam Player"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-white mb-3">Jam Player</h3>
                <p className="text-slate-300">Work with song sections, chord progressions, and musical ideas in context. A central place for exploring phrases, arrangement ideas, and song structure around a progression.</p>
              </div>
            </div>

            {/* Feature 4: Jam Session */}
            <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700 hover:border-slate-600 transition">
              <div className="relative aspect-video bg-slate-800 overflow-hidden">
                <Image
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/58DC13BB-0B5B-45A2-85B8-DD6F136A31E8-y1b15Kr2lkLhjwIDBYOS4aQrED0bmR.jpeg"
                  alt="Jam Session"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-white mb-3">Jam Session</h3>
                <p className="text-slate-300">Build and shape larger song structures. Organize sections, work with progression-based playback, and move from ideas to a complete arrangement.</p>
              </div>
            </div>

            {/* Feature 5: Solo Generator */}
            <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700 hover:border-slate-600 transition">
              <div className="relative aspect-video bg-slate-800 overflow-hidden">
                <Image
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/solo_generator-94g0SD2gckFqcZTKOBPtDlfumwws9P.jpeg"
                  alt="Solo Generator"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-white mb-3">Solo Generator</h3>
                <p className="text-slate-300">Generate solo material that fits the section and musical context instead of just dragging random licks. Phrase-aware creation for better results.</p>
              </div>
            </div>

            {/* Feature 6: Vocal Generator */}
            <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700 hover:border-slate-600 transition">
              <div className="relative aspect-video bg-slate-800 overflow-hidden">
                <Image
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/vocal_generator-AG7YDEh4vdB6udwZxHCp84yLMNXL9m.jpeg"
                  alt="Vocal Generator"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-white mb-3">Vocal Generator</h3>
                <p className="text-slate-300">Generate melodic vocal ideas for leads, choirs, or backing parts. Extends phrase-aware thinking into vocal writing within your songwriting workflow.</p>
              </div>
            </div>

            {/* Feature 7: Lyrics */}
            <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700 hover:border-slate-600 transition">
              <div className="relative aspect-video bg-slate-800 overflow-hidden">
                <Image
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/lyrics-qMaqi6oJr3GYFBTW0xCU3mp6nE4RvT.jpeg"
                  alt="Lyrics Workflow"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-white mb-3">Lyrics Workflow</h3>
                <p className="text-slate-300">Connect writing and editing words to the musical process. Move from chord and phrase ideas toward complete songs with integrated lyrics.</p>
              </div>
            </div>

            {/* Feature 8: Riff Maker */}
            <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700 hover:border-slate-600 transition">
              <div className="relative aspect-video bg-slate-800 overflow-hidden">
                <Image
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/riff_maker-2GckncnUY0XSQtKDSifpAynOLrfyni.jpeg"
                  alt="Riff Maker"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-white mb-3">Riff Maker / Motif Workflow</h3>
                <p className="text-slate-300">Focus on motif and riff creation around chord progressions. Audition and shape musical ideas, then record and export for DAW development.</p>
              </div>
            </div>
          </div>
        </section>

        {/* WHY SMARTBRIDGE IS DIFFERENT */}
        <section className="container mx-auto px-6 max-w-4xl mb-32">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-12">
            <h2 className="text-3xl font-bold text-white mb-12">Why SmartBridge Is Different</h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Beyond Static MIDI Loops</h3>
                <p className="text-slate-300">SmartBridge treats phrases as part of a song workflow, not just drag-and-drop content.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Arrangement-Aware Workflow</h3>
                <p className="text-slate-300">It helps build sections, structure, and musical development rather than isolated clips.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Harmonization Across Multiple Layers</h3>
                <p className="text-slate-300">SmartBridge can grow into brass, strings, and vocal harmonization as part of the arrangement process.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Lyrics and Vocals Connected to the Music</h3>
                <p className="text-slate-300">It does not stop at MIDI ideas; it can move toward words and vocal production.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Yamaha + DAW Integration</h3>
                <p className="text-slate-300">It connects keyboard workflow with computer-based production in a practical way.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CREATIVE FLOW */}
        <section className="container mx-auto px-6 max-w-6xl mb-32">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">A Connected Creative Flow</h2>
            <p className="text-lg text-slate-400">SmartBridge helps you move from a musical idea to a fuller arrangement without jumping between disconnected tools</p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="space-y-8">
                <div className="flex gap-6">
                  <div className="text-3xl font-bold text-amber-500 shrink-0">1</div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Start with a progression or song section</h3>
                    <p className="text-slate-400">Choose from hundreds of curated chord progressions or create your own</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="text-3xl font-bold text-amber-500 shrink-0">2</div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Explore phrases, riffs, solos, and arrangement layers</h3>
                    <p className="text-slate-400">Generate and audition musical ideas that fit your progression</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="text-3xl font-bold text-amber-500 shrink-0">3</div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Add lyrics, vocals, and harmonization</h3>
                    <p className="text-slate-400">Build out full arrangements with complete musical layers</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="text-3xl font-bold text-amber-500 shrink-0">4</div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Export into the DAW for production</h3>
                    <p className="text-slate-400">Move your complete arrangements directly into your DAW workflow</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative aspect-[4/3] bg-slate-800 rounded-xl overflow-hidden shadow-2xl border border-slate-700">
              <Image
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/riff_maker-2GckncnUY0XSQtKDSifpAynOLrfyni.jpeg"
                alt="Creative Flow"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </section>

        {/* SUPPORTING FEATURES */}
        <section className="container mx-auto px-6 max-w-6xl mb-32">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-12">Advanced Workflow & Supporting Features</h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* DSP */}
            <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
              <div className="relative aspect-video bg-slate-800 overflow-hidden">
                <Image
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/tyros_dsp_effects-AUmIGwLxzINAcUdE5NS3Rvd0xb2Kgk.jpeg"
                  alt="Tyros DSP"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold text-white mb-3">Tyros DSP and Sound Control</h3>
                <p className="text-slate-300">Edit and control DSP-related sound shaping from the computer interface, making detailed keyboard sound management easier inside a broader production workflow.</p>
              </div>
            </div>

            {/* Record Section */}
            <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
              <div className="relative aspect-video bg-slate-800 overflow-hidden">
                <Image
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/record_section_motif-KHSu0LFtOQmyUEOfCguD9Gz531dAPN.jpeg"
                  alt="Record Section"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold text-white mb-3">Record Section Output</h3>
                <p className="text-slate-300">Capture generated or performance-based material and move it into the next production step. SmartBridge is a workflow bridge, not just a playback tool.</p>
              </div>
            </div>

            {/* Settings */}
            <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
              <div className="relative aspect-video bg-slate-800 overflow-hidden">
                <Image
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/settings-s0GmTGISA8QUG0rkQBMBy63VJXnNkp.jpeg"
                  alt="Settings"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold text-white mb-3">Settings and System Setup</h3>
                <p className="text-slate-300">Manage the overall environment, setup, and workflow options from one place so your production system stays organized and usable.</p>
              </div>
            </div>
          </div>
        </section>

        {/* SCREENSHOT GALLERY */}
        <section className="container mx-auto px-6 max-w-6xl mb-32">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-12">More Screens from SmartBridge</h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="relative aspect-video bg-slate-800 rounded-xl overflow-hidden shadow-xl border border-slate-700">
              <Image
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/jam_player_motif-4jbkMJo3tWjOt8gQdKXuk9R2KzIMCS.jpeg"
                alt="Jam Player Motif"
                fill
                className="object-cover"
              />
            </div>
            <div className="relative aspect-video bg-slate-800 rounded-xl overflow-hidden shadow-xl border border-slate-700">
              <Image
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/30475E60-6952-4E3F-A68E-13B92D2ACE20-gq9eQJ63DPGnTtFQWHjVRIUcWnVKj6.jpeg"
                alt="Settings Configuration"
                fill
                className="object-cover"
              />
            </div>
            <div className="relative aspect-video bg-slate-800 rounded-xl overflow-hidden shadow-xl border border-slate-700">
              <Image
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/D9AE2F25-12E9-4712-95D8-1F7FE606DE3C-DuyyGH6m4h8whsOYrEAvbDEiWhAHxM.jpeg"
                alt="Lyrics Screen"
                fill
                className="object-cover"
              />
            </div>
            <div className="relative aspect-video bg-slate-800 rounded-xl overflow-hidden shadow-xl border border-slate-700">
              <Image
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/58DC13BB-0B5B-45A2-85B8-DD6F136A31E8-y1b15Kr2lkLhjwIDBYOS4aQrED0bmR.jpeg"
                alt="Jam Session Timeline"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="container mx-auto px-6 max-w-4xl mb-12 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">From keyboard control to full arrangement workflow</h2>
          <p className="text-lg text-slate-300 mb-8 leading-relaxed">
            SmartBridge brings together Yamaha integration, phrase-based creativity, harmonization, lyrics, and vocal workflow in one connected system.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold rounded-lg transition">
              Explore SmartBridge
            </button>
            <button className="px-8 py-3 border border-slate-400 text-slate-100 hover:bg-slate-800 font-semibold rounded-lg transition">
              Request Access
            </button>
          </div>
        </section>

        {/* ABOUT CREATOR */}
        <section className="container mx-auto px-6 max-w-4xl mb-12">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-12">
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="w-32 h-32 md:w-40 md:h-40 shrink-0 rounded-full overflow-hidden border-4 border-amber-500/20 bg-slate-800">
                <Image src="/images/claudio.jpeg" alt="Claudio" width={160} height={160} className="w-full h-full object-cover" />
              </div>
              <div className="text-center md:text-left space-y-4">
                <p className="text-slate-300 leading-relaxed">
                  SmartBridge was created by a musician for musicians who want a more inspiring workflow. This personal tool grew from the desire to explore the full richness of Yamaha keyboards without technical barriers.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  If you're interested in SmartBridge, feel free to contact me at{" "}
                  <a href="mailto:claudio.private@gmail.com" className="text-amber-400 hover:text-amber-300 font-semibold">
                    claudio.private@gmail.com
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
