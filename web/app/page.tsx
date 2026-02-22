import { Navigation } from "@/components/navigation"
import { HeroSection } from "@/components/hero-section"
import { TechStack } from "@/components/tech-stack"
import { LifestyleGallery } from "@/components/lifestyle-gallery"
import { ExperienceSection } from "@/components/experience-section"
import { SentinelSection } from "@/components/sentinel-section"
import { HowItWorks } from "@/components/how-it-works"
import { FeaturesGrid } from "@/components/features-grid"
import { CTASection } from "@/components/cta-section"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Navigation />
      <main>
        <HeroSection />
        <TechStack />
        <LifestyleGallery />
        <ExperienceSection />
        <SentinelSection />
        <HowItWorks />
        <FeaturesGrid />
        <CTASection />
      </main>
      <Footer />
    </div>
  )
}
