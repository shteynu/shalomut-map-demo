import assert from "node:assert";
import test from "node:test";
import { InMemoryRoundRepository } from "@/lib/repositories";
import { RoundService } from "@/lib/services";
import { surveyInstrument } from "@/lib/shalomut-source";
import {
  createCanonicalSurveyDefinition,
  isActivatableSurveyDefinition,
} from "@/lib/survey-definition";

/**
 * What a new round arrives with.
 *
 * Until 2026-08-09 it arrived with `questions: []`. The manager had to open the
 * builder and press `טעינת תבנית` before the round could go live, and "a
 * questionnaire is generated for the new round" was true of no creation path.
 * It now arrives with the standard questionnaire.
 *
 * The half that is easy to lose is the status. The seeded questionnaire covers
 * all eight dimensions, so the old rule — active as soon as the questionnaire
 * is activatable — would have made every new round go live the moment it was
 * created, closing the round the school was still collecting answers on, with a
 * questionnaire nobody had read. The round is a draft until someone saves it.
 */

test("a new round arrives with the standard questionnaire", () => {
  const round = RoundService.createRound({
    organizationId: "org-1",
    title: "סבב חדש",
  });

  assert.strictEqual(
    round.surveyDefinition?.questions.length,
    surveyInstrument.questions.length,
  );
  assert.ok(round.surveyDefinition?.questions.every((q) => q.enabled));
});

test("that questionnaire is ready to go live, and the round still is not", () => {
  const round = RoundService.createRound({
    organizationId: "org-1",
    title: "סבב חדש",
  });

  // Both halves matter together: complete enough to activate, and not activated.
  assert.strictEqual(isActivatableSurveyDefinition(round.surveyDefinition!), true);
  assert.strictEqual(round.status, "draft");
});

test("opening a round does not close the one the school is collecting on", async () => {
  const roundRepo = new InMemoryRoundRepository();
  const running = await RoundService.createAndSaveRound(
    {
      organizationId: "org-1",
      title: "הסבב הרץ",
      surveyDefinition: createCanonicalSurveyDefinition("הסבב הרץ", 10),
    },
    roundRepo,
  );
  assert.strictEqual(running.status, "active");

  await RoundService.createAndSaveRound(
    { organizationId: "org-1", title: "סבב חדש" },
    roundRepo,
  );

  // The property this whole change hangs on. A manager opening next term's
  // round has not ended this term's collection by doing so.
  assert.strictEqual((await roundRepo.findById(running.id))?.status, "active");
});

test("a caller who brings its own finished questionnaire still opens a live round", () => {
  // The builder and the seeding script choose the questionnaire deliberately,
  // and that is what being born active means.
  const round = RoundService.createRound({
    organizationId: "org-1",
    title: "סבב מוכן",
    surveyDefinition: createCanonicalSurveyDefinition("סבב מוכן", 10),
  });

  assert.strictEqual(round.status, "active");
});

test("a caller who brings an unfinished questionnaire is not given the standard one", () => {
  // Seeding is for callers with nothing. A half-built questionnaire is a
  // decision already taken, and replacing it would discard it.
  const round = RoundService.createRound({
    organizationId: "org-1",
    title: "סבב בבנייה",
    surveyDefinition: {
      ...createCanonicalSurveyDefinition("סבב בבנייה", 10),
      questions: [],
    },
  });

  assert.strictEqual(round.surveyDefinition?.questions.length, 0);
  assert.strictEqual(round.status, "draft");
});

test("the seeded questionnaire tells respondents who the round asked", () => {
  const round = RoundService.createRound({
    organizationId: "org-1",
    title: "סבב חדש",
    backgroundContext: {
      notes: "",
      audience: "teachers",
      sicknessDaysThisQuarter: 0,
      newStaffMembers: 0,
      studentCount: 300,
      socioEconomicIndex: 5,
      classesPerGrade: { א: 2 },
    },
  });

  // The setup screen owns the audience; the questionnaire mirrors it, so the
  // two screens cannot disagree about who was asked.
  assert.strictEqual(round.surveyDefinition?.audience, "צוות הוראה בלבד");
});

test("without a stated audience the questionnaire says the whole staff", () => {
  const round = RoundService.createRound({
    organizationId: "org-1",
    title: "סבב חדש",
  });

  assert.strictEqual(round.surveyDefinition?.audience, "כלל צוות בית הספר");
});
