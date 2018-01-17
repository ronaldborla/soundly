'use strict';

/**
 * Base Model
 */
module.exports = function(Schema) {
	this.inherits = '';
	this.name 		= 'Base';

	/**
	 * Base schema
	 */
	const Base = new Schema({
		created: {
			default: 	Date.now,
			type: 		Date
		},
		updated: {
			default: 	Date.now,
			type: 		Date
		}
	});

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
	 * toJSON/toObject setting
	 */
	Base.set('toJSON',		exportSettings);
	Base.set('toObject', 	exportSettings);

	/**
	 * Before save
	 */
	Base.pre('save', function(next) {
    if (_.isDate(this.updated)) {
      this.updated = Date.now();
    }
    next();
  });

  return Base;
};