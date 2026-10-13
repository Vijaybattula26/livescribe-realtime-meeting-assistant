import dotenv from 'dotenv';
dotenv.config({ override: true });
import { extractMeetingState } from '../server/services/geminiExtractor.js';
import { ActionItem, DecisionItem } from '../server/schema.js';
import { computeSimilarity } from '../src/utils/mergeActionItems.js';

interface TestCase {
  id: string;
  name: string;
  transcript: string;
  knownTerms?: string[];
  existingState?: {
    summary?: string;
    decisions?: DecisionItem[];
    actionItems?: ActionItem[];
    openQuestions?: string[];
  };
  expected: {
    minTasks?: number;
    maxTasks?: number;
    tasks?: Array<{
      taskKeywords: string[];
      owner: string | null;
      deadlineKeyword?: string | null;
      status?: 'open' | 'done';
    }>;
    decisionsCount?: number;
    questionsCount?: number;
  };
}

const TEST_CASES: TestCase[] = [
  {
    id: 'TC-1',
    name: 'Clear explicit tasks',
    transcript: 'Ravi will send the revenue report by Friday. Priya will schedule the client demo for next Tuesday.',
    knownTerms: ['Ravi', 'Priya'],
    expected: {
      minTasks: 2,
      maxTasks: 2,
      tasks: [
        { taskKeywords: ['revenue', 'report'], owner: 'Ravi', deadlineKeyword: 'friday', status: 'open' },
        { taskKeywords: ['client', 'demo'], owner: 'Priya', deadlineKeyword: 'tuesday', status: 'open' },
      ],
    },
  },
  {
    id: 'TC-2',
    name: 'No tasks (zero hallucinations check)',
    transcript: 'The weather in Seattle is unusually sunny this October. Yes, the autumn foliage is quite vibrant this year.',
    expected: {
      minTasks: 0,
      maxTasks: 0,
      tasks: [],
    },
  },
  {
    id: 'TC-3',
    name: 'Duplicate mentions (merge / deduplication check)',
    transcript: 'Just confirming what was said earlier, Ravi is sending over that revenue report on Friday.',
    existingState: {
      actionItems: [
        {
          id: 'act-existing-1',
          task: 'Send revenue report',
          owner: 'Ravi',
          deadline: 'Friday',
          resolvedDeadline: '2026-10-16T17:00:00.000Z',
          priority: 'medium',
          status: 'open',
          confidence: 0.95,
          sourceQuote: 'Ravi will send the revenue report by Friday.',
        },
      ],
    },
    expected: {
      minTasks: 1,
      maxTasks: 1,
      tasks: [
        { taskKeywords: ['revenue', 'report'], owner: 'Ravi', deadlineKeyword: 'friday', status: 'open' },
      ],
    },
  },
  {
    id: 'TC-4',
    name: 'Completed task status update',
    transcript: 'Ravi just emailed the revenue report, so that action item is finished.',
    existingState: {
      actionItems: [
        {
          id: 'act-existing-1',
          task: 'Send revenue report',
          owner: 'Ravi',
          deadline: 'Friday',
          resolvedDeadline: '2026-10-16T17:00:00.000Z',
          priority: 'medium',
          status: 'open',
          confidence: 0.95,
          sourceQuote: 'Ravi will send the revenue report by Friday.',
        },
      ],
    },
    expected: {
      minTasks: 1,
      maxTasks: 1,
      tasks: [
        { taskKeywords: ['revenue', 'report'], owner: 'Ravi', status: 'done' },
      ],
    },
  },
  {
    id: 'TC-5',
    name: 'Ambiguous owner (must be null)',
    transcript: 'Someone needs to back up the staging database before midnight.',
    expected: {
      minTasks: 1,
      maxTasks: 1,
      tasks: [
        { taskKeywords: ['database', 'staging'], owner: null, deadlineKeyword: 'midnight' },
      ],
    },
  },
  {
    id: 'TC-6',
    name: 'Misheard name WITHOUT known-names list',
    transcript: 'Rabi will prepare the financial presentation for the board.',
    knownTerms: [], // No known list provided
    expected: {
      minTasks: 1,
      maxTasks: 1,
      tasks: [
        // Without known list, owner should be Rabi or null, never hallucinated Ravi
        { taskKeywords: ['financial', 'presentation'], owner: 'Rabi' },
      ],
    },
  },
  {
    id: 'TC-7',
    name: 'Misheard name WITH known-names list',
    transcript: 'Rabi will prepare the financial presentation for the board.',
    knownTerms: ['Ravi', 'Priya', 'LiveScribe'], // Known list has Ravi
    expected: {
      minTasks: 1,
      maxTasks: 1,
      tasks: [
        // With known list, "Rabi" is corrected to "Ravi"
        { taskKeywords: ['financial', 'presentation'], owner: 'Ravi' },
      ],
    },
  },
  {
    id: 'TC-8',
    name: 'Relative deadline parsing',
    transcript: 'I will update the project plan by tomorrow evening.',
    expected: {
      minTasks: 1,
      maxTasks: 1,
      tasks: [
        { taskKeywords: ['project', 'plan'], owner: null, deadlineKeyword: 'tomorrow evening' },
      ],
    },
  },
  {
    id: 'TC-9',
    name: 'Decision plus open question',
    transcript: 'We decided to postpone the website launch to November. Does anyone know if the budget is approved?',
    expected: {
      minTasks: 0,
      maxTasks: 0,
      decisionsCount: 1,
      questionsCount: 1,
    },
  },
];

async function runEvaluationSuite() {
  console.log('========================================================================');
  console.log('🚀 LiveScribe Extraction Evaluation Suite (9 synthetic text scenarios written by developer)');
  console.log('   Model: gemini-3.1-flash-lite (structured extraction via zod)');
  console.log('   Note: Measures regression across developer-authored test cases only.');
  console.log('   Timestamp: ' + new Date().toISOString());
  console.log('========================================================================\n');

  let totalExpectedTasks = 0;
  let totalExtractedTasks = 0;
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let wrongOwners = 0;
  let wrongDeadlines = 0;

  const resultsTable: Array<{
    id: string;
    name: string;
    expectedTasks: number;
    actualTasks: number;
    tp: number;
    fp: number;
    fn: number;
    ownerMatch: string;
    deadlineMatch: string;
    status: 'PASS' | 'FAIL';
  }> = [];

  for (const tc of TEST_CASES) {
    console.log(`Running [${tc.id}] ${tc.name}...`);

    const payload = {
      newTranscript: tc.transcript,
      currentSummary: tc.existingState?.summary || '',
      currentDecisions: tc.existingState?.decisions || [],
      currentActionItems: tc.existingState?.actionItems || [],
      currentOpenQuestions: tc.existingState?.openQuestions || [],
      knownTerms: tc.knownTerms || [],
      userTimezone: 'UTC',
      referenceDate: '2026-10-13T10:00:00.000Z',
    };

    const extracted = await extractMeetingState(payload);

    const expTasks = tc.expected.tasks || [];
    const actTasks = extracted.actionItems || [];

    totalExpectedTasks += expTasks.length;
    totalExtractedTasks += actTasks.length;

    let testTp = 0;
    let testFp = 0;
    let testFn = 0;
    let testOwnerMatch = true;
    let testDeadlineMatch = true;

    // Evaluate matching
    const matchedActual = new Set<number>();

    for (const exp of expTasks) {
      let matchedIdx = -1;
      for (let i = 0; i < actTasks.length; i++) {
        if (matchedActual.has(i)) continue;
        const act = actTasks[i];
        const taskLower = act.task.toLowerCase();
        const hasKeywords = exp.taskKeywords.every((kw) => taskLower.includes(kw.toLowerCase()));
        if (hasKeywords) {
          matchedIdx = i;
          break;
        }
      }

      if (matchedIdx !== -1) {
        testTp++;
        matchedActual.add(matchedIdx);
        const matchedAct = actTasks[matchedIdx];

        // Owner check
        if (exp.owner !== undefined) {
          const actOwnerLower = matchedAct.owner?.toLowerCase()?.trim() || null;
          const expOwnerLower = exp.owner?.toLowerCase()?.trim() || null;
          if (actOwnerLower !== expOwnerLower) {
            testOwnerMatch = false;
            wrongOwners++;
          }
        }

        // Deadline check
        if (exp.deadlineKeyword) {
          const dlLower = matchedAct.deadline?.toLowerCase() || '';
          if (!dlLower.includes(exp.deadlineKeyword.toLowerCase())) {
            testDeadlineMatch = false;
            wrongDeadlines++;
          }
        }

        // Status check
        if (exp.status && matchedAct.status !== exp.status) {
          testDeadlineMatch = false;
        }
      } else {
        testFn++;
      }
    }

    testFp = actTasks.length - matchedActual.size;

    truePositives += testTp;
    falsePositives += testFp;
    falseNegatives += testFn;

    // Decision & question checks if specified
    if (tc.expected.decisionsCount !== undefined) {
      if (extracted.decisions.length !== tc.expected.decisionsCount) {
        testDeadlineMatch = false;
      }
    }
    if (tc.expected.questionsCount !== undefined) {
      if (extracted.openQuestions.length !== tc.expected.questionsCount) {
        testDeadlineMatch = false;
      }
    }

    const testPassed = testFn === 0 && testFp === 0 && testOwnerMatch;

    resultsTable.push({
      id: tc.id,
      name: tc.name,
      expectedTasks: expTasks.length,
      actualTasks: actTasks.length,
      tp: testTp,
      fp: testFp,
      fn: testFn,
      ownerMatch: testOwnerMatch ? 'YES' : 'NO',
      deadlineMatch: testDeadlineMatch ? 'YES' : 'NO',
      status: testPassed ? 'PASS' : 'FAIL',
    });
  }

  const precision =
    truePositives + falsePositives > 0
      ? (truePositives / (truePositives + falsePositives)) * 100
      : 100;

  const recall =
    truePositives + falseNegatives > 0
      ? (truePositives / (truePositives + falseNegatives)) * 100
      : 100;

  console.log('\n========================================================================');
  console.log('📊 EVALUATION RESULTS SUMMARY TABLE');
  console.log('========================================================================');
  console.table(resultsTable);

  console.log('------------------------------------------------------------------------');
  console.log(`TOTAL EXPECTED TASKS:       ${totalExpectedTasks}`);
  console.log(`TOTAL EXTRACTED TASKS:      ${totalExtractedTasks}`);
  console.log(`TRUE POSITIVES (TP):        ${truePositives}`);
  console.log(`FALSE POSITIVES (FP / Hallucinations): ${falsePositives}`);
  console.log(`FALSE NEGATIVES (FN / Missed):         ${falseNegatives}`);
  console.log(`WRONG OWNERS:               ${wrongOwners}`);
  console.log(`WRONG DEADLINES:            ${wrongDeadlines}`);
  console.log(`PRECISION:                  ${precision.toFixed(1)}%`);
  console.log(`RECALL:                     ${recall.toFixed(1)}%`);
  console.log('------------------------------------------------------------------------');

  if (precision >= 85 && recall >= 85) {
    console.log('🎯 EVALUATION SUITE: PASS (Precision >= 85%, Recall >= 85%)\n');
  } else {
    console.error('❌ EVALUATION SUITE: FAIL (Precision or Recall below 85%)\n');
    process.exit(1);
  }
}

runEvaluationSuite().catch((err) => {
  console.error('Evaluation failed with error:', err);
  process.exit(1);
});
