import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, BookOpen, CheckCircle2 } from "lucide-react"
import { FeatureExplorer } from "@/components/feature-explorer"
import styles from "@/components/marketing-redesign.module.css"

export const metadata: Metadata = {
  title: "SmartBridge Desktop manual",
  description:
    "Interactive reference for SmartBridge Desktop keyboard control, JamPlayer, performed MIDI, vocals, solos, harmony, Motif, Cubase, Jam Session, and Yamaha style creation.",
}

export default function ManualPage() {
  return (
    <div className={styles.desktopPage}>
      <section className={styles.desktopHero}>
        <div className={`m-wrap ${styles.desktopHeroGrid}`}>
          <div>
            <p className={styles.eyebrow}>SmartBridge Desktop · Product reference</p>
            <h1 className={styles.desktopHeroTitle}>
              The complete Desktop manual.
              <span>Every connected tool in one reference.</span>
            </h1>
            <p className={styles.sectionIntro} style={{ marginTop: "1.65rem" }}>
              This page is the detailed product layer. Browse exact descriptions, screenshots,
              controls, workflows, and related demonstrations after the main Desktop page has
              established what SmartBridge solves and how the connected system fits together.
            </p>
            <div className="m-actions" style={{ marginTop: "2rem" }}>
              <Link href="/features" className="m-button m-button-primary">
                <ArrowLeft size={17} /> Back to Desktop overview
              </Link>
              <Link href="/beta" className="m-button m-button-outline-light">Request beta access</Link>
            </div>
            <div className={styles.desktopHeroProof}>
              <span><CheckCircle2 size={15} /> Keyboard, song, rhythm-section, vocal, solo, and harmony workflows</span>
              <span><CheckCircle2 size={15} /> Motif, Cubase, Jam Session, and native Yamaha style reference</span>
              <span><CheckCircle2 size={15} /> Screenshots and related SmartBridge video demonstrations</span>
            </div>
          </div>

          <div className={styles.desktopHeroWindow}>
            <div className={styles.windowBar}><i /><i /><i /><strong>SmartBridge Desktop · Product manual</strong></div>
            <Image
              src="/images/desktop-v15/24_genos_mixer_v15.png"
              alt="SmartBridge Desktop Genos mixer shown in the product manual"
              width={1200}
              height={800}
              priority
            />
          </div>
        </div>
      </section>

      <section className={styles.explorerSection}>
        <div className="content-wrap">
          <div className={styles.explorerIntro}>
            <p className="ux-section-label"><BookOpen size={15} /> SmartBridge Desktop reference</p>
            <h2>Browse by product area.</h2>
            <p>
              Select a category and tool to see what it does, why it matters, the available actions,
              and the SmartBridge demonstrations that show it in use.
            </p>
          </div>
          <FeatureExplorer />
        </div>
      </section>

      <section className="m-final-cta">
        <div className="m-wrap m-final-cta-inner">
          <p className="m-eyebrow">Return to the product story</p>
          <h2>See how the detailed tools combine into one continuous Yamaha-to-production workflow.</h2>
          <div className="m-actions">
            <Link href="/features" className="m-button m-button-primary">Desktop overview</Link>
            <Link href="/about" className="m-button m-button-outline-light">Why SmartBridge exists</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
