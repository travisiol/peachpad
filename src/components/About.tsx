import { site, percent } from "@/lib/site";
import { Reveal } from "@/components/Reveal";

const STEPS = [
  {
    n: "01",
    title: "Launch through us",
    body: `${site.wordmark[0]} is middleware, not a competing factory. Your token goes live on platforms builders already use. We start with ${site.firstPad} on Robinhood Chain; more pads come next.`,
  },
  {
    n: "02",
    title: `Keep ${percent.creator} of creator fees`,
    body: `We take a clean ${percent.pad} of creator fees. The rest stays with you. Same markets, same liquidity rails, with a partner invested in your outcome.`,
  },
  {
    n: "03",
    title: "Optional tools that scale",
    body: "Success isn’t only the deploy button. Add what you need when you need it: site, marketing, utilities, so the project has a real shot beyond day one.",
  },
];

const TOOLS = [
  {
    title: "Project website",
    body: "From about $10 with domain included: a clean site for your token, with a one-year lifetime so early teams ship presence without a stack of vendors.",
  },
  {
    title: "Marketing assistance",
    body: "Hands-on support to frame the story, reach the right audiences, and keep momentum after launch, not just a contract address drop.",
  },
  {
    title: "Utilities & build support",
    body: "Help standing up real product surface area: tools, integrations, and next steps that turn a launch into something people keep using.",
  },
];

export function About() {
  return (
    <section id="about" className="relative scroll-mt-24 overflow-hidden py-20 sm:py-28">
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="pixel-badge mx-auto mb-5 w-fit">The model</p>
          <h2 className="font-display text-2xl text-ink sm:text-4xl md:text-[2.5rem]">
            Not another factory. A layer that raises your odds.
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-ink/65 sm:text-base">
            Most pads stop at deploy. {site.name} routes your launch onto
            established platforms and wraps it with optional, scalable support
            so creators spend less time on infrastructure and more time on the
            project.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-8 lg:grid-cols-3 lg:gap-10">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} y={24} delay={i * 0.08} className="text-left">
              <p className="font-display text-sm text-peach">{s.n}</p>
              <h3 className="mt-3 font-display text-xl text-ink">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/60">{s.body}</p>
            </Reveal>
          ))}
        </div>

        <Reveal y={24} className="mt-20 border-y-4 border-ink bg-cream-deep px-5 py-12 sm:px-10 sm:py-14">
          <div className="mx-auto max-w-2xl text-center">
            <p className="pixel-badge mx-auto mb-5 w-fit">Builder tools</p>
            <h3 className="font-display text-2xl text-ink sm:text-3xl">
              Optional. Practical. Built to compound.
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-ink/60 sm:text-base">
              Add only what helps. Every offering is meant to increase the
              chance your launch survives the first weeks and keeps growing
              after.
            </p>
          </div>
          <div className="mx-auto mt-10 grid max-w-5xl gap-8 sm:grid-cols-3">
            {TOOLS.map((t, i) => (
              <Reveal key={t.title} y={16} delay={i * 0.08} className="text-left">
                <h4 className="font-display text-lg text-peach">{t.title}</h4>
                <p className="mt-2 text-sm leading-relaxed text-ink/60">{t.body}</p>
              </Reveal>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
