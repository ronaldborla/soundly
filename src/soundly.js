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
		this.Exceptions = require('./lib/exceptions');
		this.apis 			= [];
		this.cache  		= {};
		this.dirname 		= __dirname;
		this.env 				= (process.env.NODE_ENV || 'development').toLowerCase();
		this.routes 		= [];
		this.utils 			= utils;
		this.root 			= path.dirname(this.utils.getRootModule(module).filename);
		this.package 		= fs.existsSync(this.path('/package.json')) ? require(this.path('/package.json')) : {};
		this.paths 			= _.extend({
			api: 				'/api',
			config: 		'/config',
			hooks: 			'/hooks',
			media: 			'/media',
			public: 		'/public',
			resources: 	'/resources'
		}, this.package.paths || {});
		var config 			= this.path(this.paths.config + '/' + this.env + '.json');
		this.config 		= _.extend(require(this.path(this.paths.config) + '/default.json'), 
			fs.existsSync(config) ? 
			require(config) : 
			{}
		);
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
	 * Perform hook
	 */
	hook(action, args) {
		return this.utils.hook(this, [
			__dirname + '/hooks/' + action + '.js',
			this.path(this.paths.hooks) + '/' + action + '.js'
		], action, args);
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
	 * Start server
	 */
	start(port, host, versions) {
		var self = this;
		if (!_.isUndefined(versions) && !_.isArray(versions)) {
			versions = [versions];
		}
		this.host = host || 'localhost';
		this.port = port;
		this.apis = this.versions.map((version) => {
			if (_.isUndefined(versions) || (versions.indexOf(version) >= 0)) {
				return new API(this, version);
			}
		}).filter((api) => {
			return !!api;
		});
		return this.utils.queue([
			hook('server-create-before'),
			createServer(),
			hook('server-create-after'),
			startAPIs(),
			hook('server-listen-before'),
			listen(),
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
			return () => {
				self.server = restify.createServer({
				  name:     self.config.name || 'soundly',
				  version:  self.apis.map((api) => {
				  	return api.version;
				  })
				});
				return self.log('Created server `' + self.server.name + '`', 'green');
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
		 * Listen
		 */
		function listen() {
			return () => {
				return q.Promise((resolve) => {
					self.server.listen(port, host, () => {
						resolve(self.log('Started server at port `' + port + '`...', 'green'));
					});
				});
			};
		}

		/**
		 * Start APIs
		 */
		function startAPIs() {
			return () => {
				return self.utils.queue(self.apis.map((api) => {
					return () => {
						return api.start();
					};
				}));
			};
		}
	}
}