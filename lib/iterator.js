const { Class } = require('sdk/core/heritage')

/** Iterator wrapper around other iterators and arrays
  * Used to ensure somthing is an iterator (and has .next) */
exports.Iterator = function*(arrayOrIter) {
	if (Array.isArray(arrayOrIter))
		for (let i=0; i<arrayOrIter.length; i++)
			yield arrayOrIter[i]
	else
		yield* arrayOrIter
}