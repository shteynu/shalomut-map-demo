import type { HelpTranslation } from "@/lib/help/types";
import type { WellbeingStatus } from "@/lib/shalomut-source";

/**
 * The guide in English, translated from `he.ts`. Same rule as the Russian file:
 * a correction is made in the Hebrew original and brought across, so the three
 * cannot quietly say different things.
 */
const colourWords: Record<WellbeingStatus, string> = {
  green: "green",
  yellow: "yellow",
  red: "red",
};

export const englishHelp: HelpTranslation = {
  intro: {
    eyebrow: "Manager guide",
    title: "How the system works",
    description:
      "Answers to the questions the screens raise: when a result is locked and why, how a stone gets its colour, what the AI writes and what it does not decide, and what is stored about the people who answered.",
    badgeTitle: "Questions the screens raise",
    wholeGuide: "Open the full guide",
    languageLabel: "Language",
  },

  topics: ({ threshold, bands, removeLabel }) => [
    {
      id: "privacy",
      title: "Why is the result locked?",
      summary:
        `So that nobody can tell who answered what. Until at least ${threshold} ` +
        `answers have arrived, the map stays locked whole.`,
      points: [
        `${threshold} respondents is both the default and the minimum. You can raise the threshold for your school; you cannot lower it.`,
        "The lock is all or nothing: if even one question is short of answers, the whole detailed result stays closed. Hiding a single question would let the missing answers be worked out from what was shown.",
        "The number of respondents is always shown, even while the result is locked — so you can see how far off it is.",
        "What you can do: extend collection and ask the staff room again. There is no way to open the result earlier, and that is the point.",
      ],
    },
    {
      id: "colors",
      title: "How does a stone get its colour?",
      summary:
        "Plain arithmetic, not artificial intelligence. Every answer becomes a " +
        "number from 0 to 100, and the average across one side's questions sets the colour.",
      points: [
        `The boundaries are the same for every school: ${bands
          .map((band) => `${colourWords[band.status]} — ${band.min} to ${band.max}`)
          .join("; ")}.`,
        "The same average always yields the same colour. The text written about a stone cannot change it.",
        "A green stone does not mean we are finished here. It is a strength to preserve, and the actions offered for it are actions that maintain it, not improvement goals.",
        "A red stone is nobody's failure. It is an area that needs care, and it is worded that way.",
        "Every colour is accompanied by a status in words, so the map can be read without relying on colour.",
      ],
    },
    {
      id: "ai",
      title: "What does the AI write, and what does it not decide?",
      summary:
        "It writes the words only. The numbers, the colours and the statuses are " +
        "calculated before it is called, and it cannot change them.",
      points: [
        "It receives averages only. No individual's answer and no background detail reaches it.",
        "Recommendations are chosen from a catalog of interventions written by professionals; only the wording is adapted to your round.",
        "If the tool could not write, the screen says so. No filler text is shown in place of an analysis that did not happen.",
        "Sometimes a paragraph is written by the system itself, from the data alone and with no language model. When that happens the screen states plainly that the text was not written by the AI.",
        "The tool does not establish causes. It describes a state and suggests directions; what is happening in the school is yours to interpret.",
      ],
    },
    {
      id: "round",
      title: "What happens when a round is closed?",
      summary:
        "Closing the round is what orders the analysis. While a round is open the " +
        "picture is still moving, so there is no analysis mid-collection.",
      points: [
        "From the moment it closes, the round accepts no further answers.",
        "The analysis is not instant: it takes a few minutes, and the map appears when it finishes. You can leave the screen and come back.",
        "A school has one active round at a time. Starting a new one closes the previous one, so that two links are never circulating in one staff room.",
        "You can ask for another analysis of a round that is already closed. That is a second opinion on the same data, not an analysis of new answers.",
        "If an analysis fails, the system does not try again by itself. Asking again is yours to do, and that is deliberate.",
      ],
    },
    {
      id: "questionnaire",
      title: "Why can't the questionnaire be changed mid-round?",
      summary:
        "Once the first answer arrives, the round's questions freeze. If half the " +
        "staff answered one wording and half another, an average over them means nothing.",
      points: [
        "Before the first answer you may edit freely, and every save is kept as a version you can return to.",
        "All eight sides must be covered by at least one question. Until then the round stays a draft and issues no link.",
        "Background questions — age, tenure, role, workload — are not scored and move no stone. They exist only for the breakdown by group.",
        "Want to change questions after collection has started? That is a new round, not an edit of this one.",
      ],
    },
    {
      id: "goals",
      title: "What happens to a goal I chose?",
      summary:
        "The goal is saved with the wording that was on screen at the moment you " +
        "chose it, and it belongs to the school rather than to the round.",
      points: [
        "A new analysis rewrites the recommendations but does not delete a goal already chosen. It stays, marked as chosen from an earlier analysis.",
        "A goal has no owner and no due date. That is deliberate: measurement is not a task-management system.",
        "No number is shown beside a goal. A stone's change is not that goal's result, and showing them together would imply a link nobody can prove.",
        `The '${removeLabel}' button deletes the goal and cannot be undone: there is no 'cancelled' status and no archive, and no record remains that the goal was ever chosen. The recommendation itself becomes available again and can be chosen as a new goal.`,
        "Resetting a round also deletes the goals chosen in it. A reset declares that this round measured nothing, so it removes both the answers and what was chosen on the strength of them.",
      ],
    },
    {
      id: "data",
      title: "What is stored about respondents?",
      summary:
        "No name, no e-mail, no personal identifier. Those fields do not exist in " +
        "the system — not merely unused.",
      points: [
        "What is stored: the answers themselves, when they were sent, and a random label for the filling session whose only purpose is to prevent double counting.",
        "The label identifies neither a person nor a device, and is cleared between people at a shared computer.",
        "What leaves for the analysis service is averages and the text of the questions, nothing else. Background questions do not leave at all.",
        "In a breakdown by group, every cell that is too small is hidden — and hidden in a way that cannot be recovered from the totals that are shown.",
        "There is not and will not be a way to remove a respondent from the calculation. Two results for one round, one with everybody and one without them, would reveal exactly what that person answered.",
      ],
    },
  ],
};
