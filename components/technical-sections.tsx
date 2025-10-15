"use client"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Features } from "@/components/features"
import { CompatibilitySection } from "@/components/compatibility-section"
import { SystemRequirements } from "@/components/system-requirements"
import { SupportDocumentation } from "@/components/support-documentation"
import { DevelopmentProgress } from "@/components/development-progress"

export function TechnicalSections() {
  return (
    <section className="py-20 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Technical Details</h2>
          <p className="text-lg text-black max-w-2xl mx-auto">
            Explore features, compatibility, system requirements, and development progress
          </p>
        </div>

        <Tabs defaultValue="features" className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList className="grid w-full max-w-4xl grid-cols-2 md:grid-cols-5 h-auto gap-1">
              <TabsTrigger value="features" className="text-xs md:text-sm">
                Features
              </TabsTrigger>
              <TabsTrigger value="compatibility" className="text-xs md:text-sm">
                Compatibility
              </TabsTrigger>
              <TabsTrigger value="requirements" className="text-xs md:text-sm">
                Requirements
              </TabsTrigger>
              <TabsTrigger value="support" className="text-xs md:text-sm">
                Support
              </TabsTrigger>
              <TabsTrigger value="progress" className="text-xs md:text-sm">
                Progress
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="features">
            <Features />
          </TabsContent>

          <TabsContent value="compatibility">
            <CompatibilitySection />
          </TabsContent>

          <TabsContent value="requirements">
            <SystemRequirements />
          </TabsContent>

          <TabsContent value="support">
            <SupportDocumentation />
          </TabsContent>

          <TabsContent value="progress">
            <DevelopmentProgress />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  )
}
