import { Header } from "@/components/header"
import { HeroVision } from "@/components/hero-vision"
import { OverviewSection } from "@/components/overview-section"
import { DevelopmentPhase } from "@/components/development-phase"
import { RoadmapSection } from "@/components/roadmap-section"
import { AboutCreator } from "@/components/about-creator"
import { CommunityCollaboration } from "@/components/community-collaboration"
import { TechnicalFoundation } from "@/components/technical-foundation"
import { TryItSection } from "@/components/try-it-section"
import { CommunityVoices } from "@/components/community-voices"
import { SupportDocs } from "@/components/support-docs"
import { FeedbackForm } from "@/components/feedback-form"
import { SystemRequirements } from "@/components/system-requirements"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <HeroVision />
        <OverviewSection />
        <DevelopmentPhase />
        <RoadmapSection />
        <AboutCreator />
        <CommunityCollaboration />
        <TechnicalFoundation />
        <TryItSection />
        {/* <EditionsLicensing /> */}
        <CommunityVoices />
        <SupportDocs />
        <FeedbackForm />
        <SystemRequirements />
      </main>
      <Footer />
    </div>
  )
}
