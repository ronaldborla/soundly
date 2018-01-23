const _ 			= require('lodash'),
			chalk 	= require('chalk'),
			fs 			= require('fs-extra'),
			glob 		= require('glob'),
			path 		= require('path'),
			q 			= require('q'),
			restify = require('restify'),
			API 		= require('./lib/api'),
			utils		= require('./lib/utils');

/**
 * Soundly
 */
module.exports = class Soundly {
	/**
	 * Soundly constructor
	 */
	constructor() {
		this.apis 			= [];
		this.cache  		= {};
		this.dirname 		= __dirname;
		this.env 				= (process.env.NODE_ENV || 'development').toLowerCase();
		this.Navigator  = require('./lib/navigator');
		this.routes 		= [];
		this.utils 			= utils;
		this.root 			= path.dirname(this.utils.getRootModule(module).filename);
		this.package 		= fs.existsSync(this.path('/package.json')) ? require(this.path('/package.json')) : {};
		this.paths 			= _.extend({
			api: 				'/api',
			config: 		'/config',
			hooks: 			'/hooks',
			public: 		'/public',
			resources: 	'/resources'
		}, this.package.paths || {});
		var config 			= this.path(this.paths.config + '/' + this.env + '.json');
		this.config 		= _.extend(require(this.path(this.paths.config) + '/default.json'), 
			fs.existsSync(config) ? 
			require(config) : 
			{}
		);
		if (_.isUndefined(this.config.root)) {
			this.config.root = 'api/';
		}
	}

	/**
	 * Get available versions
	 */
	get versions() {
		if (!_.isUndefined(this.cache.versions)) {
			return this.cache.versions;
		}
		var api_path = this.path(this.paths.api);
		return this.cache.versions = glob.sync(api_path + '/*/').map((directory) => {
			return _.trimEnd(directory.substr(api_path.length + 1), '/');
		});
	}

	/**
	 * Error
	 */
	error(err) {
		console.log(err);
		this.log(err, 'red');
		throw new Error(err);
	}

	/**
	 * Handle error page
	 */
	handle(req, res, code) {
		(new this.Exceptions([({
			401: 'BAD_REQUEST',
			403: 'PERMISSION_DENIED',
			404: 'RESOURCE_NOT_FOUND',
			405: 'METHOD_NOT_ALLOWED'
		})[code]])).send(res);
	}

	/**
	 * Perform hook
	 */
	hook(action, args, sync) {
		return this.utils.hook(this, [
			__dirname + '/hooks/' + action + '.js',
			this.path(this.paths.hooks) + '/' + action + '.js'
		], args, sync);
	}

	/**
	 * Log something to console
	 */
	log(message, color) {
		console.log(_.isUndefined(color) ? message : chalk[color](message));
		return this;
	}

	/**
	 * Get absolute path
	 */
	path(relative, version) {
		return (_.isUndefined(version) ? this.root : (this.path(this.paths.api) + '/' + version)) + relative;
	}

	/**
	 * Initialize
	 */
	init(versions) {
		var self = this;
		if (!_.isUndefined(versions) && !_.isArray(versions)) {
			versions = [versions];
		}
		this.apis = this.versions.map((version) => {
			if (_.isUndefined(versions) || (versions.indexOf(version) >= 0)) {
				return new API(this, version);
			}
		}).filter((api) => {
			return !!api;
		});
		return this.hook('apis-start-before').then(() => {
			return this.utils.queue(this.apis.map((api) => {
				return () => {
					return api.start();
				};
			}));
		}).then(() => {
			return this.hook('apis-start-after');
		}).then(() => {
			return this;
		});
	}

	/**
	 * Start server
	 */
	start(port, host, versions) {
		var self = this;
		this.host = host || 'localhost';
		this.port = port;
		return this.utils.queue([
			hook('exceptions-register-before'),
			registerExceptions,
			hook('exceptions-register-after'),
			hook('server-create-before'),
			createServer,
			hook('server-create-after'),
			hook('server-initialize-before'),
			initializeServer,
			hook('server-initialize-after'),
			hook('server-listen-before'),
			listen,
			hook('server-listen-after')
		]).catch((err) => {
			this.error(err);
		}).then(() => {
			return this;
		});

		/**
		 * Create server
		 */
		function createServer() {
			self.server = restify.createServer({
			  name:     self.config.name || 'soundly',
			  version:  self.apis.map((api) => {
			  	return api.version;
			  })
			});
			self.server.on('NotFound', (req, res) => {
				self.handle(req, res, 404);
			});
			return self.log('Created server `' + self.server.name + '`', 'green');
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
		 * Initialize server
		 */
		function initializeServer() {
			return self.init(versions);
		}

		/**
		 * Listen
		 */
		function listen() {
			return q.Promise((resolve) => {
				self.server.listen(port, host, () => {
					resolve(self.log('Started server at port `' + port + '`...', 'green'));
				});
			});
		}

		/**
		 * Register exceptions
		 */
		function registerExceptions() {
			return q.Promise((resolve) => {
				resolve(self.Exceptions = require('./lib/exceptions').apply(self, [require('./exceptions/server') || {}]));
			});
		}
	}
}