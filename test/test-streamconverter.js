const {convertFile} = require('./streamconverter');
const file = require('sdk/io/file');

exports['test fileconverter'] = function(assert) {
	var filePath = './test.gz'; //TODO
	var uncompressed = convertFile(filePath, 'gzip', 'uncompressed');
	assert.equal(uncompressed, 'test\n');
};

require('sdk/test').run(exports);