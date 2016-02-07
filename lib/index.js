'use strict'

const Joi = require('joi')
const log = require('npmlog')

const hapiCrudHelper = require('./hapiCrudHelper.js')

module.exports = function (server) {

  const functionality = function (server) {
    return {
      crud: function (config) {
        initModel(config)
      
        // find all
        this.route({
          method: 'GET',
          path: config.basePath,
          handler: function (request, reply) {
            return config.bookshelfModel.where(findAllQueryParams(request, config)).fetchAll().then(function (collection) {
              reply(collection)
            })
          },
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
          baseQuery: config.baseQuery,
          bookshelfModel: config.bookshelfModel,
        })

        // add
        this.route({
          method: ['PUT', 'POST'],
          path: config.basePath,
          handler: function (request, reply) {
            return config.bookshelfModel.forge(request.payload).save().then(function (entity) {
              if (typeof config.afterAdd !== 'undefined') {
                config.afterAdd(entity)
              }
              reply(entity).header('Link', getBaseUrl(request) + config.basePath + '/' + entity.id)
            })
          },
          baseQuery: config.baseQuery,
          bookshelfModel: config.bookshelfModel,
          before: config.beforeAdd,
        })
        
        // update
        this.route({
          method: ['PUT', 'POST'],
          path: config.basePath + '/{id}',
          handler: function (request, reply) {
            return config.bookshelfModel.forge(request.payload).save().then(function (entity) {
              if (typeof config.afterUpdate !== 'undefined') {
                config.afterUpdate(entity)
              }
              reply(entity)
            })
          },
          baseQuery: config.baseQuery,
          bookshelfModel: config.bookshelfModel,
          before: config.beforeUpdate,
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
          baseQuery: config.baseQuery,
          bookshelfModel: config.bookshelfModel,
          before: config.beforeDelete,
        })
      },
      
      route: function (config) {
        server.route({
          method: config.method,
          path: config.path,
          handler: function (request, reply) {
            var validationError = null
            if (request.payload !== null) {
              setForeignKeys(request, config.baseQuery)
              formatNumber(request.payload, config.bookshelfModel.prototype.schema)
              formatDate(request.payload, config.bookshelfModel.prototype.schema)
              
              Joi.validate(request.payload, Joi.object().keys(pickJoiConstraints(config.bookshelfModel.prototype.schema)), {abortEarly: false, allowUnknown: true}, function(err, value) {
                validationError = err
                // update payload with default values
                request.payload = value
              })
            }
            
            if (validationError === null) {
              // empty relationships that shouldn't be set
              empty(request.payload, config.bookshelfModel.prototype.schema, Empty)
              // 'before' hook
              if (typeof config.before !== 'undefined') {
                config.before(request)
              }
              // call the actual bookshelf model function
              config.handler(request, reply)
              // handle errors
              .catch(function (error) {
                log.error(error)
                reply.response(transformErrorMessage(error)).code(400)
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
  
  return functionality(server)
}

const getBaseUrl = hapiCrudHelper.getBaseUrl
const findAllQueryParams = hapiCrudHelper.findAllQueryParams
const findByIdQueryParams = hapiCrudHelper.findByIdQueryParams
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