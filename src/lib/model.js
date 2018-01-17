'use strict';

const _ = require('lodash');

/**
 * Model
 */
module.exports = class Model {

	/**
	 * Model constructor
	 */
	constructor(api) {
		this.Model 		= null;
		this.api 			= api;
		this.hooks 		= {};
		this.inherits = 'Base';
		this.name 		= '';
		this.options 	= {};
		this.schema 	= null;
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
		if (_.isFunction(this.hooks['init-before'])) {
			this.hooks['init-before'].apply(this, []);
		}
		return this;
	}
}