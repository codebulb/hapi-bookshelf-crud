# hapi-bookshelf-crud
Simple CRUD REST-to-SQL with Node.js + [Hapi](http://hapijs.com/) + [Bookshelf.js](http://bookshelfjs.org/) + [Joi](https://github.com/hapijs/joi), e.g. as an AngularJS backend.

*Note: This is a port of the equivalent functionality based on a Java EE server tech stack: [Crudlet](https://github.com/codebulb/crudlet).*

[![npm version](https://badge.fury.io/js/hapi-bookshelf-crud.svg)](https://badge.fury.io/js/hapi-bookshelf-crud) [![Build Status](https://travis-ci.org/codebulb/hapi-bookshelf-crud.svg?branch=master)](https://travis-ci.org/codebulb/hapi-bookshelf-crud)

## Installation
Install it with npm:
```
npm install --save hapi-bookshelf-crud
```

Visit its [npm package page](https://www.npmjs.com/package/hapi-bookshelf-crud) for more information.

## Ways to use it
* Build your Bookshelf.js model and get REST CRUD operations in a few lines of code.
* Concentrate on building front-end logic (e.g. using AngularJS) and be confident that the database backend is “just there”, working as expected
* Rapid-prototype a basic CRUD REST database backend and later switch to a more sophisticated solution, keeping the HTTP interface the same.

## Why you should use it
* Built on top of Hapi / Bookshelf.js / Joi “best of breed” solutions which can still be used as a fallback.
* Extremely small footprint (<= 20KB).
* Human-readable documentation.
* Free & Open source ([New BSD license](https://github.com/codebulb/hapi-bookshelf-crud/blob/master/LICENSE)).

## Usage
Note: For the **complete source code of an example application**, visit:
* [Node.js server](https://github.com/codebulb/hapi-bookshelf-crud-demo)
* [AngularJS client](https://github.com/codebulb/crudletdemo/tree/master/client)

### Server
Given that you have a Hapi instance `server` and a Bookshelf instance `bookshelf`, you can define your model like so:
```
const models = {
  Customer: bookshelf.Model.extend({
    tableName: 'customer',
    schema: {
      name: Joi.string().regex(/^[A-Za-z ]*$/),
      employmentStatus: Joi.string().default('Unemployed'),
      payments: hapiCrud.empty(),
    },
  }),
  Payment: bookshelf.Model.extend({
    tableName: 'payment',
    schema: {
      amount: Joi.number().positive(),
      date: Joi.date().format('YYYY-MM-DD').allow(null),
    }
  })
}
```

And define your CRUD REST endpoints like so:
```
const hapiCrud = require('hapi-bookshelf-crud')(server);

hapiCrud.crud({
  bookshelfModel: models.Customer,
  basePath: '/customers',
});

hapiCrud.crud({
  bookshelfModel: models.Payment,
  basePath: '/customers/{customerId}/payments',
  baseQuery: function(request) {
    return {customerId: request.params.customerId}
  },
});
```

**That’s it.** Now you can use e.g. the [httpie](https://github.com/jkbrzt/httpie) command line tool to verify that you can execute RESTful CRUD operations on your entity running on the database.

Read on for an example client implementation based on AngularJS.

### AngularJS client: Setup
In this example, we use [Restangular](https://github.com/mgonto/restangular) as an abstraction layer to do RESTful HTTP requests which offers a far more sophisticated although more concise API than AngularJS’s built-in `$http` and `$resource`. It is set up as shown in the demo application’s main JavaScript file:
```
.config(function (RestangularProvider) {
	RestangularProvider.setBaseUrl('http://localhost:8080/CrudletDemo.server/');
	
	RestangularProvider.setRequestInterceptor(function(elem, operation) {
		// prevent "400 - bad request" error on DELETE
		// as in https://github.com/mgonto/restangular/issues/78#issuecomment-18687759
		if (operation === "remove") {
			return undefined;
		}
		return elem;
	});
})
```

You also potentially want to install and setup the [angular-translate](http://angular-translate.github.io/) module for I18N support:
```
.config(['$translateProvider', function ($translateProvider) {
	$translateProvider.translations('en', translations);
	$translateProvider.preferredLanguage('en');
	$translateProvider.useMissingTranslationHandlerLog();
	$translateProvider.useSanitizeValueStrategy('sanitize');
}])
```

### AngularJS client: Implementation
In the “controller” JavaScript file, we can use Restangular to access the RESTful web service endpoint of our Crudlet Customer service like so:
* Get a list of entities (GET /customers/): `Restangular.all("customers").getList().then(function(entities) {...})`
* Get a single entity (GET /customers/1): `Restangular.one("customers", $routeParams.id).get().then(function (entity) {...})`
* Save an entity (PUT /customers/1): `$scope.entity.save().then(function() {...})`
* ... (see [Restangular's documentation](https://github.com/mgonto/restangular) for more information)

#### Validation
hapi-bookshelf-crud comes with out-of-the-box support for localized validation error messages. If upon save, a validation error occurs, the server answers e.g. like this:
```
{
    "validationErrors": {
        "name": {
            "attributes": {
                "pattern": "/^[A-Za-z ]*$/",
                "value": "Name not allowed!!"
            },
            "constraintClassName": "string.regex.base",
            "invalidValue": "Name not allowed!!",
            "messageTemplate": "string.regex.base"
        }
    }
}
```

Using the angular-translate module of AngularJS we set up previously, we can show all localized validation messages like so:
```
<div class="alert alert-danger" ng-show="validationErrors != null">
	<ul>
		<li ng-repeat="(component, error) in validationErrors">
			{{'payment.' + component | translate}}: {{'error.' + error.messageTemplate | translate:error.attributes }}
		</li>
	</ul>
</div>
```
The `validationErrors.<property>.messageTemplate` part is the message template returned by the bean validation constraint. We can thus e.g. base the validation error localization on [Hibernate’s own validation messages](http://grepcode.com/file/repo1.maven.org/maven2/org.hibernate/hibernate-validator/5.1.3.Final/org/hibernate/validator/ValidationMessages.properties/):
```
var translations = {
    ...
	'error.string.regex.base': 'must match "{{pattern}}"',
	...
};
```
(I preceded it with `error.` here.)

Because the error object returned by the server is a map, we can also use it to conditionally render special error styling, e.g. using Bootstrap’s error style class:
```
ng-class="{'has-error': errors.amount != null}"
```

#### Exceptions
Similar to validation errors, some runtime exceptions will also return a user-friendly error response message. For instance, let’s assume that a Customer has a list of Payments and you try to delete a Customer with a non-empty Payments list:
```
{
    "error": {
        "detailMessage": "delete from `customer` where `id` = '1' - ER_ROW_IS_REFERENCED_2: Cannot delete or update a parent row: a foreign key constraint fails (`restdemo`.`payment`, CONSTRAINT `payment_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customer` (`id`))",
        "exception": "ER_ROW_IS_REFERENCED_2"
    }
}
```
Again, you can catch and display these in the AngularJS view:
```
<div class="alert alert-danger" ng-show="errorNotFound != null || error != null">
	<ul>
		<li ng-show="error != null">
			{{'error.' + error.exception | translate}}
		</li>
	</ul>
</div>
```
With appropriate localization:
```
var translations = {
    ...
	'error.ER_ROW_IS_REFERENCED_2': 'Cannot delete an object which is still referenced to by other objects.',
	...
};
```

## Specification
### REST service endpoints
Crudlet maps these HTTP requests to persistence storage operations:

* `GET /contextPath/model`: `service#findAll()`
  * Searches for all entities of the given type.
  * returns HTTP 200 OK with list of entities
* `GET /contextPath/model/:id`: `service#findById(id)`
  * Searches for the entity of the given type with the given id.
  * returns HTTP 200 OK with entity if found; or HTTP 404 NOT FOUND if entity is not found.
* `PUT /contextPath/model/` with entity or `PUT /contextPath/model/:id` with entity or `POST /contextPath/model/` with entity or POST `/contextPath/model/:id` with entity: `service#save(entity)`
  * Saves the entity for the first time or updates the existing entity, based on the presence of an id on the entity.
  * returns HTTP 200 OK with updated entity (e.g. new id) and Link header with content “/contextPath/model/:id”; or HTTP 400 BAD REQUEST with error information on validation error
* `DELETE /contextPath/model/:id` or `DELETE /contextPath/model/:id` with entity: `service#delete(id)`
  * Deletes the entity with the id provided
  * returns HTTP 204 NO CONTENT.

These REST service endpoints are optimized for use with a [Restangular](https://github.com/mgonto/restangular) client.

#### Validation errors
A validation error returns with HTTP 400 BAD REQUEST and the following error information (as far as it is available) in the body:
* `validationError`
  * (for every erronous property): `[property]`
    * `constraintClassName`: Joi `error.details.type`
    * `messageTemplate`: Same as `constraintClassName`
    * `invalidValue`: Joi `error.details.context.value`
    * `attributes`: Joi `error.details.context` without `value`

#### Other errors
A non-validation error returns with HTTP 400 BAD REQUEST and the following error information (as far as it is available) in the body:
* `error`
  * `exception`: `error.code`
  * `detailMessage`: `error.message`

### Server API
#### Module import
```
require('hapi-bookshelf-crud')(server)
```
Sets the reference to the Hapi server provided and returns the **hapi-bookshelf-crud** instance.

Parameters:
* `server`: the Hapi server instance

#### instance.crud
```
hapiCrud.crud(config)
```
Registers CRUD REST service endpoints according to the specification (see above) on the server for the config provided. It internally uses `instance.route` to register each CRUD operation on the server.

Parameters:
* `config`: the CRUD configuration
  * `bookshelfModel`: `Object`. Required. Reference to the bookshelf model (e.g. created with `bookshelf.Model.extend({})`) representing the entity the CRUD operations are invoked on.
  * `basePath`: `String`. Required. The REST endpoint's base path for all CRUD operations. This will be the REST endpoint for the "find all" operation; other operations may add an identifier: `basePath + '/{id}'`.  Must not start nor end with `/`.
  * `baseQuery`: `Map`. Optional. A map containing additional parameters for every find query. The basic query parameter `{'id': request.params.id}` is always applied to the "find by id" query and cannot be changed. This option is used to resolve additional parameters for a nested resource.
  * `beforeAdd`: `Function(Hapi.Request) -> Void`. Optional. The function to be invoked on the Hapi request before "add" query.
  * `beforeSave`: `Function(Hapi.Request) -> Void`. Optional. The function to be invoked on the Hapi request before "save" query.
  * `beforeDelete`: `Function(Hapi.Request) -> Void`. Optional. The function to be invoked on the Hapi request before "delete" query.

#### instance.route
```
hapiCrud.route(config)
```
Registers a REST service endpoints on the server for the config provided. Registration includes model cleanup, validation and error handling according to the specification (see above). You wouldn't normally call this function to register an individual REST endpoint, but `instance.crud` to register all REST endpoints necessary to set up full CRUD. However, you can use this function to register additional REST endpoints with all the automated model handling in place. This really is a wrapper for `server.route` of the Hapi server.

Parameters:
* `config`: the REST endpoint configuration
  * `method`: As in Hapi `server.route`.
  * `path`: As in Hapi `server.route`.
  * `handler`: `Function(Hapi.Request, Hapi.Reply) -> Promise`. The request / response handler function, as in Hapi `server.route`. Note that before the handler is invoked, model cleanup, validation, and the `before` function is processed; afterwards, validation error handling and error handling are processed.
  * `bookshelfModel`: As in `instance.crud`.
  * `basePath`: As in `instance.crud`.
  * `baseQuery`: As in `instance.crud`.
  * `before`: `Function(Hapi.Request) -> Void`. Optional. The function to be invoked on the Hapi request before the query

#### instance.empty
```
hapiCrud.empty()
```
Returns a simple object used as a "marker" in a Bookshelf.js model's `schema` map to mark relationships which should be emptied before saving the model.

### Model API
hapi-bookshelf-crud works with Bookshelf.js models (as created with `bookshelf.Model.extend({})`), and uses additional properties on the model to control behavior:
* `tableName`: As in Bookshelf.js `bookshelf.Model.tableName`
* `schema`: Map. Optional. Contains a key / value pair which is used as the `schema` to validate the `model` using Joi as in `Joi.validate(request.payload, Joi.object().keys(pickJoiConstraints(config.bookshelfModel.prototype.schema)), {abortEarly: false, allowUnknown: true}, function(err, value) {...})`. The schema uses model property names as keys and Joi objects as values. Additionally, it support some special behavior for properties whose value is one of the following:
  * `Joi.number()`: Additionally to the normal Joi validation functionality, during model cleanup, empty numbers are replaced with 0.
  * `Joi.date().format(String)`: Additionally to the normal Joi validation functionality, during model cleanup, dates are initialized as JavaScript `Date` objects; and when returning an object, the `format` is used to format the outcome JSON (rather than using the plain SQL date format).
  * `hapiCrud.empty()` marks this property as a link to a relation which should be emptied before saving the model to the DB. This is necessary because Bookshelf.js support for cascade save is faulty and actually doesn't make sense in a strict REST architecture, as a sub-model would really be addressed by another (nested) REST endpoint. Hence, define all property relations in the schema as `hapiCrud.empty()`.

Also, hapi-bookshelf-crud automatically converts snake_casing of table columns on the SQL side to camelCasing on the model side and vice versa; hence, use camelCasing for model and schema property keys.

This functionality requires initialization of the model during `hapiCrud.crud(config)`.

## Project status and future plans
This npm package is currently experimental and clearly in a very early stage. It may still already be useful for evaluation or prototyping purposes.

This is a private project I’ve started for my own pleasure and usage and to learn more about building REST APIs with Node.js, and I have no plans for (commercial) support. I may or may not continue to work on this project in the near future.

If you think this project is interesting, and you have knowledge in Node.js / Hapi / Bookshelf.js / Joi and would like to contribute, I encourage you to do so by opening an issue and / or make a pull request.

Please visit the **[accompanying blog post](http://www.codebulb.ch/2016/02/new-npm-package-rapid-prototyping-crud-rest-to-sql.html)** to learn more about the motivation behind this project.
