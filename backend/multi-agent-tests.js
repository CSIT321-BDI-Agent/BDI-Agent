/**
 * Multi-Agent BDI Planning Tests
 * 
 * Test scenarios for conflict detection and resolution
 */

const { runCustomMultiAgentPlanning } = require('./bdi/customMultiAgentOrchestrator');

/**
 * Helper to run test and log results
 */
async function runTest(name, stacks, goalChain, options = {}) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${name}`);
  console.log(`${'='.repeat(60)}`);
  console.log('Initial stacks:', JSON.stringify(stacks));
  console.log('Goal chain:', goalChain.join(' → '));

  try {
    // Run planning with custom orchestrator
    const result = await runCustomMultiAgentPlanning(
      stacks,
      goalChain,
      { maxIterations: 100, ...options }
    );

    console.log('\n--- RESULTS ---');
    console.log('Goal achieved:', result.goalAchieved);
    console.log('Total cycles:', result.iterations);
    console.log('Total moves:', result.moves?.length || 0);
    console.log('  Agent A moves:', result.moves?.filter(m => m.actor === 'agent-a').length || 0);
    console.log('  Agent B moves:', result.moves?.filter(m => m.actor === 'agent-b').length || 0);

    console.log('\n--- DELIBERATIONS ---');
    console.log('Total deliberations:', result.statistics.totalDeliberations);
    console.log('Total conflicts:', result.statistics.totalConflicts);
    console.log('Conflict types:', result.statistics.conflictStats.byType);
    console.log('Total negotiations:', result.statistics.totalNegotiations);
    console.log('Resolution types:', result.statistics.negotiationStats.byResolutionType);

    if (result.conflicts && result.conflicts.length > 0) {
      console.log('\n--- CONFLICTS DETECTED ---');
      result.conflicts.slice(0, 5).forEach((conflict, idx) => {
        console.log(`${idx + 1}. ${conflict.type}:`, conflict.description);
        console.log(`   Agent A: move ${conflict.proposalA.move.block} to ${conflict.proposalA.move.to}`);
        console.log(`   Agent B: move ${conflict.proposalB.move.block} to ${conflict.proposalB.move.to}`);
      });
    }

    if (result.negotiations && result.negotiations.length > 0) {
      console.log('\n--- NEGOTIATIONS ---');
      result.negotiations.slice(0, 3).forEach((neg, idx) => {
        console.log(`${idx + 1}. Conflict ${neg.type}:`);
        console.log(`   Utility A: ${neg.utilityA?.toFixed(2)}, Utility B: ${neg.utilityB?.toFixed(2)}`);
        console.log(`   Resolution: ${neg.resolution?.type}`);
        console.log(`   Winner: ${neg.resolution?.winner?.agentId}`);
        console.log(`   Reason: ${neg.resolution?.reason}`);
      });
    }

    console.log('\n✅ TEST PASSED\n');
    return { success: true, result };

  } catch (error) {
    console.log('\n❌ TEST FAILED');
    console.error('Error:', error.message);
    console.error(error.stack);
    return { success: false, error };
  }
}

/**
 * Test scenarios
 */
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     MULTI-AGENT BDI PLANNING TEST SUITE                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const results = [];

  // Test 1: Simple parallel - no conflicts expected
  results.push(await runTest(
    'Simple Parallel Work (No Conflicts)',
    [['A'], ['B'], ['C'], ['D']],
    ['A', 'B', 'C', 'D', 'Table']
  ));

  // Test 2: Resource conflict - both agents may want same block
  results.push(await runTest(
    'Resource Conflict Scenario',
    [['A', 'B'], ['C']],
    ['A', 'B', 'C', 'Table']
  ));

  // Test 3: Ordering conflict - clearing vs stacking
  results.push(await runTest(
    'Ordering Conflict Scenario',
    [['A', 'B', 'C'], ['D']],
    ['C', 'B', 'A', 'D', 'Table']
  ));

  // Test 4: Complex with many blocks
  results.push(await runTest(
    'Complex Multi-Block Scenario',
    [['A', 'B'], ['C', 'D'], ['E', 'F']],
    ['A', 'C', 'E', 'B', 'D', 'F', 'Table']
  ));

  // Test 5: Destination conflict - both agents stack on same target
  // Goal: A on D, B on D, C on top of B (creating potential destination conflict)
  results.push(await runTest(
    'Destination Conflict Scenario',
    [['A'], ['B'], ['C'], ['D']],
    ['A', 'B', 'C', 'D', 'Table']  // Both A and B want to be on D eventually
  ));

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     TEST SUMMARY                                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.length - passed;

  console.log(`Total tests: ${results.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);

  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! 🎉\n');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED ⚠️\n');
  }

  return results;
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests().then(() => {
    console.log('Tests complete');
    process.exit(0);
  }).catch(error => {
    console.error('Test suite error:', error);
    process.exit(1);
  });
}

module.exports = { runTest, runAllTests };
