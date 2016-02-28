'use strict'

const Joi = require('joi')
const _ = require('lodash')
const moment = require('moment')

const tableColumnRenamer = require('./tableColumnRenamer.js')

module.exports = {
  getBaseUrl: getBaseUrl,
  findAllQueryParams: findAllQueryParams,
  findByIdQueryParams: findByIdQueryParams,
  underscore: underscore,
  empty: empty,
  pickJoiConstraints: pickJoiConstraints,
  initModel: initModel,
  addConstraintsForForeignKeys: addConstraintsForForeignKeys,
  initJsonDateFormat: initJsonDateFormat,
  formatNumber: formatNumber,
  formatDate: formatDate,
  setForeignKeys: setForeignKeys,
  transformErrorMessage: transformErrorMessage,
  transformConstraintViolationMessages: transformConstraintViolationMessages,
}

/**
  * Gets the base url of the request provided (host + port + context path)
  */
// based on http://stackoverflow.com/a/31841704/1399395
function getBaseUrl(request) {
  return request.connection.info.protocol + '://' + request.info.host
}

/**
  * Returns a map with baseQuery's keys converted to underscore_case.
  */
function underscore(baseQuery) {
  return _.mapKeys(baseQuery, function(v, k) {
    return tableColumnRenamer.underscore(k)
  })
}

/**
  * Builds the "find all" WHERE clause query param map by taking into consideration config.baseQuery.
  */
function findAllQueryParams (request, config) {
    return typeof config.baseQuery === 'undefined' ? {} : underscore(config.baseQuery(request))
}

/**
  * Builds the "find by id" WHERE clause query param map by taking into consideration config.baseQuery.
  */
function findByIdQueryParams (request, config) {
    return typeof config.baseQuery === 'undefined' ? {'id': request.params.id} : _.merge({'id': request.params.id}, underscore(config.baseQuery(request)))
}

/**
  * Deletes any properties from the entity which in the schema are marked as Empty.
  */
function empty (entity, schema, Empty) {
  if (typeof entity === 'undefined' || entity === null) {
    return
  }
  _.forEach(schema, function(v, k) {
    if (v === Empty) {
      delete entity[k]
    }
  })
}

/**
  * Returns a map with all the Joi validation constraints from the schema provided.
  */
function pickJoiConstraints (schema) {
  return _.pickBy(schema, function(v, k) {
    return v.isJoi
  })
}

/**
  * Initializes the models from the config provided to make them usable with the exported crud function.
  */
function initModel (config) {
  if (typeof config.bookshelfModel.prototype.schema === 'undefined') {
    config.bookshelfModel.prototype.schema = {}
  }
  addConstraintsForForeignKeys(config.bookshelfModel, config.baseQuery)
  config.bookshelfModel.prototype.format = tableColumnRenamer.renameOnFormat
  config.bookshelfModel.prototype.parse = tableColumnRenamer.renameOnParse
  initJsonDateFormat(config.bookshelfModel)
}

/**
  * Adds required() validation constraints to all the bookshelfModel's foreign keys, as defined in baseQuery.
  */
function addConstraintsForForeignKeys (bookshelfModel, baseQuery) {
  if (typeof baseQuery === 'undefined') {
    return
  }
  
  _.forEach(baseQuery({params: {}, payload: {}}), function(v, k) {
    const value = bookshelfModel.prototype.schema[k]
    if (typeof value === 'undefined') {
      bookshelfModel.prototype.schema[k] = Joi.any().required()
    }
    else if (value.isJoi) {
      bookshelfModel.prototype.schema[k] = bookshelfModel.prototype.schema[k].required()
    }
  })
}

/**
  * Initializes bookshelfModel's toJSON functionality to convert all date properties, as defined in bookshelfModel.schema.
  */
function initJsonDateFormat (bookshelfModel) {
  const schema = bookshelfModel.prototype.schema
  const originalFunction = bookshelfModel.prototype.toJSON
  // read from MySQL date, based on https://github.com/tgriesser/bookshelf/issues/246#issuecomment-35498066
  bookshelfModel.prototype.toJSON = function () {
    const attrs = originalFunction.apply(this, arguments)
    _.forEach(attrs, function(v, k) {
      if (v !== null && typeof schema[k] !== 'undefined' && schema[k]._type === 'date') {
        attrs[k] = moment(v).format(schema[k]._flags.format)
      }
    })
    return attrs
  }
}

/**
  * Initializes every empty number property of a payload, as defined in the schema provided, with 0.
  */
function formatNumber (payload, schema) {
  _.forEach(schema, function(v, k) {
    if (v !== null && v._type === 'number') {
      if (typeof payload[k] === 'undefined' || payload[k] === null) {
        payload[k] = 0
      }
    }
  })
}

/**
  * Applies simple to-date conversion for every date property of a payload, as defined in the schema provided.
  */
function formatDate (payload, schema) {
  _.forEach(schema, function(v, k) {
    if (v !== null && v._type === 'date') {
      if (payload[k] !== null) {
        payload[k] = new Date(payload[k])
      }
    }
  })
}

/**
  * Copies the value of the foreign keys, as defined in baseQuery, provided by request.params, to the request.payload model. 
  */
function setForeignKeys (request, baseQuery) {
  if (typeof baseQuery === 'undefined') {
    return
  }
  
  _.forEach(baseQuery(request), function(v, k) {
    request.payload[k] = request.params[k]
  })
}

/**
  * Converts the error object provided into the specified error message format.
  */
function transformErrorMessage (err) {
  return {
    error: {
      exception: err.code,
      detailMessage: err.message
    }
  }
}

/**
  * Converts the error object provided into the specified validation constraint violation error message format.
  */
function transformConstraintViolationMessages (input) {
    return {
        validationErrors: _.chain(input.details)
    .mapKeys(function(v, k) {
	  // Use '.' as the key if the entire object is erroneous
      return (input.details.length == 1 && input.details[0].path === 'value' && input.details[0].type === 'object.base') ? '.' : v.path
    })
    .mapValues(function (v) {
            return {
        attributes: _.chain(v.context)
        .pickBy(function(v, k) {
          return typeof v !== 'undefined' && v !== null && k !== 'key'
        })
        .mapValues(function(i) {
          return i.toString()
        }),
        constraintClassName: v.type,
        invalidValue: v.context.value,
                messageTemplate: v.type,
            }
        })
    }
}