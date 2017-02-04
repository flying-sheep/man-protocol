const { prefs } = require('sdk/simple-prefs')
const { data } = require('sdk/self')
const { URL } = require('sdk/url')
const file = require('sdk/io/file')
const subprocess = require('sdk/system/child_process')

const { protocol } = require('protocol/index')

const troff = require('./troff')
const { convertFile } = require('./streamconverter')

const locales = require('sdk/l10n/locale').getPreferedLocales()
const lang = locales[0].substring(0, 2)

const headers = [
	'<link rel="stylesheet" type="text/css" href="' + data.url('Averia Serif Libre/AveriaSerifLibre.css') + '">',
	'<link rel="stylesheet" type="text/css" href="' + data.url('man.css') + '">',
	'<script src="' + data.url('jquery-2.0.1.min.js') + '"></script>',
	'<script src="' + data.url('postprocess.js') + '" type="application/javascript;version=1.8"></script>',
]

exports.handler = protocol('man', {
	onRequest: function(request, response) {
		let url = URL(request.uri)
		let name = url.host
		let page = parseInt(url.path.replace(/^\//, '')) //man:foo/7
		if (isNaN(page))
			page = 1
		
		response.contentType = 'text/html'
		
		try {
			if (force || !prefs.system)
				throw new Error('Preventing system call')
			const process = subprocess.spawn('/usr/bin/man', ['-Thtml', page, name])
			let html = ''
			process.on('data', data => html += data)
			process.on('close', code => {
				//if (code !== 0) //4096???
				//	throw new Error('/usr/bin/man not found or it failed')
				response.writeFrom(preprocessGroffHTML(html), true)
			})
		} catch(e) {
			let path = findManPath(name, page)
			if (path) {
				convertFile(path, 'gzip', 'uncompressed').then(function(lines) {
					response.writeFrom(troff.troff2html(lines, headers), true)
				})
			} else
				response.write('manpage man' + name + '(' + page + ') does not exist')
		}
		//TODO: postprocess
	}
})

const rejectRE = /^<a href="#[\w ]+">[\w ]+<\/a><br>$|^<hr>$|loose\.dtd">$/

/** Inserts script & style nodes into groff-created HTML */
function* preprocessGroffHTML(html) {
	for (let data of html.split('\n')) {
		if (data.startsWith('<!DOCTYPE'))
			yield '<!doctype html>\n'
		else if (data.startsWith('<meta http-equiv="Content-Type"'))
			yield '<meta charset="UTF-8">\n'
		else if (!rejectRE.test(data))
			yield data + '\n'
		if (data.endsWith('</title>'))
			for (header of headers)
				yield header + '\n'
	}
}

function findManPath(name, page) {
	let f1 = 'man' + page
	let f2 = name + '.' + page + '.gz'
		
	let path = file.join(prefs.path, lang + '.UTF-8', f1, f2)
	if (file.exists(path))
		return path
	
	path = file.join(prefs.path, lang, f1, f2)
	if (file.exists(path))
		return path
	
	path = file.join(prefs.path, f1, f2)
	if (file.exists(path))
		return path
	else
		return null
}

exports.main = function(options, callbacks) {
	exports.handler.register()
}

exports.onUnload = function(reason) {
	exports.handler.unregister()
}
