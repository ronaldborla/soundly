'use strict';

const _ = require('lodash');

/**
 * Base prototype
 */
module.exports = class Base {

	/**
	 * The constructor
	 */
	constructor() {
		this.hooks = {};
	}

	/**
	 * Execute hook
	 */
	hook(name, args) {
		if (_.isFunction(this.hooks[name])) {
			return this.hooks[name].apply(this, args || []);
		}
	}
}