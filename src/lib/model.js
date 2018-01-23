'use strict';

const _ 				= require('lodash'),
			q 				= require('q'),
			Base 			= require('./base'),
			Permalink = require('./permalink');

module.exports = function() {
	const api = this;

	/**
	 * Model
	 */
	return class Model extends Base {

		/**
		 * Model constructor
		 */
		constructor() {
			super(...arguments);
			this.Model 		= null;
			this.name 		= '';
			this.options 	= {};
			this.schema 	= null;
		}

		/**
		 * The api
		 */
		get api() {
			return api;
		}

		/**
		 * Edit schema
		 */
		edit(object) {
			if (!object || !this.schema) {
				return this;
			}
			_.forEach(object, (value, key) => {
				if (this.schema.path(key)) {
					this.schema.remove(key);
				}
			});
			this.schema.add(object);
			return this;
		}

		/**
		 * Initialize model
		 */
		init() {
			// If there's a Model, then there's no need to reinitialize
			if (this.Model) {
				return this;
			}
			// Requirements
			if (!this.name) {
				this.api.error('Model name is required');
			}
			if (!this.schema) {
				this.api.error('Model schema is required');
			}
			var promises = [];
			this.hook('init-before');
			// Create model
			this.Model = this.api.mongoose.model(this.name, this.schema);
			// Uses permalink
			if (_.isUndefined(this.options.permalink) && this.options.permalink) {
				var name 		= this.options.permalink.name 	|| 'permalink',
						target 	= this.options.permalink.target || 'name';
				this.permalink = new Permalink();
				// Add permalink schema if it doesn't exist
				if (!this.schema.path(name)) {
					this.schema.add({
						permalink: String
					});
				}
				promises.push(q.Promise((resolve, reject) => {
			    this.Model.find({ }, [target, name].join(' ')).exec((err, docs) => {
			      var cache = {};
			      (docs || []).forEach(function(doc) {
			        cache[doc[name]] = doc[target];
			      });
			      this.permalink.load(cache);
			      resolve(this);
			    });
				}));
			}
			// Add model to schema
			this.schema.model = this;
			// Use promise
			return q.all(promises).then(() => {
				this.hook('init-after');
				return this;
			});
		}
	}
};