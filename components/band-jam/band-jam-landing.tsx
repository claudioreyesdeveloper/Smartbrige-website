import Link from "next/link"
import { ArrowRight, Gauge, Headphones, Music2, Repeat2, SlidersHorizontal, VolumeX } from "lucide-react"

const controls = [
  { icon: VolumeX, title: "Take your part out", body: "Mute bass, drums, guitar, or keys so your instrument has a real place in the band." },
  { icon: Gauge, title: "Practise at your tempo", body: "Slow the groove down while you learn it, then move it back up when the pocket feels solid." },
  { icon: Repeat2, title: "Repeat without fatigue", body: "Loop the same progression as long as you need. The band never gets bored or rushes you." },
]

export function BandJamLanding() {
  return (
    <div className="marketing-page mp-page jam-landing">
      <section className="jam-landing-hero">
        <div className="m-wrap jam-landing-grid">
          <div>
            <p className="m-eyebrow">SmartBridge Jam Player · Free to play</p>
            <h1>A practice band that follows your rules.</h1>
            <p className="mp-lead">
              Choose the progression, key, tempo, and feel. Mute the instrument you play and
              practise with the rest of the band — without searching for the perfect backing track.
            </p>
            <div className="m-actions">
              <Link href="/jam-player/app" className="m-button m-button-primary">Open Jam Player free <ArrowRight size={17} /></Link>
            </div>
            <p className="mp-fineprint">No download · No Yamaha keyboard required · Runs in your browser</p>
          </div>

          <div className="jam-console" aria-label="Jam Player practice controls preview">
            <div className="jam-console-top"><span><Music2 size={17} /> 70s pocket</span><span>Key E · 92 BPM</span></div>
            <div className="jam-console-chords"><strong className="active">E7</strong><strong>A7</strong><strong>E7</strong><strong>B7</strong></div>
            <div className="jam-console-track"><span>Drums</span><i /><b>78%</b></div>
            <div className="jam-console-track muted"><span>Bass</span><i /><b>Muted — you play</b></div>
            <div className="jam-console-track"><span>Guitar</span><i /><b>62%</b></div>
            <div className="jam-console-bottom"><span><Repeat2 size={16} /> Loop 4 bars</span><button aria-label="Play"><span>▶</span></button><span>Variation B</span></div>
          </div>
        </div>
      </section>

      <section className="m-section">
        <div className="m-wrap">
          <div className="m-section-heading m-section-heading-split">
            <div><p className="m-eyebrow">Built for deliberate practice</p><h2>More control than a backing track.</h2></div>
            <p>A recording is fixed. Jam Player gives you the repetition and control you need to work on time, feel, and confidence.</p>
          </div>
          <div className="m-step-grid">
            {controls.map((item, index) => (
              <article className="m-step-card" key={item.title}>
                <div className="m-step-top"><span>0{index + 1}</span><item.icon size={22} /></div>
                <h3>{item.title}</h3><p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="jam-facts">
        <div className="m-wrap jam-facts-grid">
          <div><strong>4</strong><span>launch styles</span></div>
          <div><strong>949</strong><span>song forms in the catalogue</span></div>
          <div><strong>∞</strong><span>patient repetitions</span></div>
          <div><Headphones size={27} /><span>built to play along</span></div>
        </div>
      </section>

      <section className="m-section jam-why">
        <div className="m-wrap jam-why-grid">
          <div><p className="m-eyebrow">The point is the space</p><h2>Hear your own timing against a complete rhythm section.</h2></div>
          <div>
            <p>Finished mixes leave your instrument doubled and muddy. Jam Player removes your part cleanly, so you can hear whether you are behind, ahead, or right in the pocket.</p>
            <div className="m-mini-features">
              <span><SlidersHorizontal size={17} /> Individual part levels</span>
              <span><Repeat2 size={17} /> Clean musical loops</span>
              <span><Gauge size={17} /> Key and tempo control</span>
              <span><Headphones size={17} /> Full-band context</span>
            </div>
          </div>
        </div>
      </section>

      <section className="m-final-cta">
        <div className="m-wrap m-final-cta-inner">
          <p className="m-eyebrow">The band is ready</p>
          <h2>Pick a progression. Mute your part. Start playing.</h2>
          <Link href="/jam-player/app" className="m-button m-button-primary">Open Jam Player free <ArrowRight size={17} /></Link>
        </div>
      </section>
    </div>
  )
}
