import {
  ALLOWED_DRAW_TIMES,
  MAX_PLAYERS,
  MAX_ROUNDS,
  MIN_CUSTOM_WORDS,
  MIN_PLAYERS,
  MIN_ROUNDS,
  WORD_PRESETS,
} from "@/models";
import { LANGUAGES } from "@/constants/languages";

const features = [
  "Private rooms with an invite link, or join a public room",
  `${MIN_PLAYERS}–${MAX_PLAYERS} players, ${MIN_ROUNDS}–${MAX_ROUNDS} rounds, ${ALLOWED_DRAW_TIMES[0]} seconds to ${ALLOWED_DRAW_TIMES[ALLOWED_DRAW_TIMES.length - 1] / 60} minutes per drawing`,
  `Word packs: ${WORD_PRESETS.map((p) => p.name).join(", ")}, or your own custom words`,
  `Don't know a word? Get a reference image, a short AI explanation, or a translation into ${LANGUAGES.length} languages`,
  "Out of ideas? Let the AI draw the word for you, once per game",
  "Works on phones, tablets and desktop",
];

const faq = [
  {
    q: "Is SketchAI free?",
    a: "Yes. No account, no download: pick a nickname and play.",
  },
  {
    q: "How do I play with friends?",
    a: "Create a room, keep it private, and share the invite link.",
  },
  { q: "How many people can play?", a: `${MIN_PLAYERS} to ${MAX_PLAYERS} per room.` },
  {
    q: "Can I use my own words?",
    a: `Yes. Choose "Custom" as the word source and enter at least ${MIN_CUSTOM_WORDS} words separated by commas.`,
  },
  {
    q: "What does the AI do?",
    a: `When you're drawing, it can draw your word for you once per game, explain a word you don't know, or translate it into ${LANGUAGES.length} languages.`,
  },
  { q: "Does it work on mobile?", a: "Yes, in any modern browser." },
];

export default function About() {
  return (
    <>
      <section className="mt-6 bg-card/80 rounded-2xl p-5 border-2 border-card-border">
        <h2 className="text-white font-bold text-lg mb-3 text-center">
          ✨ What is SketchAI?
        </h2>
        <p className="text-white/80 text-sm mb-3">
          A free online drawing and guessing game you play in your browser,
          with no download and no account. Each round one player draws a
          secret word while everyone else races to guess it in the chat. The
          faster you guess, the more points you score.
        </p>
        <ul className="list-disc pl-5 space-y-1 text-white/80 text-sm">
          {features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </section>

      <section className="mt-6 bg-card/80 rounded-2xl p-5 border-2 border-card-border">
        <h2 className="text-white font-bold text-lg mb-3 text-center">
          ❓ FAQ
        </h2>
        <div className="space-y-2">
          {faq.map(({ q, a }) => (
            <details key={q} className="bg-background rounded-xl p-3">
              <summary className="text-white font-semibold text-sm cursor-pointer">
                {q}
              </summary>
              <p className="text-white/80 text-sm mt-2">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
