import Image from "next/image"
import Link from "next/link"
import { ArrowRight, AudioLines, Cable, Check, Gauge, Headphones, Layers3, Music2, Repeat2, SlidersHorizontal, VolumeX, WandSparkles } from "lucide-react"
import { Hero } from "@/components/hero"
import { SITE } from "@/lib/site"

const desktopPillars = [
  { icon: SlidersHorizontal, title: "Control", body: "Mix Genos and Motif parts, voices, effects, ensembles, arps, and complete song setups from the computer." },
  { icon: Layers3, title: "Arrange", body: "Build songs on a chord grid, import ChordPro, place rhythm-section performances, and capture Jam Sessions." },
  { icon: WandSparkles, title: "Create", body: "Generate vocal melodies, lyrics, solos, brass and string harmony—always against the current song section." },
  { icon: Cable, title: "Produce", body: "Drag editable MIDI to Cubase, send vocals to Synthesizer V, or transfer native styles back to the keyboard." },
]

const styleMakerIncludes = ["Bass and drum phrase library", "Your own MIDI on every lane", "Per-section mixer for channels 9–16", "CASM-aware native style export", "Direct USB Musicsoft transfer"]

export default function HomePage() {
  return (
    <div className="marketing-page">
      <Hero />

      <section className="m-rig-strip" aria-label="SmartBridge integrations">
        <div className="m-wrap m-rig-strip-inner"><p>One bridge across your full rig</p><div><span>Genos</span><span>Tyros</span><span>PSR-SX</span><span>Motif</span><span>Cubase</span><span>Synthesizer V</span><span>macOS + Windows</span></div></div>
      </section>

      <section className="m-section m-product-choice">
        <div className="m-wrap">
          <div className="m-section-heading m-section-heading-split"><div><p className="m-eyebrow">The SmartBridge family</p><h2>Two complete products. One musical point of view.</h2></div><p>Desktop is the connected production environment. Style Maker is the focused browser workflow. Neither is a reduced version of the other.</p></div>
          <div className="m-product-pillar-grid">
            <article className="m-product-pillar m-product-pillar-desktop">
              <div className="m-product-pillar-copy"><p className="m-eyebrow">SmartBridge Desktop</p><h3>Your musical control room.</h3><p>Control the keyboard, build the song, generate the missing parts, and move the arrangement into production without breaking the musical context.</p><div className="m-product-status"><span>macOS + Windows</span><span>VST3 + Standalone</span><span>Private beta</span></div><Link href="/features" className="m-button m-button-primary">Explore Desktop <ArrowRight size={17} /></Link></div>
              <Image src="/images/desktop-v15/24_genos_mixer_v15.png" alt="SmartBridge Desktop Genos Mixer" width={1000} height={667} />
            </article>
            <article className="m-product-pillar m-product-pillar-style">
              <div className="m-product-pillar-copy"><p className="m-eyebrow">SmartBridge Style Maker</p><h3>Build the style you want to play.</h3><p>Rework Yamaha arranger styles in the browser—replace the performances, mix each section, export, and transfer to your keyboard.</p><div className="m-product-status"><span>Browser based</span><span>14-day trial</span><span>$14.99/month</span></div><Link href="/style-maker" className="m-button m-button-ink">Explore Style Maker <ArrowRight size={17} /></Link></div>
              <Image src="/images/desktop-v15/46_style_maker_build.png" alt="SmartBridge Style Maker building a Yamaha style section" width={1000} height={667} />
            </article>
          </div>
        </div>
      </section>

      <section className="m-section m-desktop-story">
        <div className="m-wrap">
          <div className="m-section-heading m-section-heading-split"><div><p className="m-eyebrow">SmartBridge Desktop</p><h2>The song is the shared context.</h2></div><p>Load the chords once. The keyboard, rhythm section, vocal melody, solo, harmony, and DAW handoff all understand the same form.</p></div>
          <div className="m-desktop-pillar-grid">
            {desktopPillars.map((pillar, index) => <article key={pillar.title}><span>0{index + 1}</span><pillar.icon size={22} /><h3>{pillar.title}</h3><p>{pillar.body}</p></article>)}
          </div>
          <div className="m-desktop-showcase">
            <div className="m-product-window m-product-window-dark"><div className="m-window-bar"><span /><span /><span /><strong>SmartBridge Desktop · Solo Ideas</strong></div><Image src="/images/desktop-v15/37_solo_ideas.png" alt="SmartBridge Desktop Solo Generator with musical form and phrase controls" width={1200} height={800} /></div>
            <div><p className="m-eyebrow">More than generation</p><h3>Shape the idea until it belongs in the song.</h3><p>Desktop does not stop at “generate.” Audition with the band, edit notes against the chord grid, add real playing gestures, build brass or string harmony, and drag each channel into Cubase.</p><Link href="/features" className="m-text-link">See every Desktop feature <ArrowRight size={16} /></Link></div>
          </div>
        </div>
      </section>

      <section className="m-desktop-gallery">
        <div className="m-wrap m-desktop-gallery-grid">
          {[
            ["/images/desktop-v15/32_vocals_easy.png", "Vocals", "Write section-length melodies, build phrase by phrase, add lyrics, and send to SynthV."],
            ["/images/desktop-v15/43_riff_maker_v15.png", "Riff Maker", "Turn Motif arps into chord-aware performances and editable MIDI for the DAW."],
            ["/images/desktop-v15/45_jam_session_v15.png", "Jam Session", "Capture chords and MIDI as reusable clips on a complete song timeline."],
          ].map(([src, title, body]) => <article key={title}><Image src={src} alt={`SmartBridge Desktop ${title}`} width={800} height={533} /><div><h3>{title}</h3><p>{body}</p></div></article>)}
        </div>
      </section>

      <section className="m-section m-style-maker-home">
        <div className="m-wrap m-pricing-grid">
          <div className="m-pricing-copy"><p className="m-eyebrow">Style Maker · Available now</p><h2>Focused style creation, directly in the browser.</h2><p>Start from a donor style, replace the musical parts section by section, keep Yamaha’s native structure, and send the finished result back to your arranger.</p><div className="m-personal-note"><AudioLines size={22} /><p><strong>Desktop and browser, built from the same musical workflow.</strong> Style Maker focuses the native-style process; Desktop connects it to the rest of the song.</p></div></div>
          <article className="m-price-card"><p>Style Maker</p><div className="m-price"><strong>$14.99</strong><span>/ month</span></div><small>14 days free · card required · cancel anytime</small><ul>{styleMakerIncludes.map((item) => <li key={item}><Check size={16} /> {item}</li>)}</ul><Link href="/style-maker" className="m-button m-button-primary">Start free trial <ArrowRight size={17} /></Link></article>
        </div>
      </section>

      <section className="m-section m-jam-section">
        <div className="m-wrap m-jam-grid">
          <div className="m-jam-copy"><p className="m-eyebrow">Jam Player · Free in the browser</p><h2>A practice band that follows your rules.</h2><p>Choose the progression, key, tempo, and feel. Mute the instrument you play and practise with the rest of the band.</p><div className="m-mini-features"><span><VolumeX size={17} /> Mute your part</span><span><Gauge size={17} /> Set the tempo</span><span><Repeat2 size={17} /> Loop cleanly</span><span><Headphones size={17} /> Play with the band</span></div><Link href="/jam-player/app" className="m-button m-button-ink">Open Jam Player free <ArrowRight size={17} /></Link></div>
          <div className="m-jam-player-card"><div className="m-jam-player-head"><span><Music2 size={18} /> Funk pocket</span><span>96 BPM · Em</span></div><div className="m-chord-row"><span className="is-playing">Em7</span><span>A7</span><span>Dmaj7</span><span>B7</span></div><div className="m-mixer-row">{[["DR","Drums","78%"],["BS","Bass","Muted"],["GT","Guitar","64%"],["KY","Keys","52%"]].map(([short,name,level]) => <div key={name} className={level === "Muted" ? "is-muted" : ""}><span className="m-track-icon">{short}</span><strong>{name}</strong><small>{level}</small></div>)}</div></div>
        </div>
      </section>

      <section className="m-final-cta"><div className="m-wrap m-final-cta-inner"><p className="m-eyebrow">Choose your workflow</p><h2>Build the song in Desktop. Build the style in your browser.</h2><div className="m-actions"><Link href="/features" className="m-button m-button-primary">Explore SmartBridge Desktop <ArrowRight size={17} /></Link><Link href="/style-maker" className="m-button m-button-outline-light">Try Style Maker</Link><a href={SITE.setupUrl} className="m-button m-button-outline-light" target="_blank" rel="noopener noreferrer">Download Setup</a></div></div></section>
    </div>
  )
}
