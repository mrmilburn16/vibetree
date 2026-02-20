import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { ProductShowcase } from "@/components/landing/ProductShowcase";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Features } from "@/components/landing/Features";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <div className="flex h-screen flex-col bg-[var(--background-primary)]">
      <Nav />
      <main className="landing-scroll-container flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <Hero />
        <ProductShowcase />
        <HowItWorks />
        <Features />
        <Footer />
      </main>
    </div>
  );
}
