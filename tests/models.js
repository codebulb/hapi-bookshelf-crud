'use strict'

const Joi = require('joi')

module.exports = function (bookshelf, hapiCrud) {
    return {
        Customer: bookshelf.Model.extend({
            tableName: 'customer',
      schema: {
        name: Joi.string().regex(/^[A-Za-z ]*$/),
        employmentStatus: Joi.string().default('Unemployed'),
        payments: hapiCrud.empty(),
        created: Joi.date().format('YYYY-MM-DD'),
      },
        }),
        Payment: bookshelf.Model.extend({
            tableName: 'payment',
      schema: {
        amount: Joi.number().positive(),
        date: Joi.date().format('YYYY-MM-DD'),
      }
        })
    }
}
