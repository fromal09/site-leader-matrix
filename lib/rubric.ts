import { CategoryKey } from "./categories";

export type RubricEntry = {
  traits: string[];
  practice: string[];
  spot: string[];
};

export const RUBRIC: Record<CategoryKey, RubricEntry> = {
  fan_authority: {
    traits: [
      "Passion",
      "Expertise",
      "Authenticity",
      "Social savvy",
      "Pragmatism",
      "Conviction",
      "Thought leadership",
      "Rivalry awareness",
    ],
    practice: [
      "Manages all of the site's socials",
      "Is on the right platforms at the right time",
      "Has an off-platform following",
      "Gets mentioned in Reddit threads",
      "Maintains industry relationships",
    ],
    spot: [
      "Actively engaging on the topic online",
      "Has quality followers and interactions",
    ],
  },
  editorial_instincts: {
    traits: [
      "Creativity",
      "Voice",
      "Judgment, discretion, and ethics",
      "Packaging ability",
      "Marketing and engagement",
      "Accessibility",
    ],
    practice: [
      "Creates good content",
      "Generates engagement",
      "Asks good questions",
      "Brings a creative angle",
    ],
    spot: [
      "Submits a thorough proposal (gives a damn)",
      "Has a varied portfolio (proof of range)",
      "Demonstrates the skill directly",
    ],
  },
  ownership: {
    traits: [
      "Coaching",
      "Reliability",
      "Investment and pride",
      "Attention to detail",
      "Serves their audience",
      "Sense of obligation and commitment",
      "Awareness",
      "Curiosity",
      "Accountability",
    ],
    practice: [
      "Asks questions",
      "Is present",
      "Does the non-traffic-driving work too",
      "Edits",
      "Uses social media",
      "Engages in the comments",
    ],
    spot: [
      "Thoroughness of past work",
      "Social media presence",
      "Proactivity",
      "Communication during outreach",
      "One-on-one performance",
    ],
  },
  leadership: {
    traits: [
      "Motivating and uplifting",
      "Communication",
      "Builds a thriving contributor base",
      "Practices what they preach",
      "Curiosity",
      "Vision and coordination",
      "Coaching",
      "Selflessness / lack of ego",
      "Observation",
    ],
    practice: [
      "Builds relationships",
      "Generates ideas",
      "Shows ambition",
      "Develops contributors",
      "Is receptive to feedback",
      "Puts the team first",
    ],
    spot: [
      "Ideas, examples, and big-picture thinking",
      "Public interaction from employees / underlings",
      "Thoughtfulness",
    ],
  },
};
