const meow = require('meow')
const _ = require('lodash')
const link = require('./link')

const cli = meow(`
	Usage
	  $ slex-link <options>
	Options
	  --cleanup Removes and reinstalls node_modules in all linked folders
	  --deep Links linked folders to their npm linkable projects in the code directory
	  --ignore Accepts comma separated list of package names to ignore when linking
	Examples
	  $ slex-link --cleanup 
	  $ slex-link --deep
	  $ slex-link --ignore package1
	  $ slex-link --ignore package1,package2
`, {
	flags: {
		cleanup: {
			type: 'boolean',
			default: false
		},
		deep: {
			type: 'boolean',
			default: false
		},
		ignore: {
			type: 'string',
			default: ''
		}
	}
})
const { cleanup, deep, ignore: stringIgnore } = cli.flags
const ignore = _.chain(stringIgnore)
	.split(',')
	.reject(_.isEmpty)
	.map(_.trim)
	.concat(['slex-link'])
	.value()

link({ linkAppName: cli.pkg.name, cleanup, deep, ignore })
