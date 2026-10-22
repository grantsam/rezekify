import Navbar from '../components/landing/Navbar';
import HeroSection from '../components/landing/HeroSection';
import AboutSection from '../components/landing/AboutSection';
import FeaturesSection from '../components/landing/FeatureSection';
import BenefitsSection from '../components/landing/BenefitSection';
import HowItWorksSection from '../components/landing/WorkflowSection';
import FaqSection from '../components/landing/FaqSection';
import CtaSection from '../components/landing/CtaSection';
import FooterSection from '../components/landing/FooterSection';

import ScrollReveal from '../components/common/ScrollReveal';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0c0c0e] text-slate-900 dark:text-white transition-colors duration-300 overflow-hidden">
      <Navbar />

      <main>
        <HeroSection />

        <ScrollReveal direction="up" delay={0.1}>
          <AboutSection />
        </ScrollReveal>

        <ScrollReveal direction="up" delay={0.1}>
          <FeaturesSection />
        </ScrollReveal>

        <ScrollReveal direction="up" delay={0.1}>
          <BenefitsSection />
        </ScrollReveal>

        <ScrollReveal direction="up" delay={0.1}>
          <HowItWorksSection />
        </ScrollReveal>

        <ScrollReveal direction="up" delay={0.1}>
          <FaqSection />
        </ScrollReveal>

        <ScrollReveal direction="none" delay={0.1}>
          <CtaSection />
        </ScrollReveal>
      </main>
      
      <ScrollReveal direction="up" delay={0.1}>
        <FooterSection />
      </ScrollReveal>
    </div>
  );
}