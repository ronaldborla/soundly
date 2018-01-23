'use strict';

const _ 		= require('lodash'),
			utils = require('./utils');

module.exports = function(codes) {
	
	/**
	 * Exceptions
	 */
	return class Exceptions extends Array {
		
		/**
		 * The constructor
		 */
		constructor(exceptions) {
			super();
  		this.push.apply(this, exceptions || []);
		}

		/**
		 * Cast exception
		 */
		cast(item) {
		  var UNKNOWN_EXCEPTION = 'UNKNOWN_EXCEPTION';
		  if (_.isString(item)) {
		    if (_.isUndefined(codes[item])) {
		      item = UNKNOWN_EXCEPTION;
		    }
		    return {
		      code:     item,
		      message:  codes[item][1],
		      status:   codes[item][0]
		    };
		  } else if (_.isObject(item)) {
		    var code = _.isUndefined(codes[item.code || '']) ? UNKNOWN_EXCEPTION : item.code;
		    var exception = {
		      code:     code,
		      message:  item.message  || codes[code][1] || 'Unknown exception',
		      status:   item.status   || codes[code][0] || 500
		    };
		    if (!_.isUndefined(item.field) && item.field) {
		      exception.field = item.field;
		    }
		    return exception;
		  } else {
		    return {
		      code:     UNKNOWN_EXCEPTION,
		      message:  codes[UNKNOWN_EXCEPTION][1],
		      status:   codes[UNKNOWN_EXCEPTION][0]
		    };
		  }
		}

		/**
		 * Export
		 */
		export() {
			var exceptions = [];
			this.forEach((exception) =>  {
				exceptions.push(_.pick(exception, ['code', 'message']));
			});
			return exceptions;
		}

		/**
		 * Override push
		 */
		push() {
		  return Array.prototype.push.apply(this, utils.argsToArray(arguments).map((item) => {
		    return this.cast(item);
		  }));
		}

		/**
		 * Send exceptions
		 */
		send(res, status) {
		  res.status(status || this[0].status || 500);
		  return res.send({
		    exceptions: this.export()
		  });
		}
	}
};