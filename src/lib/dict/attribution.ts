/** Credits for the About screen (required by the data licences; see node_modules/@johnmorrisdotca/jisho/NOTICE.md). */
export const DICT_CREDITS = [
	{
		name: 'JMdict',
		by: 'the Electronic Dictionary Research and Development Group (EDRDG)',
		licence: 'CC BY-SA 4.0',
		url: 'https://www.edrdg.org/edrdg/licence.html'
	},
	{ name: 'Tatoeba example sentences', by: 'the Tatoeba project', licence: 'CC BY 2.0 FR', url: 'https://tatoeba.org' },
	{
		name: 'Jisho (@johnmorrisdotca/jisho)',
		by: 'John Morris',
		licence: 'MIT (code); data under its sources’ licences',
		url: 'https://github.com/johnmorrisdotca/jisho'
	}
] as const;

export const DICT_ATTRIBUTION =
	'Dictionary data: JMdict, © the Electronic Dictionary Research and Development Group (EDRDG), used under CC BY-SA 4.0 ' +
	'and the Group’s licence (https://www.edrdg.org/edrdg/licence.html). Example sentences: the Tatoeba project, CC BY 2.0 FR. ' +
	'Packaged by John Morris in @johnmorrisdotca/jisho (MIT).';
