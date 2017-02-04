const troff = require('./troff');

exports['test splitArgs'] = function(assert) {
	var test = 'man\\ \\ \\-a \\ intro "foo bar" "baz"';
	assert.deepEqual(troff.splitArgs(test), ['man  \\-a', ' intro', 'foo bar', 'baz'])
};

require('sdk/test').run(exports);