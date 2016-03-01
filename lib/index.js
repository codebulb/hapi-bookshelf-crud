'use strict'

const Joi = require('joi')
const _ = require('lodash')
const log = require('npmlog')

const hapiCrudHelper = require('./hapiCrudHelper.js')

module.exports = function (server, options) {

  const functionality = function (server, options) {
    return {
      crud: function (config) {
        initModel(config)
      
        // find all
        this.route({
          method: 'GET',
          path: config.basePath,
          handler: function (request, reply) {
			let ret = config.bookshelfModel.where(findAllQueryParams(request, config))
			if (options.allowFilters) {
				ret = filterQueryParams(ret, request)
			}
            return ret.fetchAll().then(function (collection) {
              reply(collection)
            })
          },
		  validate: false,
          baseQuery: config.baseQuery,
          bookshelfModel: config.bookshelfModel,
        })

        // find by id
        this.route({
          method: 'GET',
          path: config.basePath + '/{id}',
          handler: function (request, reply) {
            return config.bookshelfModel.where(findByIdQueryParams(request, config)).fetch().then(function (entity) {
              if (entity !== null) {
                reply(entity)
              }
              else {
                reply().code(404)
              }
            })
          },
		  validate: false,
          baseQuery: config.baseQuery,
          bookshelfModel: config.bookshelfModel,
        })

        // add
        this.route({
          method: 'POST',
          path: config.basePath,
          handler: function (request, reply) {
            return config.bookshelfModel.forge(request.payload).save().then(function (entity) {
              if (typeof config.afterAdd !== 'undefined') {
                config.afterAdd(entity)
              }
              reply(entity).header('Location', getBaseUrl(request) + config.basePath + '/' + entity.id)
            })
          },
		  beforeValidate: function(request) {
			if (typeof request.payload.id !== 'undefined' && request.payload.id !== null) {
				throw {message: "Request body entity's id field is expected to be be null.", code: 'BodyIdIsNotNullException'}
			}
		  },
          baseQuery: config.baseQuery,
          bookshelfModel: config.bookshelfModel,
        })
        
        // update
        this.route({
          method: 'PUT',
          path: config.basePath + '/{id}',
          handler: function (request, reply) {
			request.payload.id = Number(request.params.id) // enforce id if null
            return config.bookshelfModel.forge(request.payload).save().then(function (entity) {
              if (typeof config.afterUpdate !== 'undefined') {
                config.afterUpdate(entity)
              }
              reply(entity).header('Location', getBaseUrl(request) + config.basePath + '/' + entity.id)
            })
          },
		  beforeValidate: function(request) {
			if (typeof request.payload.id !== 'undefined' && request.payload.id !== null && request.payload.id !== Number(request.params.id)) {
				throw {message: "Request body entity's id field is expected to be empty or to match id path parameter.", code: 'BodyIdDoesNotMatchPathException'}
			}
		  },
          baseQuery: config.baseQuery,
          bookshelfModel: config.bookshelfModel,
        })

        // delete
        this.route({
          method: 'DELETE',
          path: config.basePath + '/{id}',
          handler: function (request, reply) {
            return config.bookshelfModel.where(findByIdQueryParams(request, config)).destroy().then(function (entity) {
              reply().code(204)
            })
          },
		  validate: false,
          baseQuery: config.baseQuery,
          bookshelfModel: config.bookshelfModel,
        })
		
		// delete all
        this.route({
          method: 'DELETE',
          path: config.basePath,
          handler: function (request, reply) {
		    // We need an artificial where() clause that is always true (https://github.com/tgriesser/bookshelf/issues/1144)
			return config.bookshelfModel.where(findAllQueryParams(request, config)).where('id', '!=', '0').destroy().then(function (entity) {
              reply().code(204)
            })
          },
		  validate: false,
		  isAllowed: options.allowDeleteAll,
          baseQuery: config.baseQuery,
          bookshelfModel: config.bookshelfModel,
        })
      },
      
      route: function (config) {
		// set default config
		if (typeof config === 'undefined') {
			config = {}
		}
		config = _.merge({
			validate: true,
			isAllowed: true,
		}, config)
		
        server.route({
          method: config.method,
          path: config.path,
          handler: function (request, reply) {
			if (!config.isAllowed) {
				reply.response().code(403)
				return
			}
			
            var validationError = null
            if (request.payload !== null) {
              setForeignKeys(request, config.baseQuery)
              formatNumber(request.payload, config.bookshelfModel.prototype.schema)
              formatDate(request.payload, config.bookshelfModel.prototype.schema)
              
			  try {
				config.beforeValidate(request)
			  }
			  catch (error) {
				handleError(error, reply, options)
				return
			  }
            }
			if (config.validate) {
				Joi.validate(request.payload, Joi.object().keys(pickJoiConstraints(config.bookshelfModel.prototype.schema)), {abortEarly: false, allowUnknown: true}, function(err, value) {
                validationError = err
                // update payload with default values
                request.payload = value
              })
			}
            
            if (validationError === null) {
              // empty relationships that shouldn't be set
              empty(request.payload, config.bookshelfModel.prototype.schema, Empty)
              // call the actual bookshelf model function
              config.handler(request, reply)
              // handle errors
              .catch(function (error) {
				log.error(error)
                handleError(error, reply, options)
				return
              })
            }
            else {
              reply.response(transformConstraintViolationMessages(validationError)).code(400)
            }
          },
        })
      },
      
      empty: function() {
        return Empty
      },      
    }
  }
  
  const Empty = {}
  
  // Set default options
  if (typeof options === 'undefined') {
	options = {}
  }
  options = _.merge({
	returnExceptionBody: true,
	allowDeleteAll: true,
	allowFilters: true,
  }, options)
  
  return functionality(server, options)
}

function handleError(error, reply, options) {
	if (options.returnExceptionBody) {
		reply.response(transformErrorMessage(error)).code(400)
	}
	else {
		reply.response().code(400)
	}
}

const getBaseUrl = hapiCrudHelper.getBaseUrl
const findAllQueryParams = hapiCrudHelper.findAllQueryParams
const findByIdQueryParams = hapiCrudHelper.findByIdQueryParams
const filterQueryParams = hapiCrudHelper.filterQueryParams
const underscore = hapiCrudHelper.underscore
const empty = hapiCrudHelper.empty
const pickJoiConstraints = hapiCrudHelper.pickJoiConstraints
const initModel = hapiCrudHelper.initModel
const addConstraintsForForeignKeys = hapiCrudHelper.addConstraintsForForeignKeys
const initJsonDateFormat = hapiCrudHelper.initJsonDateFormat
const formatNumber = hapiCrudHelper.formatNumber
const formatDate = hapiCrudHelper.formatDate
const setForeignKeys = hapiCrudHelper.setForeignKeys
const transformErrorMessage = hapiCrudHelper.transformErrorMessage
const transformConstraintViolationMessages = hapiCrudHelper.transformConstraintViolationMessages