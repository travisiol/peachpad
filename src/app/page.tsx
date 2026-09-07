import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Launches } from "@/components/Launches";
import { About } from "@/components/About";
import { TokenSection } from "@/components/TokenSection";
import { Cta } from "@/components/Cta";
import { Footer } from "@/components/Footer";

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="relative flex-1 overflow-x-hidden bg-cream">
        <Hero />
        <Launches />
        <About />
        <TokenSection />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
