const {
	chindingsSym,
	serializersSym,
	stringifiersSym,
	stringifySym,
	stringifySafeSym,
	wildcardFirstSym,
	formattersSym
} = require('pino/lib/symbols')

function asChindings(instance, bindings) {
	let value
	let data = instance[chindingsSym]
	const stringify = instance[stringifySym]
	const stringifySafe = instance[stringifySafeSym]
	const stringifiers = instance[stringifiersSym]
	const wildcardStringifier = stringifiers[wildcardFirstSym]
	const serializers = instance[serializersSym]
	const formatter = instance[formattersSym].bindings
	bindings = formatter(bindings)
	const jsonData = JSON.parse(`{${data.slice(1)}}`)

	for (const key in bindings) {
		if (jsonData.hasOwnProperty(key)) delete jsonData[key]
	}

	data = ',' + JSON.stringify(jsonData).replace(/[{}]/g, '')

	for (const key in bindings) {
		value = bindings[key]
		const valid =
			key !== 'level' &&
			key !== 'serializers' &&
			key !== 'formatters' &&
			key !== 'customLevels' &&
			bindings.hasOwnProperty(key) &&
			value !== undefined
		if (valid === true) {
			value = serializers[key] ? serializers[key](value) : value
			value = (stringifiers[key] || wildcardStringifier || stringify)(
				value,
				stringifySafe
			)
			if (value === undefined) continue
			data += ',"' + key + '":' + value
		}
	}
	return data
}

module.exports = {
	asChindings
}
