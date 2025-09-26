const { runPlannerRegressionSuite } = require('./manual-planner-debug');

const results = runPlannerRegressionSuite({ log: true });
const failed = results.filter(result => !result.success);

if (failed.length > 0) {
	console.error(`Planner regression suite failed (${failed.length} scenario${failed.length === 1 ? '' : 's'})`);
	process.exitCode = 1;
} else {
	console.log('Planner regression suite passed.');
}
