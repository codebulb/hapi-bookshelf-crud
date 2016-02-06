'use strict'

const Hapi = require('hapi')
const dbProperties = require('./serverStartup/dbProperties.js')
const dbInit = require('./serverStartup/dbInit.js')

// Setup Bookshelf / Knex
const knex = require('knex')(dbProperties)
const bookshelf = require('bookshelf')(knex)
bookshelf.plugin('virtuals')

// Setup Hapi
const server = new Hapi.Server()
server.connection({ routes: {cors: true }, port: 3000 })
const hapiCrud = require('./serverStartup/hapiCrud.js')(server)

// Models ====================

const models = require('./serverStartup/models.js')(bookshelf, hapiCrud)
const Customer = models.Customer
const Payment = models.Payment


// REST service endpoints ====================

hapiCrud.crud({
  bookshelfModel: Customer,
  basePath: '/customers',
})

hapiCrud.crud({
  bookshelfModel: Payment,
  basePath: '/customers/{customerId}/payments',
  baseQuery: function(request) {
    return {customerId: request.params.customerId}
  },
})


// Startup server ====================

server.start(() => dbInit(knex, function() {
  console.log('Server running at:', server.info.uri)
}))