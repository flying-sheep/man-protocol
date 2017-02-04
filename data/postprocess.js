'use strict'

//const xRefRE = /<b>([\+_\.\w-]+)<\/b>\(([1-9])(\w*)\)/g

function normalizedText(node) node.textContent.trim().replace(/\n/, ' ')

function rebuildToc() {
	let list = $('<ol/>').hide()
	
	let sections = $('h2').map(function(i, sectionHeader) {
		let section = normalizedText(sectionHeader)
		$('<a/>')
			.attr('href', '#' + section)
			.text(section)
			.appendTo($('<li/>').appendTo(list))
		return section
	}).get()
	
	let tocHead = $('<h3/>')
		.text('Contents')
		.on('click', function() {
			list.slideToggle()
			$(this).toggleClass('shown')
		})
	
	let toc = $('<aside/>')
		.addClass('toc')
		.append(tocHead)
		.append(list)
		.prependTo(document.body)
	
	return sections
}

function manURL(title, section, subsection = '') {
	section = (section === '1') ? '' : '/' + section
	if (subsection)
		subsection = '#' + subsection
	return 'man://' + title + section + subsection //encodeuri?
}

const braceRE = /^\(([1-8])\w*\)/

function createManLinks() {
	for (let titleNode of document.querySelectorAll('b, i')) {
		let title = normalizedText(titleNode)
		let textNode = titleNode.nextSibling
		if (!textNode || textNode.nodeType !== Node.TEXT_NODE)
			continue
		
		let match = braceRE.exec(textNode.nodeValue)
		if (!match)
			continue
		
		textNode.nodeValue = textNode.nodeValue.replace(braceRE, '')
		
		let sectionNode = document.createTextNode(match[0])
		$(titleNode)
			.after(sectionNode).add(sectionNode)
			.wrapAll($('<a/>').attr('href', manURL(title, match[1])))
	}
}

const sectionRE = /^[A-Z ]+$/

function createSectionLinks(sections) {
	for (let sectionNode of document.getElementsByTagName('b')) {
		let section = normalizedText(sectionNode)
		
		if (!sectionRE.test(section) || sections.indexOf(section) === -1)
			continue
		
		$(sectionNode).wrap($('<a/>').attr('href', '#' + section))
	}
}

document.addEventListener('DOMContentLoaded', function() {
	let sections = rebuildToc()
	createManLinks()
	createSectionLinks(sections)
})