'use strict'

const Hapi = require('hapi')
const Joi = require('joi')

const assert = require('assert')
const sinon = require('sinon')

const knex = {}
const bookshelf = require('bookshelf')(knex)

const server = sinon.stub(new Hapi.Server())

const hapiCrud = require('../lib')(server)
const hapiCrudHelper = require('../lib/hapiCrudHelper.js')

const models = require('./models.js')(bookshelf, hapiCrud)
const bookshelfModel = models.Customer

hapiCrud.crud({
  basePath: '/customers',
  bookshelfModel: bookshelfModel,
})

describe('hapiCrudHelper.underscore', function () {
  it('should return a map the keys converted to underscore_case.', function (done) {
    const input = {
      name: 'myName',
      customerId: 'myCustomerId',
    }
    
    const expected = {
      name: 'myName',
      customer_id: 'myCustomerId',
    }
    
    assert.deepEqual(hapiCrudHelper.underscore(input), expected)
    done()
  })
})

describe('hapiCrudHelper.findAllQueryParams', function () {
  it('should build the "find all" WHERE clause query param map by taking into consideration config.baseQuery.', function (done) {
    const request = {
      params: {
        customerId: 'myCustomerId',
        otherId: 'myOtherId',
      },
    }
    const config = {
      baseQuery: function(request) {
        return {
          customerId: request.params.customerId
        }
      },
    }
    
    const expected = {
      customer_id: 'myCustomerId',
    }
    
    assert.deepEqual(hapiCrudHelper.findAllQueryParams(request, config), expected)
    done()
  })
})

describe('hapiCrudHelper.findByIdQueryParams', function () {
  it('should build the "find by id" WHERE clause query param map by taking into consideration config.baseQuery.', function (done) {
    const request = {
      params: {
        id: 'myId',
        customerId: 'myCustomerId',
        otherId: 'myOtherId',
      },
    }
    const config = {
      baseQuery: function(request) {
        return {
          customerId: request.params.customerId
        }
      },
    }
    
    const expected = {
      id: 'myId',
      customer_id: 'myCustomerId',
    }
    
    assert.deepEqual(hapiCrudHelper.findByIdQueryParams(request, config), expected)
    done()
  })
})

describe('hapiCrudHelper.empty', function () {
  it('should delete any properties from the entity which in the schema are marked as Empty.', function (done) {
    const entity = {
      id: 'myId',
      name: 'myName',
      payments: [
        {
          id: 'myPaymentsId',
        },
      ],
    }
    const schema =  {
      name: Joi.string().regex(/^[A-Za-z ]*$/),
      payments: hapiCrud.empty(),
    }
    
    const expected = {
      id: 'myId',
      name: 'myName',
    }
    
    hapiCrudHelper.empty(entity, schema, hapiCrud.empty())
    assert.deepEqual(entity, expected)
    done()
  })
})

describe('hapiCrudHelper.pickJoiConstraints', function () {
  it('should return a map with all the Joi validation constraints from the schema provided.', function (done) {
    const nameConstraint = Joi.string().regex(/^[A-Za-z ]*$/)
    const schema =  {
      name: nameConstraint,
      payments: hapiCrud.empty(),
    }
    
    const expected = {
      name: nameConstraint,
    }
    
    assert.deepEqual(hapiCrudHelper.pickJoiConstraints(schema), expected)
    done()
  })
})

describe('hapiCrudHelper.addConstraintsForForeignKeys', function () {
  it('should add required() validation constraints to all the bookshelfModel\'s foreign keys, as defined in baseQuery.', function (done) {
    const bookshelfModel = {
      prototype: {
        schema: {
          name: Joi.string().regex(/^[A-Za-z ]*$/),
          customerId: Joi.number(),
        }
      }
      
    }
    
    const baseQuery = function(request) {
      return {
        customerId: request.params.customerId,
        purchaseId: request.params.purchaseId,
      }
    }
    
    hapiCrudHelper.addConstraintsForForeignKeys(bookshelfModel, baseQuery)
    
    assert.strictEqual(bookshelfModel.prototype.schema.name._flags.presence, undefined)
    assert.equal(bookshelfModel.prototype.schema.customerId._flags.presence, 'required')
    assert.equal(bookshelfModel.prototype.schema.purchaseId._flags.presence, 'required')
    done()
  })
})

// TODO Test hapiCrudHelper.initJsonDateFormat

describe('hapiCrudHelper.formatNumber', function () {
  it('should initialize every empty number property of a payload, as defined in the schema provided, with 0.', function (done) {
    const payload = {
      id: 'myId',
      created: '2016-02-07',
    }
    const schema =  {
      amount: Joi.number().positive(),
      created: Joi.date().format('YYYY-MM-DD'),
    }
    
    hapiCrudHelper.formatNumber(payload, schema)
    
    assert.equal(payload.amount, 0)
    assert.equal(payload.id, 'myId')
    assert.equal(payload.created, '2016-02-07')
    done()
  })
})

describe('hapiCrudHelper.formatDate', function () {
  it('should apply simple to-date conversion for every date property of a payload, as defined in the schema provided.', function (done) {
    const payload = {
      id: 'myId',
      name: 'myName',
      created: '2016-02-07',
    }
    const schema =  {
      name: Joi.string().regex(/^[A-Za-z ]*$/),
      created: Joi.date().format('YYYY-MM-DD'),
    }
    
    hapiCrudHelper.formatDate(payload, schema)
    
    assert.ok(!(payload.name instanceof Date))
    assert.ok(payload.created instanceof Date)
    done()
  })
})

describe('hapiCrudHelper.setForeignKeys', function () {
  it('should copy the value of the foreign keys, as defined in baseQuery, provided by request.params, to the request.payload model.', function (done) {
    const request = {
      params: {
        customerId: 'myCustomerId',
        otherId: 'myOtherId',
      },
      payload: {
        id: 'myId',
      },
    }
    const baseQuery =  function(request) {
      return {
        customerId: request.params.customerId
      }
    }
    
    const expected = {
      id: 'myId',
      customerId: 'myCustomerId',
    }
    
    hapiCrudHelper.setForeignKeys(request, baseQuery)
    
    assert.deepEqual(request.payload, expected)
    done()
  })
})

describe('transformErrorMessage', function () {
  it('should convert the error object provided into the specified error message format.', function (done) {
    const error =  {
      code: 'ER_ROW_IS_REFERENCED_2',
      errno: 1451,
      index: 0,
      isOperational: true,
      message: 'delete from `customer` where `id` = "2" - ER_ROW_IS_REFERENCED_2: Cannot delete or update a parent row: a foreign key constraint fails (`restdemo`.`payment`, CONSTRAINT `payment_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customer` (`id`))',
      sqlState: '23000',
    }
    
    const expected = {
      error: {
        detailMessage: 'delete from `customer` where `id` = "2" - ER_ROW_IS_REFERENCED_2: Cannot delete or update a parent row: a foreign key constraint fails (`restdemo`.`payment`, CONSTRAINT `payment_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customer` (`id`))',
        exception: 'ER_ROW_IS_REFERENCED_2',
      },
    }
    
    assert.deepEqual(hapiCrudHelper.transformErrorMessage(error), expected)
    done()
  })
})

describe('transformConstraintViolationMessages', function () {
  it('should convert the error object provided into the specified validation constraint violation error message format.', function (done) {
    const error =  {
      isJoi: true,
      name: 'ValidationError',
      details: [
        {
          message: '\name\' with value \'Name not allowed&#x21&#x21\' fails to match the required pattern: /^[A-Za-z ]*$/',
          path: 'name',
          type: 'string.regex.base',
          context: {
            pattern: "/^[A-Za-z ]*$/",
            value: 'Name not allowed!!',
            key: 'name'
          }
        },
        {
          message: '\'employmentStatus\' is required',
          path: 'employmentStatus',
          type: 'any.required',
          context: {
            key: 'employmentStatus'
          }
        }
      ],
      _object: {
        name: 'Name not allowed!!'
      }
    }
    
    const expected = {
      validationErrors: {
        name: {
          attributes: {
            pattern: "/^[A-Za-z ]*$/",
            value: "Name not allowed!!"
          },
          constraintClassName: "string.regex.base",
          invalidValue: "Name not allowed!!",
          messageTemplate: "string.regex.base"
        },
        employmentStatus: {
          attributes: {},
          constraintClassName: "any.required",
          messageTemplate: "any.required"
        }
      }
    }
    // must use JSON.stringify here because hapiCrudHelper.transformConstraintViolationMessages enriches error object with additional properties (for unknown reasons, probably lodash)
    assert.equal(JSON.stringify(hapiCrudHelper.transformConstraintViolationMessages(error)), JSON.stringify(expected))
    done()
  })
})