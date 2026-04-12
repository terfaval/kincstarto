import Image from "next/image";
import Link from "next/link";
import { BookOpen, Flower2, Gem } from "lucide-react";

const landingDescription =
  "Könyvek, meditációk és mozgás egy helyen — egy személyes gyűjtemény, amit nem használatra terveztem, hanem hogy vissza lehessen térni hozzá, amikor szükség van rá.";

export default function LandingPage() {
  return (
    <main className="landing-shell">
      <section className="landing-hero">
        <div className="landing-brand">
          <Image
            src="/favicon.svg"
            alt="Kincstartó"
            width={140}
            height={140}
            priority
          />
          <h1>Kincstartó</h1>
        </div>
        <p className="landing-description">{landingDescription}</p>
      </section>
      <section className="landing-cards">
        <Link className="landing-card" href="/library">
          <BookOpen size={52} strokeWidth={1.5} />
          <span>Könyvtár</span>
        </Link>
        <Link className="landing-card" href="/meditations">
          <Gem size={52} strokeWidth={1.5} />
          <span>Üveggyöngyök</span>
        </Link>
        <Link className="landing-card" href="/yogis-choice">
          <Flower2 size={52} strokeWidth={1.5} />
          <span>Jóga</span>
        </Link>
      </section>
    </main>
  );
}
