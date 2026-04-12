import Image from "next/image";
import Link from "next/link";

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
          <Image
            src="/icons/library.svg"
            alt=""
            width={84}
            height={84}
            className="landing-icon"
            aria-hidden
          />
          <span>Könyvtár</span>
        </Link>
        <Link className="landing-card" href="/meditations">
          <Image
            src="/icons/meditations.svg"
            alt=""
            width={84}
            height={84}
            className="landing-icon"
            aria-hidden
          />
          <span>Üveggyöngyök</span>
        </Link>
        <Link className="landing-card" href="/yogis-choice">
          <Image
            src="/icons/yoga.svg"
            alt=""
            width={84}
            height={84}
            className="landing-icon"
            aria-hidden
          />
          <span>Jóga</span>
        </Link>
      </section>
    </main>
  );
}
