'use strict';

const _ 		= require('lodash'),
			utils = require('./utils'),
			Base 	= require('./base');

/**
 * Permalink
 */
module.exports = class Permalink extends Base {
	
	/**
	 * Permalink constructor
	 */
	constructor() {
		super(...arguments);
		this.cache = {};
	}

	/**
	 * Generate permalink
	 */
	generate(string) {
	  var permalink = utils.toPermalink(string),
	      count     = 1;
	  while (!_.isUndefined(this.cache[permalink])) {
	    count++;
	    permalink = utils.toPermalink(string + ' ' + count);
	  }
	  this.cache[permalink] = string;
	  return permalink;
	}

	/**
	 * Load cache
	 */
	load(cache) {
	  this.cache = cache;
	  return this;
	}
}