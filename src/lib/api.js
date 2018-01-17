'use strict';

const _ 				= require('lodash'),
			fs 				= require('fs-extra'),
			glob 			= require('glob'),
			mongoose 	= require('mongoose'),
			q 				= require('q'),
			Model 		= require('./Model'),
			Route 		= require('./Route');

/**
 * API class
 */
module.exports = class API {
	/**
	 * API constructor
	 */
	constructor(soundly, path) {
		this.cache 		= {};
		this.models 	= [];
		this.root 		= soundly.path('', path);
		this.routes 	= [];
		this.soundly 	= soundly;
		this.paths 		= _.extend({
			config: 			'/config',
			controllers: 	'/controllers',
			exceptions: 	'/exceptions',
			hooks: 				'/hooks',
			keys: 				'/keys',
			middleware: 	'/middleware',
			models: 			'/models',
			routes: 			'/routes'
		}, fs.existsSync(this.path('paths.json')) ? 
			require(this.path('paths.json')) : 
			{}
		);
		var config 		= this.path(this.paths.config + '/' + soundly.env + '.json');
		this.config 	= _.extend(require(this.path(this.paths.config + '/default.json')), 
			fs.existsSync(config) ? 
			require(config) : 
			{}
		);
		this.version 	= this.config.version;
		if (_.isUndefined(this.config.root)) {
			this.config.root = path + '/';
		}
	}

	/**
	 * Get database name
	 */
	get database_name() {
		if (!_.isUndefined(this.cache.database_name)) {
			return this.cache.database_name;
		}
		var arr_uri = this.config.database.uri.split('/');
		return this.cache.database_name = arr_uri[arr_uri.length - 1];
	}

	/**
	 * Utils
	 */
	get utils() {
		return this.soundly.utils;
	}

	/**
	 * Error
	 */
	error() {
		return this.soundly.error.apply(this, arguments);
	}

	/**
	 * Hook
	 */
	hook(action, args) {
		return this.utils.hook(this, [
			this.path(this.paths.hooks) + '/' + action + '.js'
		], action, args);
	}

	/**
	 * Log
	 */
	log() {
		return this.soundly.log.apply(this, arguments);
	}

	/**
	 * Register a model
	 */
	model(define) {
		if (_.isString(define)) {
			return this.models.find((model) => {
				return model.name === define;
			});
		}
		if (!_.isFunction(define)) {
			throw new Error('Model definition must be a function');
		}
		var model 	= new Model(this),
				schema 	= define.apply(model, [mongoose.Schema]);
		if (schema && schema instanceof mongoose.Schema) {
			model.schema = schema;
		}
		this.models.push(model);
		return model;
	}

	/**
	 * Get absolute path
	 */
	path(relative) {
		return this.root + relative;
	}

	/**
	 * Register route
	 */
	route(define, base) {
		if (_.isString(define)) {
			return this.routes.find((route) => {
				return route.name === define;
			});
		}
		if (!_.isFunction(define)) {
			throw new Error('Route definition must be a function');
		}
	  var route = new Route(this, base);
	  define.apply(route, []);
	  this.routes.push(route);
	  return route.init();
	}

	/**
	 * Start API server
	 */
	start() {
		var self = this;
		return this.utils.queue([
			hook('api-start-before'),
			hook('database-connect-before'),
			connectDatabase(),
			hook('database-connect-after'),
			hook('models-register-before'),
			registerModels(),
			hook('models-register-after'),
			// hook('middleware-register-before'),
			// registerMiddleware(),
			// hook('middleware-register-after'),
			// hook('routes-register-before'),
			// registerRoutes(),
			// hook('routes-register-after'),
			hook('api-start-after')
		]).then(() => {
			return this;
		});

		/**
		 * Connect database
		 */
		function connectDatabase() {
			return () => {
				if (!self.config.database) {
					self.config.database = {};
				}
				if (!mongoose.Promise) {
					mongoose.Promise = q.Promise;
				}
				return q.Promise(function(resolve, reject) {
					self.mongoose = mongoose.createConnection(self.config.database.uri, self.config.database.options || {}, () => {
						self.log('v' + self.version + ': Connection created to database `' + self.database_name + '`', 'yellow');
						resolve(self.mongoose);
					});
				});
			};
		}

		/**
		 * Hook queue
		 */
		function hook(action, args) {
			return () => {
				return self.hook(action, args);
			};
		}

		/**
		 * Register middleware
		 */
		function registerMiddleware() {
			return () => {

			};
		}

		/**
		 * Register models
		 */
		function registerModels() {
			return () => {
				return q.Promise((resolve) => {
					self.utils.require([
						self.soundly.dirname + '/models/**/*.js',
						// this.path(this.paths.models) + '/**/*.js'
					], (callback) => {
						self.model(callback);
					}, _.isFunction);
					self.models.forEach((model) => {
						model.init();
					});
					resolve(self);
				});
			};
		}

		/**
		 * Register routes
		 */
		function registerRoutes() {
			return () => {

			};
		}
	}
}