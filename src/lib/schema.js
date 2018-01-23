'use strict';

const _ 				= require('lodash'),
			mongoose 	= require('mongoose'),
			utils 		= require('./utils'),
			Schema 		= mongoose.Schema;

/**
 * Export settings
 */
const exportSettings = {
  virtuals: true,
  transform: function(doc, result) {
    delete result._id;
    delete result.__v;
    if (_.isFunction(doc.getExcludedAttributes)) {
      (doc.getExcludedAttributes() || []).forEach((attribute) => {
        if (!_.isUndefined(result[attribute])) {
          delete result[attribute];
        }
      });
    }
  }
};
/**
 * Extend Schema
 */
module.exports = function(model) {
	const api = this;

	/**
	 * Base schema
	 */
	return class Base extends Schema {

		/**
		 * Schema constructor
		 */
		constructor(obj, options) {
			super(null, options);
			// Base properties
			this.add({
				created: {
					default: 	Date.now,
					type: 		Date
				},
				updated: {
					default: 	Date.now,
					type: 		Date
				}
			});
			// Extend schema
			api.hook('schema-base-extend', [this], true);
			// toJSON/toObject setting
			this.set('toJSON',		exportSettings);
			this.set('toObject', 	exportSettings);
			// Pre methods
			this.pre('save', beforeSave);
			// Add user-defined schema
			this.add(obj || {});
			// Apply after hook
			api.hook('schema-base-init', [this], true);
			
		  /**
		   * Before save
		   */
		  function beforeSave(next) {
		    if (_.isDate(this.updated)) {
		      this.updated = Date.now();
		    }
		    // If model uses permalink
		    if (!_.isUndefined(model.options.permalink) && model.options.permalink) {
		    	var name 		= model.options.permalink.name 		|| 'permalink',
		    			target 	= model.options.permalink.target 	|| 'name';
		    	if (!_.isUndefined(model.permalink.cache[name])) {
		    		delete permalink.cache[name];
		    	}
		    	this.permalink = model.permalink.generate(this[target]);
		    }
		    // Use model hook
		    if (_.isFunction(model.hooks['pre-save'])) {
		    	model.hooks['pre-save'].apply(this, [next]);
		    } else {
		    	next();
		    }
		  }
		}
	}
};