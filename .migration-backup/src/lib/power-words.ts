/**
 * Power Words Lexicon and Analysis Utilities
 * Used for copywriting optimization, headline CTR boosting, and Rank Math SEO audits.
 */

export interface PowerWordCategory {
  name: string;
  description: string;
  words: string[];
}

export const POWER_WORDS_DICTIONARY: Record<string, PowerWordCategory> = {
  authority: {
    name: "Authority & Prestige",
    description: "Builds instant credibility, trust, and enterprise-grade prestige.",
    words: [
      "proven", "definitive", "blueprint", "architect", "architecture", "enterprise",
      "elite", "master", "masterclass", "benchmark", "industry-leading", "gold-standard",
      "certified", "verified", "authoritative", "unrivaled", "premier", "bespoke",
      "principled", "foundational", "rigorous", "battle-tested", "mission-critical",
    ],
  },
  urgency: {
    name: "Speed & Velocity",
    description: "Communicates zero-latency, high performance, and rapid execution.",
    words: [
      "accelerate", "breakthrough", "instant", "instantly", "high-velocity", "zero-latency",
      "sub-second", "rapid", "lightning", "real-time", "immediate", "critical", "crucial",
      "fast-track", "turbocharge", "streamlined", "next-generation", "frictionless",
    ],
  },
  transformation: {
    name: "Impact & Transformation",
    description: "Highlights tangible business outcomes, conversion lift, and scale.",
    words: [
      "transform", "transformative", "revolutionize", "unleash", "skyrocket", "exponential",
      "paradigm", "game-changer", "pioneering", "radical", "uncompromising", "monumental",
      "surge", "lift", "overhaul", "reimagined", "unprecedented",
    ],
  },
  clarity: {
    name: "Clarity & Mastery",
    description: "Promises actionable, step-by-step comprehension without fluff.",
    words: [
      "effortless", "comprehensive", "step-by-step", "simplified", "seamless", "demystified",
      "handbook", "framework", "playbook", "cheat-sheet", "essential", "actionable",
      "uncovered", "revealed", "deep-dive", "teardown", "anatomy",
    ],
  },
  curiosity: {
    name: "Curiosity & Exclusivity",
    description: "Draws readers into clicking by revealing insider techniques.",
    words: [
      "secret", "secrets", "untold", "insider", "unveiled", "unmasked", "behind-the-scenes",
      "hidden", "under-the-hood", "surprising", "counter-intuitive", "truth", "myth",
      "confidential", "proprietary",
    ],
  },
};

// Flattened list of all unique power words
export const ALL_POWER_WORDS: string[] = Array.from(
  new Set(
    Object.values(POWER_WORDS_DICTIONARY).flatMap((category) => category.words)
  )
);

export interface PowerWordMatch {
  word: string;
  category: string;
  categoryName: string;
  count: number;
}

export interface PowerWordsAnalysis {
  headlineScore: number; // 0 to 100 based on headline effectiveness
  headlineMatches: PowerWordMatch[];
  contentMatches: PowerWordMatch[];
  totalPowerWordsFound: number;
  headlineHasPowerWord: boolean;
  headlineHasNumber: boolean;
  headlineLengthStatus: "short" | "optimal" | "long";
  categoryDistribution: Record<string, number>;
  recommendations: string[];
}

/**
 * Analyzes headline and article text for power words and copywriting effectiveness
 */
export function analyzePowerWords(
  headline: string = "",
  content: string = ""
): PowerWordsAnalysis {
  const normHeadline = ` ${headline.toLowerCase().replace(/[^a-z0-9\s-]/g, " ")} `;
  const normContent = ` ${content.toLowerCase().replace(/[^a-z0-9\s-]/g, " ")} `;

  const headlineMatches: PowerWordMatch[] = [];
  const contentMatches: PowerWordMatch[] = [];
  const categoryDistribution: Record<string, number> = {};

  // Check dictionary words
  Object.entries(POWER_WORDS_DICTIONARY).forEach(([catKey, catObj]) => {
    categoryDistribution[catKey] = 0;

    catObj.words.forEach((pw) => {
      const regex = new RegExp(`\\b${pw}\\b`, "gi");

      // In headline
      const headMatches = normHeadline.match(regex);
      if (headMatches && headMatches.length > 0) {
        headlineMatches.push({
          word: pw,
          category: catKey,
          categoryName: catObj.name,
          count: headMatches.length,
        });
        categoryDistribution[catKey] += headMatches.length;
      }

      // In content
      const bodyMatches = normContent.match(regex);
      if (bodyMatches && bodyMatches.length > 0) {
        contentMatches.push({
          word: pw,
          category: catKey,
          categoryName: catObj.name,
          count: bodyMatches.length,
        });
        categoryDistribution[catKey] += bodyMatches.length;
      }
    });
  });

  const headlineHasPowerWord = headlineMatches.length > 0;
  const headlineHasNumber = /\d+/.test(headline);

  const headlineLength = headline.trim().length;
  let headlineLengthStatus: "short" | "optimal" | "long" = "optimal";
  if (headlineLength < 35) headlineLengthStatus = "short";
  else if (headlineLength > 65) headlineLengthStatus = "long";

  // Compute headline copywriting score (0 - 100)
  let headlineScore = 40; // Base score
  if (headlineHasPowerWord) headlineScore += Math.min(30, headlineMatches.length * 15);
  if (headlineHasNumber) headlineScore += 15;
  if (headlineLengthStatus === "optimal") headlineScore += 15;
  else if (headlineLengthStatus === "short") headlineScore -= 10;
  else headlineScore -= 10;

  headlineScore = Math.min(100, Math.max(10, headlineScore));

  const totalPowerWordsFound =
    headlineMatches.reduce((a, b) => a + b.count, 0) +
    contentMatches.reduce((a, b) => a + b.count, 0);

  const recommendations: string[] = [];
  if (!headlineHasPowerWord) {
    recommendations.push(
      "Add at least 1 high-converting Power Word (e.g. 'Architect', 'Proven', 'Zero-Latency', 'Blueprint') to your headline."
    );
  }
  if (!headlineHasNumber) {
    recommendations.push(
      "Headlines with specific metrics or numbers (e.g. 'Sub-50ms', '42% Lift', '3 Architectural Rules') generate 36% higher CTR."
    );
  }
  if (headlineLengthStatus === "short") {
    recommendations.push("Your headline is under 35 characters. Expand it to articulate clear value.");
  } else if (headlineLengthStatus === "long") {
    recommendations.push("Your headline is over 65 characters and may truncate on Google SERP pages.");
  }
  if (contentMatches.length < 3) {
    recommendations.push("Incorporate more authoritative and transformative terminology into your body subsections.");
  }

  return {
    headlineScore,
    headlineMatches,
    contentMatches,
    totalPowerWordsFound,
    headlineHasPowerWord,
    headlineHasNumber,
    headlineLengthStatus,
    categoryDistribution,
    recommendations,
  };
}
