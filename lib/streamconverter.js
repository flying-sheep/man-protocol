//https://blog.mozilla.org/nfroyd/2012/01/26/compressing-strings-in-js/
//http://adblockplus.org/blog/using-asynchronous-file-i-o-in-gecko

const { Class } = require('sdk/core/heritage')
const { Unknown } = require('sdk/platform/xpcom')
const { CC, Ci, Cc } = require('chrome')
const { TextReader } = require('sdk/io/file')
const { defer } = require('sdk/core/promise')

const { requireJSM } = require('./jsm')

const { XPCOMUtils } = requireJSM('resource://gre/modules/XPCOMUtils.jsm')
const { NetUtil } = requireJSM('resource://gre/modules/NetUtil.jsm')

const ThreadManager = Cc['@mozilla.org/thread-manager;1'].getService(Ci.nsIThreadManager)

const MozFile = CC('@mozilla.org/file/local;1', 'nsILocalFile', 'initWithPath')
const StringInputStream = CC('@mozilla.org/io/string-input-stream;1', 'nsIStringInputStream')
const FileInputStream = CC('@mozilla.org/network/file-input-stream;1', 'nsIFileInputStream', 'init')
const InputStreamPump = CC('@mozilla.org/network/input-stream-pump;1', 'nsIInputStreamPump', 'init')
const ScriptableStream = CC('@mozilla.org/scriptableinputstream;1', 'nsIScriptableInputStream', 'init')

var StreamLoader = Class({
	extends: Unknown,
	interfaces: ['nsIStreamListener'],
	initialize: function(callback) {
		this.buffer = ''
		this.callback = callback
	},
	onStartRequest: function(request, context) {},
	onDataAvailable: function(request, context, stream, offset, size) {
		let chunk = NetUtil.readInputStreamToString(stream, size, { charset: 'UTF-8' })
		this.buffer += chunk
	},
	onStopRequest: function(request, context, status) {
		let lines = this.buffer.split('\n')
		this.callback.call(null, lines)
	},
})

exports.convertStream = function(inStream, from, to) {
	let {promise, resolve} = defer()
	
	let StreamConverter = CC('@mozilla.org/streamconv;1?from=' + from + '&to=' + to, 'nsIStreamConverter')
	
	let converter = new StreamConverter()
	converter.asyncConvertData(from, to, new StreamLoader(resolve), null)
	
	let pump = new InputStreamPump(inStream, -1, -1, 0, 0, true)
	pump.asyncRead(converter, null)
	
	return promise
}

// var StreamIterator = Class({
// 	extends: Unknown,
// 	interfaces: ['nsIStreamListener'],
// 	initialize: function() {
// 		this.offset = 0
// 		this.buffer = ''
// 		this.lines = []
// 		this.closed = false
// 	},
// 	onStartRequest: function(request, context) {},
// 	onDataAvailable: function(request, context, stream, offset, size) {
// 		let avail = stream.available()
// 		streamIterator.onDataAvailable(null, null, stream, this.offset, avail)
// 		this.offset += avail
// 		
// 		let chunk = NetUtil.readInputStreamToString(stream, avail, { charset: 'UTF-8' })
// 		this.buffer += chunk
// 		
// 		let lines = this.buffer.split('\n')
// 		this.buffer = lines[lines.length-1]
// 		
// 		this.lines = this.lines.concat(lines.slice(0, -1))
// 	},
// 	onStopRequest: function(request, context, status) { this.closed = true },
// 	iterator: function*() {
// 		let self = this
// 		return (function() {
// 			let next = self.maybeNext()
// 			while (!this.closed) {
// 				if (typeof next !== 'undefined')
// 					yield next
// 				next = self.maybeNext()
// 			}
// 			throw new StopIteration()
// 		})()
// 	},
// 	maybeNext: function() {
// 		if (this.lines.length > 0)
// 			return this.lines.unshift()
// 		else
// 			return undefined
// 	}
// })
// 
// exports.convertStream = function*(inStream, from, to) {
// 	let StreamConverter = CC('@mozilla.org/streamconv;1?from=' + from + '&to=' + to, 'nsIStreamConverter')
// 	
// 	let streamIterator = new StreamIterator()
// 	
// 	let converter = new StreamConverter()
// 	converter.asyncConvertData(from, to, streamIterator, null)
// 	
// 	let pump = new InputStreamPump(inStream, -1, -1, 0, 0, true)
// 	pump.asyncRead(converter, null)
// 	
// 	for (line of streamIterator)
// 		yield line
// }

exports.convertString = function(string, from, to) {
	let inStream = new StringInputStream()
	inStream.data = string
	return exports.convertStream(inStream, from, to)
}

exports.convertFile = function(fileName, from, to) {
	let inStream = new FileInputStream(new MozFile(fileName), -1, -1, 0)
	return exports.convertStream(inStream, from, to)
}
