// based on http://stackoverflow.com/a/28489155/1399395
// added support to camelize lower cased underscore column names

'use strict'

const _ = require('lodash')

const STRING_CAMELIZE_REGEXP = (/(\-|_|\.|\s)+(.)?/g)
const STRING_UNDERSCORE_REGEXP_1 = (/([a-z\d])([A-Z]+)/g)
const STRING_UNDERSCORE_REGEXP_2 = (/\-|\s+/g)

function camelize(str) {
    return str.toLowerCase().replace(STRING_CAMELIZE_REGEXP, function (match, separator, chr) {
        return chr ? chr.toUpperCase() : ''
    }).replace(/^([A-Z])/, function (match, separator, chr) {
        return match.toLowerCase()
    })
}

function underscore(str) {
    return str.replace(STRING_UNDERSCORE_REGEXP_1, '$1_$2').
            replace(STRING_UNDERSCORE_REGEXP_2, '_').toLowerCase()
}

module.exports = {
    renameOnParse: function (attrs) {
        return _.reduce(attrs, function (memo, val, key) {
            memo[camelize(key)] = val
            return memo
        }, {})
    },
    renameOnFormat: function (attrs) {
        return _.reduce(attrs, function (memo, val, key) {
            memo[underscore(key)] = val
            return memo
        }, {})
    },
  camelize: camelize,
  underscore: underscore,
}
