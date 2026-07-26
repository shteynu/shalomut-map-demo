import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

// Load staging environment variables
const stagingEnvPath = path.resolve(process.cwd(), ".env.staging.local");
if (fs.existsSync(stagingEnvPath)) {
  dotenv.config({ path: stagingEnvPath, override: true });
}

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaRoundRepository } from "../src/lib/repositories/prisma/prisma-round.repository";
import { PrismaOrganizationRepository } from "../src/lib/repositories/prisma/prisma-organization.repository";
import { PrismaSurveyRepository } from "../src/lib/repositories/prisma/prisma-survey.repository";
import { AnalyticsService } from "../src/lib/services/analytics.service";
import { createSurveyDefinitionHash } from "../src/lib/survey-definition-hash";
import type { SurveyQuestion } from "../src/lib/types/backend";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set in environment to run staging E2E!");
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const orgRepo = new PrismaOrganizationRepository(prisma);
const roundRepo = new PrismaRoundRepository(prisma);
const surveyRepo = new PrismaSurveyRepository(prisma);

const DISPOSABLE_ORG_ID = "org_staging_e2e_a1";
const DISPOSABLE_UNLOCKED_ROUND_ID = "round_staging_e2e_a1_unlocked";
const DISPOSABLE_LOCKED_ROUND_ID = "round_staging_e2e_a2_locked";

// 8 Custom questions mapped to 8 canonical dimensions
const customQuestions = [
  {
    id: "custom-q1-expression",
    dimensionId: "self-expression",
    text: "שאלה מותאמת 1: עד כמה אתה מרגיש חופש ביטוי בקורס?",
    textHebrew: "שאלה מותאמת 1: עד כמה אתה מרגיש חופש ביטוי בקורס?",
    textEnglish: "Custom Q1: Self Expression",
    required: true,
    enabled: true,
    answerMode: "סקאלת צבעים",
  },
  {
    id: "custom-q2-competence",
    dimensionId: "professional-competence",
    text: "שאלה מותאמת 2: עד כמה אתה מרגיש קשוב ומיומן בהוראה?",
    textHebrew: "שאלה מותאמת 2: עד כמה אתה מרגיש קשוב ומיומן בהוראה?",
    textEnglish: "Custom Q2: Pedagogical Competence",
    required: true,
    enabled: true,
    answerMode: "סקאלת צבעים",
  },
  {
    id: "custom-q3-climate",
    dimensionId: "social-resource",
    text: "שאלה מותאמת 3: איך היחסים בצוות החינוכי בבית הספר?",
    textHebrew: "שאלה מותאמת 3: איך היחסים בצוות החינוכי בבית הספר?",
    textEnglish: "Custom Q3: Microclimate",
    required: true,
    enabled: true,
    answerMode: "סקאלת צבעים",
  },
  {
    id: "custom-q4-security",
    dimensionId: "certainty",
    text: "שאלה מותאמת 4: עד כמה אתה מרגיש בטוח בסביבת העבודה?",
    textHebrew: "שאלה מותאמת 4: עד כמה אתה מרגיש בטוח בסביבת העבודה?",
    textEnglish: "Custom Q4: Emotional Security",
    required: true,
    enabled: true,
    answerMode: "סקאלת צבעים",
  },
  {
    id: "custom-q5-autonomy",
    dimensionId: "balance",
    text: "שאלה מותאמת 5: עד כמה יש לך אוטונומיה בקבלת החלטות?",
    textHebrew: "שאלה מותאמת 5: עד כמה יש לך אוטונומיה בקבלת החלטות?",
    textEnglish: "Custom Q5: Autonomy",
    required: true,
    enabled: true,
    answerMode: "סקאלת צבעים",
  },
  {
    id: "custom-q6-workload",
    dimensionId: "management-support",
    text: "שאלה מותאמת 6: עד כמה עומס העבודה מאוזן?",
    textHebrew: "שאלה מותאמת 6: עד כמה עומס העבודה מאוזן?",
    textEnglish: "Custom Q6: Workload Balance",
    required: true,
    enabled: true,
    answerMode: "סקאלת צבעים",
  },
  {
    id: "custom-q7-appreciation",
    dimensionId: "organizational-climate",
    text: "שאלה מותאמת 7: עד כמה אתה מרגיש מוערך על ידי ההנהלה?",
    textHebrew: "שאלה מותאמת 7: עד כמה אתה מרגיש מוערך על ידי ההנהלה?",
    textEnglish: "Custom Q7: Recognition",
    required: true,
    enabled: true,
    answerMode: "סקאלת צבעים",
  },
  {
    id: "custom-q8-meaning",
    dimensionId: "meaning",
    text: "שאלה מותאמת 8: עד כמה תחושת המשמעות גבוהה בעבודתך?",
    textHebrew: "שאלה מותאמת 8: עד כמה תחושת המשמעות גבוהה בעבודתך?",
    textEnglish: "Custom Q8: Meaning & Purpose",
    required: true,
    enabled: true,
    answerMode: "סקאלת צבעים",
  },
];

async function runLiveStagingE2E() {
  console.log("=================================================");
  console.log("  STARTING LIVE STAGING E2E (CONTRACT 3.0)       ");
  console.log("=================================================");

  try {
    // 1. Cleanup any leftover test data
    await cleanupDisposableData();

    // 2. Create Disposable Organization
    console.log(`\n[1/5] Creating Disposable Organization '${DISPOSABLE_ORG_ID}'...`);
    const org = await orgRepo.create({
      id: DISPOSABLE_ORG_ID,
      name: "בית ספר בדיקת E2E Contract 3.0",
      city: "תל אביב",
      schoolType: "מקיף",
      totalStaffCount: 50,
      createdAt: new Date(),
    });
    console.log(`✓ Organization created: ${org?.name} (${org?.id})`);

    // 3. Compute Definition Hash
    const expectedHash = createSurveyDefinitionHash(customQuestions);
    console.log(`✓ Computed Custom Definition Hash: ${expectedHash}`);

    // 4. Create Scenario A1 (Unlocked Round - 10 responses)
    console.log(`\n[2/5] Creating Unlocked Round '${DISPOSABLE_UNLOCKED_ROUND_ID}'...`);
    const unlockedRound = await roundRepo.create({
      id: DISPOSABLE_UNLOCKED_ROUND_ID,
      organizationId: DISPOSABLE_ORG_ID,
      title: "ראבונד ניסיון 3.0 - Unlocked",
      status: "closed",
      shareCode: "STAGING-E2E-A1",
      privacyThreshold: 10,
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-25"),
      createdAt: new Date(),
      backgroundContext: { note: "Disposable Contract 3.0 E2E Unlocked Round" },
      surveyDefinition: {
        title: "ראבונד ניסיון 3.0 - Unlocked",
        audience: "כלל צוות ההוראה",
        estimatedMinutes: 15,
        minimumResponses: 10,
        introText: "שאלון ניסיון מותאם אישית לצוות ההוראה",
        anonymityText: "תשובות אנונימיות לחלוטין ברמת סף פרטיות",
        questions: customQuestions,
      },
    });
    console.log(`✓ Unlocked Round created: ${unlockedRound?.id}`);

    // Insert 10 Survey Responses for Unlocked Round
    console.log("Submitting 10 responses (scores 75-90)...");
    for (let i = 1; i <= 10; i++) {
      const responseId = `resp_a1_${i}`;
      await prisma.surveyResponse.create({
        data: {
          id: responseId,
          roundId: DISPOSABLE_UNLOCKED_ROUND_ID,
          anonymousTokenHash: `hash_token_a1_${i}`,
          submittedAt: new Date(),
          answers: {
            create: customQuestions.map((q) => ({
              id: `ans_a1_${i}_${q.id}`,
              questionId: q.id,
              dimensionId: q.dimensionId,
              value: "green",
              score: 75 + (i % 15), // scores between 75 and 90
            })),
          },
        },
      });
    }
    console.log("✓ 10 responses successfully submitted.");

    // Verify Core Analytics Calculation for Scenario A1
    console.log("\n[3/5] Verifying Core Dynamic Analytics for Scenario A1...");
    const analyticsA1 = await AnalyticsService.getAnalyticsForRound(
      DISPOSABLE_UNLOCKED_ROUND_ID,
      roundRepo,
      surveyRepo,
    );
    console.log("Analytics A1 Result:", {
      contractVersion: analyticsA1?.contractVersion,
      isLocked: analyticsA1?.isLocked,
      totalResponses: analyticsA1?.totalResponses,
      surveyDefinitionHash: analyticsA1?.surveyDefinitionHash,
      dimensionScoresCount: Object.keys(analyticsA1?.dimensionScores || {}).length,
      questionAggregatesCount: Object.keys(analyticsA1?.questionAggregates || {}).length,
    });

    if (
      analyticsA1?.contractVersion !== "3.0" ||
      analyticsA1?.isLocked !== false ||
      analyticsA1?.totalResponses !== 10 ||
      analyticsA1?.surveyDefinitionHash !== expectedHash ||
      Object.keys(analyticsA1?.dimensionScores || {}).length !== 8 ||
      Object.keys(analyticsA1?.questionAggregates || {}).length !== 8
    ) {
      throw new Error("Analytics A1 validation failed!");
    }
    console.log("✓ Scenario A1 Core Dynamic Analytics PASSED!");

    // 5. Create Scenario A2 (Privacy Locked Round - 9 responses < 10 threshold)
    console.log(`\n[4/5] Creating Locked Round '${DISPOSABLE_LOCKED_ROUND_ID}'...`);
    const lockedRound = await roundRepo.create({
      id: DISPOSABLE_LOCKED_ROUND_ID,
      organizationId: DISPOSABLE_ORG_ID,
      title: "ראבונד ניסיון 3.0 - Privacy Locked",
      status: "closed",
      shareCode: "STAGING-E2E-A2",
      privacyThreshold: 10,
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-25"),
      createdAt: new Date(),
      backgroundContext: { note: "Disposable Contract 3.0 E2E Locked Round" },
      surveyDefinition: {
        title: "ראבונד ניסיון 3.0 - Privacy Locked",
        audience: "כלל צוות ההוראה",
        estimatedMinutes: 15,
        minimumResponses: 10,
        introText: "שאלון ניסיון מותאם אישית לצוות ההוראה",
        anonymityText: "תשובות אנונימיות לחלוטין ברמת סף פרטיות",
        questions: customQuestions,
      },
    });

    // Insert 9 Responses (< 10 threshold)
    for (let i = 1; i <= 9; i++) {
      await prisma.surveyResponse.create({
        data: {
          id: `resp_a2_${i}`,
          roundId: DISPOSABLE_LOCKED_ROUND_ID,
          anonymousTokenHash: `hash_token_a2_${i}`,
          submittedAt: new Date(),
          answers: {
            create: customQuestions.map((q) => ({
              id: `ans_a2_${i}_${q.id}`,
              questionId: q.id,
              dimensionId: q.dimensionId,
              value: "green",
              score: 80,
            })),
          },
        },
      });
    }

    const analyticsA2 = await AnalyticsService.getAnalyticsForRound(
      DISPOSABLE_LOCKED_ROUND_ID,
      roundRepo,
      surveyRepo,
    );
    console.log("Analytics A2 (Locked) Result:", {
      contractVersion: analyticsA2?.contractVersion,
      isLocked: analyticsA2?.isLocked,
      totalResponses: analyticsA2?.totalResponses,
      dimensionScores: analyticsA2?.dimensionScores,
      questionAggregates: analyticsA2?.questionAggregates,
    });

    if (
      analyticsA2?.isLocked !== true ||
      Object.keys(analyticsA2?.dimensionScores || {}).length !== 0 ||
      Object.keys(analyticsA2?.questionAggregates || {}).length !== 0
    ) {
      throw new Error("Analytics A2 Privacy Lock validation failed!");
    }
    console.log("✓ Scenario A2 Privacy Lock PASSED!");

    // 6. Cleanup Staging Database
    console.log("\n[5/5] Executing Automated Cleanup of Disposable Records...");
    await cleanupDisposableData();
    console.log("✓ Cleanup Complete. Zero disposable records remaining in Staging DB.");

    console.log("\n=================================================");
    console.log("  LIVE STAGING E2E VERIFICATION COMPLETED: PASS  ");
    console.log("=================================================");
  } catch (error) {
    console.error("❌ LIVE STAGING E2E ERROR:", error);
    await cleanupDisposableData();
    process.exit(1);
  } finally {
    if (typeof prisma.$disconnect === "function") {
      await prisma.$disconnect();
    }
  }
}

async function cleanupDisposableData() {
  await prisma.questionAnswer.deleteMany({
    where: { response: { roundId: { startsWith: "round_staging_e2e_" } } },
  });
  await prisma.surveyResponse.deleteMany({
    where: { roundId: { startsWith: "round_staging_e2e_" } },
  });
  await prisma.surveyRound.deleteMany({
    where: { id: { startsWith: "round_staging_e2e_" } },
  });
  await prisma.organization.deleteMany({
    where: { id: { startsWith: "org_staging_e2e_" } },
  });
}

runLiveStagingE2E();
