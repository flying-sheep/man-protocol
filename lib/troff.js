//http://www.linuxjournal.com/content/converting-troff-html
//or: http://cgi.csc.liv.ac.uk/~ped/docs/tro2html.c

//http://www.gnu.org/software/groff/manual/groff.pdf

const { Iterator } = require('./iterator')

exports.debug = false;

function strip(str, border) {
	if (!border)
		return str.trim()
	let stripper = new RegExp('^' + border + '+|' + border + '+$', 'g')
	return str.replace(stripper, '')
}

const macros = {
	comment: '.\\"',
	title:   '.TH',
	head:    '.SH',
	subhead: '.SS',
	
	bold:    '.B',
	italic:  '.I',
	roman:   '.R',
	
	boldItalic:  '.BI',
	italicBold:  '.IB',
	itlicRoman:  '.IR',
	romanItalic: '.RI',
	romanBold:   '.RB',
	boldRoman:   '.BR',
	
	small:       '.SM',
	smallBold:   '.SB',
	
	para:        '.PP',
	indent:      '.RS',
	dedent:      '.RE',
	indented:    '.TP',
	hanging:     '.HP',
	noFill:      '.nf',
	fill:        '.fi',
	
	spacer:      '.sp',
	lineBreak:   '.br',
	pageNumChar: '.pc',
	iff:         '.if',
	
	tableStart:  '.TS',
	tableEnd:    '.TE',
}

/** macros that are mutually exclusive, i.e. cancel each other on top level
  * e.g. a paragraph is ended whenever a heading is encountered */
const topMacros = {}
topMacros[macros.head]     = ''
topMacros[macros.subhead]  = ''
topMacros[macros.para]     = 'p'
topMacros[macros.indent]   = 'blockquote'
topMacros[macros.dedent]   = ''
//topMacros[macros.indented] = 'dl' //Special treatment: we don’t close <dl> everytime
topMacros[macros.hanging]  = 'p'
topMacros[macros.noFill]   = 'pre'
topMacros[macros.fill]     = ''

/** preprocessors defined via '/" macro. currently unused */
const preprocessors = {
	e: 'geqn',
	r: 'grefer',
	t: 'gtbl',
}

/** available fonts. roman is default, mono implies roman
  * this is used for normalization of the different font names */
const fonts = {
	B: ['bold'],
	I: ['italic'],
	R: ['roman'],
	P: ['previous'],
	CR: ['mono'],
	CW: ['mono'],
	CB: ['mono', 'bold'],
	CI: ['mono', 'italic'],
	//TODO
}

/** tag presets in the form [name, attrs] */
const tags = {
	roman:   [null, {}],
	mono:    ['code', {}],
	small:   ['small', {}],
	bold:    ['b', {}],
	italic:  ['i', {}],
	title:   ['h1', {}],
	head:    ['h2', {}],
	subhead: ['h3', {}],
	error:   ['div', { class: 'error' }],
}

/** Parses shell argument lists. spaces can be escaped or masked by "" */
function splitArgs(str) {
	let ret = []
	let append = false // \ 
	let parts = str.match(/"[^"]*"|[^ ]+/g) || []
	
	for (let part of parts) { //TODO: also tabs?
		if (part[0] === '"') {
			ret.push(part.substring(1, part.length - 1))
		} else if (part.endsWith('\\')) {
			part = part.substr(0, part.length-1) + ' '
			if (append)
				ret[ret.length - 1] += part
			else
				ret.push(part)
			append = true
		} else if (append) {
			append = false
			ret[ret.length - 1] += part
		} else
			ret.push(part)
	}
	
	return ret
}
exports.splitArgs = splitArgs

function startTag(tagName, attrs) {
	attrs = [' ' + attr + '="' + attrs[attr] + '"'.repeat(attrs.length)].join('')
	return '<' + tagName + attrs + '>'
}

/** wraps <tag> and </tag> around text
  * if standalone is true, unescape text first and possibly add end */
function wrapTag(tag, text, standalone=true) {
	let end = (!standalone || text.endsWith('\\c')) ? '' : ' '
	text = text.replace(/\\c$/, '')
	if (standalone)
		text = unescape(splitArgs(text).join(' '))
	
	let [tagName, attrs] = tag
	if (tagName)
		text = startTag(tagName, attrs) + text + '</' + tagName + '>'
	
	return text + end
}

/** wraps alternately <tag1> & </tag1> and
  * <tag2> & </tag2> around each piece of text */
function wrapAlternatingTags(tag1, tag2, text) {
	let end = (text.endsWith('\\c')) ? '' : ' '
	text = unescape(text.replace(/\\c$/, ''))
	
	let texts = splitArgs(text)
	let ret = ''
	for (let i=0; i<texts.length; i++) {
		let tag = (i%2 === 0) ? tag1 : tag2
		ret += wrapTag(tag, texts[i], false)
	}
	
	return ret + end
}

function sectionAnchor(text) {
	let anchor = unescape(splitArgs(text).join(' '))
	return wrapTag(['a', { name: anchor }], '')
}

/** escapes special characters in a string */
function escapeHTML(str) str
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;')

function unescapeFonts(str) {
	let buffer = ''
	let stack = []
	for (let i=0; i<str.length;) {
		let next = str.indexOf('\\f', i)
		if (next === -1) {
			buffer += str.substr(i)
			stack.reverse()
			for (let tagName of stack)
				buffer += '</' + tagName + '>'
			break
		} else
			buffer += str.substring(i, next)
		
		let font = str[next + 2];//1-char font instruction or “(” or “[”.
		next += 3 //after font instruction
		i = next
		
		if (font === '(') { //2-char font instruction
			font = str.substr(next, 2)
			i = next + 2
		} else if (font === '[') { //variable width font instruction
			let end = str.indexOf(']', i)
			font = str.substring(next, end)
			i = end + 1
		}
		if (!(font in fonts)) {
			console.log(font)
			font = 'R'
		}
		font = fonts[font]
		
		if (font[0] === 'roman') {
			stack.reverse()
			for (let tagName of stack)
				buffer += '</' + tagName + '>'
			stack.length = 0
		} else if (font[0] === 'previous') {
			buffer += '</' + stack.pop() + '>'
		} else {
			for (let f of font) {
				let [tagName, attrs] = tags[f]
				stack.push(tagName)
				buffer += startTag(tagName, attrs)
			}
		}
	}
	
	return buffer
}

function unescapeColors(str) {
	let buffer = ''
	let stack = 0
	for (let i=0; i<str.length;) {
		let next = str.indexOf('\\m', i)
		if (next === -1) {
			buffer += str.substr(i)
			while (stack--)
				buffer += '</span>'
			break
		} else
			buffer += str.substring(i, next)
		
		let color = str[next + 2];//1-char font instruction or “(” or “[”.
		next += 3 //after font instruction
		i = next
		
		if (color === '(') { //2-char font instruction
			color = str.substr(next, 2)
			i = next + 2
		} else if (color === '[') { //variable width font instruction
			let end = str.indexOf(']', i)
			color = str.substring(next, end)
			i = end + 1
		}
		
		if (color === '') {
			stack--
			buffer += '</span>'
		} else {
			stack++
			buffer += startTag('span', { style: 'color:' + color })
		}
	}
	
	return buffer
}

/** converts escape sequences to unicode */
function unescape(str) {
	str = str
		.replace(/\\>/g, '>')
		.replace(/\\</g, '<')
	str = escapeHTML(str)
	str = str
		.replace(/\\\(ss/g, 'ß')
		.replace(/\\\(:a/g, 'ä')
		.replace(/\\\(:A/g, 'Ä')
		.replace(/\\\(:o/g, 'ö')
		.replace(/\\\(:O/g, 'Ö')
		.replace(/\\\(:u/g, 'ü')
		.replace(/\\\(:U/g, 'Ü')
		
		.replace(/\\\(hy/g, '-')
		.replace(/\\\(rg/g, '&reg;')
		.replace(/\\\(co/g, '&copy;')
		.replace(/\\\(oq/g, '&lsquo;')
		.replace(/\\\(cq/g, '&rsquo;')
		.replace(/\\\(lq/g, '&ldquo;')
		.replace(/\\\(rq/g, '&rdquo;')
		.replace(/\\\(aa/g, '&acute;')
		.replace(/\\\(bu/g, '&bull;')
		.replace(/\\\(mu/g, '&times;')
		
		.replace(/\\\*\[softhyphen\]/g, '&shy;')
		
		.replace(/\\[Ee\\]/g, '&#92;')
		.replace(/\\-/g,  '&ndash;') //TODO: ?
		.replace(/\\~/g,  '&nbsp;')
		.replace(/\\0/g,  '&#8199;') //figure space
		.replace(/\\\|/g, '&#8201;') //thin space
		.replace(/\\\^/g,  '&#8202;') //hair space
		.replace(/\\&amp;/g, '&#8203;') //zero width space
		.replace(/\\n/g,  '<br/>')
	str = unescapeFonts(str)
	str = unescapeColors(str)
	return str
}

//TODO: colors: .replace(/\\m\[(\w+)\](.*?)\\m\[\]/g, '<span style="color: $1">$2</span>')

/** Parses a TBL option line */
function TableOptions(optline) {
	for (opt in TableOptions.prototype) {
		let optIdx = optline.indexOf(opt)
		if (optIdx === -1)
			continue
		
		if (typeof this[opt] === 'boolean') {
			this[opt] = true
		} else {
			let start = optline.indexOf('(', optIdx) + 1
			let end   = optline.indexOf(')', start)
			
			this[opt] = optline.substring(start, end)
		}
	}
}
TableOptions.prototype = {
	center: false,
	delim: 'xy', //TODO
	expand: false,
	box: false,
	doublebox: false,
	allbox: false,
	frame: false,
	doubleframe: false,
	tab: '\t',
	linesize: 16, //TODO
	nokeep: false,
	decimalpoint: '.',
	nospaces: false,
}

/** slurps a whole table from the lines iterator */
function* parseTable(title, lines) {
	let options = new TableOptions(lines.next().value)
	let fmts = []
	let fmt
	let idx = 0
	
	yield '<table>'
	if (title)
		yield '\t<th>' + title + '</th>'
	
	for (let line of lines) {
		if (line.startsWith(macros.tableEnd))
			break
		
		if (!fmt) {
			if (line.endsWith('.'))
				fmt = line
			else fmts.push(line)
			continue
		}
		
		let buffer = line
		while(true) {
			let open  = (buffer.match(/T\{/g) || []).length
			let close = (buffer.match(/T\}/g) || []).length
			if (close >= open) break
			buffer += lines.next().value
		}
		
		yield '\t<tr>'
		for (s of buffer.match(new RegExp('[^' + options.tab + ']+|T\{.*?T\}', 'g')))
			yield '\t\t<td>' + unescape(s.replace(/^T\{|T\}$/g, '')) + '</td>'
		yield '\t</tr>'
		
		idx++
	}
	
	yield '</table>'
}

function errorTag(msg, txt) wrapTag(tags.error, wrapTag(tags.bold, msg, false) + unescape(txt), false)

/** parses an if statement from the lines iterator */
function* parseIf(line, lines) { //TODO
	if (line.startsWith('t ')) {
		yield unescape(line.substr(2))
	} else if (line.startsWith('n ')) {
		//we’re not nroff, do nuthin’
	} else if (exports.debug) {
		yield errorTag('if', line)
	}
}

function* makeTitle(title, section, date, headers=[]) {
	yield '<html>'
	yield '<head>'
	yield '\t<title>' + title + '</title>'
	yield '\t<meta charset="utf-8">'
	for (let line of headers)
		yield '\t' + line
	yield '</head>'
	yield '<body>'
	yield '<h1>' + title + '</h1>'
}

function* troff2html(lines, headers=[]) { try {
	let title = ''
	let section = ''
	let date = '' //there’s more…
	
	let preprocessor = ''
	let pageNumberChar = '%'
	
	let status = ''
	let inLabel = 0
	
	yield '<!doctype html>'
	
	for (let line of lines) {
		let macro = ''
		if (line.startsWith(macros.comment)) {
			yield '<!-- ' + line.replace(macros.comment, '').replace(/--{2,}/, '–') + '-->'
			continue
		} else if (line[0] == '.') {
			let result = /\s/.exec(line)
			let sp = (result) ? result.index : line.length
			macro = line.substr(0, sp)
			line = line.substr(sp + 1)
		} else if (line.startsWith('\'\\"')) {
			preprocessor = preprocessors[line.split(' ')[1]]
			continue
		}
		
		if (macro in topMacros) {
			if (status)
				yield '</' + status + '>'
			status = topMacros[macro]
		}
		
		switch (macro) {
		case macros.title:
			[title, section, date] = splitArgs(line)
			
			for (let line of makeTitle(title, section, date, headers))
				yield line
			break
		
		case macros.bold:    yield wrapTag(tags.bold,   line); break
		case macros.italic:  yield wrapTag(tags.italic, line); break
		case macros.roman:   yield wrapTag(tags.roman,  line); break
		
		case macros.boldItalic:  yield wrapAlternatingTags(tags.bold,   tags.italic, line); break
		case macros.italicBold:  yield wrapAlternatingTags(tags.italic, tags.bold,   line); break
		case macros.itlicRoman:  yield wrapAlternatingTags(tags.italic, tags.roman,  line); break
		case macros.romanItalic: yield wrapAlternatingTags(tags.roman,  tags.italic, line); break
		case macros.romanBold:   yield wrapAlternatingTags(tags.roman,  tags.bold,   line); break
		case macros.boldRoman:   yield wrapAlternatingTags(tags.bold,   tags.roman,  line); break
		
		case macros.small:       yield wrapTag(tags.small, line); break
		case macros.smallBold:   yield wrapTag(tags.bold, wrapTag(tags.small, line), false); break
		
		case macros.head:
			yield sectionAnchor(line)
			yield wrapTag(tags.head, line)
			break
		case macros.subhead: yield wrapTag(tags.subhead, line); break
		
		case macros.para: yield '<p>' + unescape(line); break
		case macros.indented:
			if (status !== 'dl') {
				if (status)
					yield '</' + status + '>'
				yield '<dl>'
				status = 'dl'
			}
			yield '<dt>'
			inLabel = 1
			break //TODO: use width
		case macros.indent: yield '<blockquote>'; break
		case macros.dedent: break
		case macros.noFill: yield '<pre>'; break
		case macros.fill:   break
		case macros.hanging: yield '<p style="margin-left: 3em">'; break //TODO: use width of line
		
		case macros.spacer:      yield wrapTag(['div', { margin: '0 0 1em 0' }], ''); break //TODO: use height
		case macros.lineBreak:   yield '<br/>'; break
		case macros.pageNumChar: pageNumberChar = line; break
		case macros.iff:         yield* parseIf(line, lines); break
		
		case macros.tableStart:  yield* parseTable(line, lines); break
		case macros.tableEnd:    /*error*/break
		case '':
			if (!line) {
				yield '<p>'
				break
			}
			
			yield unescape(line)
			break
		default:
			if (exports.debug)
				yield errorTag(macro, line)
		}
		
		if (inLabel == 1) {
			inLabel = 2
		} else if (inLabel == 2) {
			yield '<dd>'
			inLabel = 0
		}
	}
	
	yield '</body>'
	yield '</html>'
} catch(e) { console.exception(e) } }

exports.troff2html = function*(lines, headers) {
	for (let line of troff2html(Iterator(lines), headers))
		yield line + '\n'
}
