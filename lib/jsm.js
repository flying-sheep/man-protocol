const { Cu } = require('chrome');
/**
 * Imports a JS Module using Components.utils.import()
 * and returns the scope, similar to Jetpack require().
 *
 * @param targetScope {Object} (optional)
 *     If null, the scope will just be returned
 *     and *not* added to the global scope.
 *     If given, all functions/objects from the JSM will be
 *     imported directly in |targetScope|, so that you
 *     can do e.g.
 *       requireJSM("url", this)
 *       someFuncFromJSM();
 *     which will have the same effect as
 *       Components.utils.import("url");
 *       someFuncFromJSM();
 *     in normal Mozilla code, but the latter won't work in Jetpack code.
 */
exports.requireJSM = function(url, targetScope = {}) {
	Cu.import(url, targetScope);
	return targetScope;
}
