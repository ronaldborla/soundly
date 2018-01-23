'use strict';

const _ 				= require('lodash'),
			fs 				= require('fs-extra'),
			glob 			= require('glob'),
			mongoose 	= require('mongoose'),
			q 				= require('q');

/**
 * API class
 */
module.exports = class API {
	/**
	 * API constructor
	 */
	constructor(soundly, path) {
		this.cache 				= {};
		this.Controller 	= require('./controller').apply(this, []),
		this.controllers  = [];
		this.Media 				= require('./media').apply(this, []);
		this.middleware 	= {
			active: 	{},
			passive: 	{}
		};
		this.Model 				= require('./model').apply(this, []),
		this.models 			= [];
		this.root 				= soundly.path('', path);
		this.Route 				= require('./route').apply(this, []);
		this.routes 			= [];
		this.soundly 			= soundly;
		this.paths 				= _.extend({
			config: 			'/config',
			controllers: 	'/controllers',
			exceptions: 	'/exceptions',
			hooks: 				'/hooks',
			keys: 				'/keys',
			media: 				'/media',
			middleware: 	'/middleware',
			models: 			'/models',
			routes: 			'/routes'
		}, fs.existsSync(this.path('paths.json')) ? 
			require(this.path('paths.json')) : 
			{}
		);
		var config 				= this.path('/' + soundly.env + '.json', 'config');
		this.config 			= _.extend(require(this.path('/default.json', 'config')), 
			fs.existsSync(config) ? 
			require(config) : 
			{}
		);
		this.version 			= this.config.version;
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
	 * Register a controller
	 */
	controller(define, name) {
		if (_.isString(define)) {
			return this.controllers.find((controller) => {
				return controller.name === define;
			});
		}
		if (!_.isFunction(define)) {
			this.error('Controller definition must be a function');
		}
		this.controllers.push(new (define.apply(this, [this.Controller]))(name));
		return this;
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
	hook(action, args, sync) {
		return this.utils.hook(this, [
			this.path('/' + action + '.js', 'hooks')
		], args, sync);
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
			this.error('Model definition must be a function');
		}
		var model 	= new this.Model(),
				Schema  = require('./schema').apply(this, [model]),
				schema 	= define.apply(model, [Schema]);
		if (schema && schema instanceof Schema) {
			model.schema = schema;
		}
		this.models.push(model);
		return this;
	}

	/**
	 * Get absolute path
	 */
	path(relative, path) {
		return this.root + (!_.isUndefined(path) ? (this.paths[path]) : '') + relative;
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
			this.error('Route definition must be a function');
		}
	  var route = new this.Route(base);
	  define.apply(route, []);
	  this.routes.push(route);
	  return this;
	}

	/**
	 * Start API server
	 */
	start(partial) {
		var self = this;
		var actions = [
			hook('api-start-before'),
			hook('database-connect-before'),
			connectDatabase,
			hook('database-connect-after'),
			hook('exceptions-register-before'),
			registerExceptions,
			hook('exceptions-register-after'),
			hook('models-register-before'),
			registerModels,
			hook('models-register-after'),
			hook('models-initialize-before'),
			initializeModels,
			hook('models-initialize-after')
		];
		if (!partial) {
			actions = actions.concat([
				hook('middleware-register-before'),
				registerMiddleware,
				hook('middleware-register-after'),
				hook('controllers-register-before'),
				registerControllers,
				hook('controllers-register-after'),
				hook('routes-register-before'),
				registerRoutes,
				hook('routes-register-after'),
				hook('routes-initialize-before'),
				initializeRoutes,
				hook('routes-initialize-after')
			]);
		}
		actions.push(hook('api-start-after'));
		return this.utils.queue(actions).then(() => {
			return this;
		});

		/**
		 * Connect database
		 */
		function connectDatabase() {
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
		 * Initialize models
		 */
		function initializeModels() {
			return self.utils.queue(self.models.map((model) => {
				return () => {
					return model.init();
				};
			}));
		}

		/**
		 * Initialize routes
		 */
		function initializeRoutes() {
			return self.utils.queue(self.routes.map((route) => {
				return () => {
					return route.init();
				};
			}));
		}

		/**
		 * Register controllers
		 */
		function registerControllers() {
			return q.Promise((resolve) => {
				[
					self.soundly.dirname + '/controllers/',
					self.path('/', 'controllers')
				].forEach((croot) => {
					self.utils.require([croot + '**/*.js'], (callback, filename) => {
						self.controller(callback, filename.substr(croot.length, filename.length - croot.length - 3));
					}, _.isFunction);
				});
				resolve(self);
			});
		}

		/**
		 * Register exceptions
		 */
		function registerExceptions() {
			return q.Promise((resolve) => {
				var codes = {};
				self.utils.require([
					self.soundly.dirname + '/exceptions/**/*.js',
					self.path('/**/*.js', 'exceptions')
				], (exceptions) => {
					_.extend(codes, exceptions);
				}, _.isObject);
				resolve(self.Exceptions = require('./exceptions').apply(self, [codes]));
			});
		}

		/**
		 * Register middleware
		 */
		function registerMiddleware() {
			return q.Promise((resolve) => {
				var active = [];
				['active', 'passive'].forEach((type) => {
					[
						self.soundly.dirname + '/middleware/' + type,
						self.path('/' + type, 'middleware')
					].forEach((mroot) => {
						var length = mroot.length;
						self.utils.require([mroot + '/**/*.js'], (middleware, filename) => {
							var name = filename.substr(length + 1, filename.length - length - 4);
							// Default priority is 100
							if (_.isUndefined(middleware.priority)) {
								middleware.priority = 100;
							}
							// Override named middleware. Middleware names are the filenames
							self.middleware[type][name] = middleware;
							if (type === 'active') {
								active.push({
									name: 		name,
									priority: middleware.priority
								});
							}
						}, _.isFunction);
					});
				});
				// Sort priority from largest
				active.sort((a, b) => {
					return b.priority - a.priority;
				});
				self.middleware.active._index = active.map((item) => {
					return item.name;
				});
				resolve(self);
			});
		}

		/**
		 * Register models
		 */
		function registerModels() {
			return q.Promise((resolve) => {
				self.utils.require([
					self.soundly.dirname + '/models/**/*.js',
					self.path('/**/*.js', 'models')
				], (callback) => {
					self.model(callback);
				}, _.isFunction);
				resolve(self);
			});
		}

		/**
		 * Register routes
		 */
		function registerRoutes() {
			return q.Promise((resolve) => {
				[
					self.soundly.dirname + '/routes/',
					self.path('/', 'routes')
				].forEach((rroot) => {
					self.utils.require([rroot + '**/*.js'], (callback, filename) => {
						self.route(callback, filename.substr(rroot.length, filename.length - rroot.length - 3));
					}, _.isFunction);
				});
				resolve(self);
			});
		}
	}
}