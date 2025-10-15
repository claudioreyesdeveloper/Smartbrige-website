import { Header } from "@/components/header"
import { HeroVision } from "@/components/hero-vision"
import { ExperienceToday } from "@/components/experience-today"
import { ComingFeatures } from "@/components/coming-features"
import { TechnicalFoundation } from "@/components/technical-foundation"
import { DevelopmentProgress } from "@/components/development-progress"
import { AboutCreator } from "@/components/about-creator"
import { EditionsLicensing } from "@/components/editions-licensing"
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
        <ExperienceToday />
        <ComingFeatures />
        <TechnicalFoundation />
        <DevelopmentProgress />
        <AboutCreator />
        <EditionsLicensing />
        <CommunityVoices />
        <SupportDocs />
        <FeedbackForm />
        <SystemRequirements />
      </main>
      <Footer />
    </div>
  )
}
