const { t } = require('./i18n');

function createReloadSummary(outcome) {
	const headingKey = outcome.success
		? 'commands.reload.complete'
		: 'commands.reload.partial';
	const lines = outcome.stages.map(stage => t(
		outcome.locale,
		stage.success
			? 'commands.reload.stageSuccess'
			: 'commands.reload.stageFailure',
		{
			stage: t(
				outcome.locale,
				`commands.reload.stages.${stage.id}`,
			),
		},
	));
	return [
		t(outcome.locale, headingKey),
		...lines,
	].join('\n');
}

module.exports = { createReloadSummary };
