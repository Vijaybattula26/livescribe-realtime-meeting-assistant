import dotenv from 'dotenv';
dotenv.config({ override: true });
import { extractMeetingState } from '../server/services/geminiExtractor.js';
import { mergeActionItems } from '../src/utils/mergeActionItems.js';
import { ExtractionRequest } from '../server/schema.js';

async function runExtractionTests() {
  console.log('=== STEP 3: EXTRACTION VERIFICATION ===\n');

  // Test 1: Fixed sample transcript
  const samplePayload: ExtractionRequest = {
    newTranscript: 'Ravi will send the revenue report by Friday. Priya decided to approve the Q3 budget.',
    currentSummary: '',
    currentDecisions: [],
    currentActionItems: [],
    currentOpenQuestions: [],
  };

  console.log('1. Calling extractMeetingState with sample transcript:');
  console.log(`   "${samplePayload.newTranscript}"`);
  const result = await extractMeetingState(samplePayload);
  console.log('   Result JSON:');
  console.log(JSON.stringify(result, null, 2));

  // Test 2: Repeat call with deduplication and manual edit protection
  console.log('\n2. Testing repeat call, deduplication, and manual edit protection...');
  const manualItem = {
    id: 'manual-1',
    task: 'Manually edited task that must never be overwritten',
    owner: 'Ravi',
    deadline: 'Next Monday',
    priority: 'high' as const,
    status: 'open' as const,
    confidence: 1.0,
    sourceQuote: 'Manually added by user',
    isManual: true,
  };

  const payloadWithExisting: ExtractionRequest = {
    newTranscript: 'Ravi mentioned again he will send the revenue report by Friday.',
    currentSummary: result.summary,
    currentDecisions: result.decisions,
    currentActionItems: [...result.actionItems, manualItem],
    currentOpenQuestions: result.openQuestions,
  };

  const updatedResult = await extractMeetingState(payloadWithExisting);
  const mergedItems = mergeActionItems([...result.actionItems, manualItem], updatedResult.actionItems);

  console.log(`   Initial items count: ${result.actionItems.length + 1}`);
  console.log(`   Merged items count:  ${mergedItems.length}`);
  const manualPreserved = mergedItems.find((i) => i.id === 'manual-1');
  console.log(`   Manual item preserved: ${manualPreserved?.task === manualItem.task ? 'YES' : 'NO'}`);

  // Test 3: 5 Regression transcripts
  console.log('\n3. Running regression on 5 transcripts:');
  const testCases = [
    {
      name: 'Clear tasks',
      transcript: 'Alice will prepare the presentation by tomorrow morning. Bob will email the clients by 5 PM.',
      expected: '2 action items',
    },
    {
      name: 'No tasks (general banter)',
      transcript: 'The weather today is really nice. Did everyone watch the football match over the weekend?',
      expected: '0 action items',
    },
    {
      name: 'Duplicate mentions',
      transcript: 'Alice will prepare the presentation tomorrow. Later in the meeting: Alice confirmed she is preparing the presentation for tomorrow.',
      expected: '1 merged action item',
    },
    {
      name: 'A completed task',
      transcript: 'Bob has already sent the email to the clients this morning, so that is done.',
      expected: 'status: done or completed',
    },
    {
      name: 'Ambiguous owner',
      transcript: 'Someone should probably look into why the test pipeline failed yesterday.',
      expected: 'null or unassigned owner',
    },
  ];

  for (const tc of testCases) {
    const res = await extractMeetingState({
      newTranscript: tc.transcript,
      currentSummary: '',
      currentDecisions: [],
      currentActionItems: [],
      currentOpenQuestions: [],
    });
    console.log(`   - [${tc.name}]: Produced ${res.actionItems.length} action item(s), ${res.decisions.length} decision(s), ${res.openQuestions.length} question(s). Expected: ${tc.expected}`);
  }

  console.log('\n=== EXTRACTION VERIFICATION COMPLETE ===');
}

runExtractionTests().catch((err) => {
  console.error('Extraction tests failed:', err);
  process.exit(1);
});
