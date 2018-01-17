'use strict';

const _         = require('lodash'),
    	fs        = require('fs-extra'),
    	glob 			= require('glob'),
    	latinize  = require('latinize'),
    	mongoose  = require('mongoose'),
    	path      = require('path'),
    	q 				= require('q');

/**
 * Utilities
 */
class Utils {
	/**
	 * Utils constructor
	 */
	constructor() {
		this.undefined = ((undefined) => {
			return undefined;
		})();
	}

	/**
	 * Convert arguments to array
	 */
	argsToArray(args, padding) {
	  var arr = Array.prototype.slice.call(args);
	  if (!_.isUndefined(padding) && arr.length < padding) {
	    var l = padding - arr.length,
	        i = l;
	    while (i--) {
	      arr.push(utils.undefined);
	    }
	  }
	  return arr;
	}

	/**
	 * Check if two arrays are equal
	 */
	arrayEquals(a, b, compare) {
	  var length = a.length;
	  if (length !== b.length) {
	    return false;
	  }
	  var has_compare = _.isFunction(compare);
	  for (var i = 0; i < length; i++) {
	    if (has_compare ? !compare(a[i], b[i]) : (a[i] !== b[i])) {
	      return false;
	    }
	  }
	  return true;
	}

	/**
	 * Get root module
	 */
	getRootModule(mod) {
		while (mod.parent) {
			mod = mod.parent;
		}
		return mod;
	}

	/**
	 * Perform hook
	 */
	hook(instance, callbacks, action, args) {
		args = args || [];
		return this.queue(callbacks.filter((callback) => {
			return fs.existsSync(callback);
		}).map((callback) => {
			return () => {
				return q.Promise((resolve, reject) => {
					var rejected = false;
					var timeout = setTimeout(() => {
						rejected = true;
						reject('Hook timeout: ' + callback);
					}, (instance.config.hooks || {}).timeout || 30000);
					q.when(require(callback).apply(instance, args || []))
						.then(done(resolve))
						.catch(done(reject))
						.finally(() => {
							clearTimeout(timeout);
						});
					function done(method) {
						return (value) => {
							return method(value);
						};
					}
				});
			};
		}));
	}

	/**
	 * Inherit an object's prototype
	 */
	inherit(parent, constructor) {
	  constructor.prototype             = Object.create(parent.prototype);
	  constructor.prototype.constructor = constructor;
	  _.extend(constructor, parent);
	  return constructor;
	}

	/**
	 * Check if string is mobile
	 */
	isMobile(string) {
	  // Remove white, dash, plus, parentheses and dots
	  string = (string || '').replace(/\s\(\)\-\.\+/g, '');
	  var length = string.length;
	  // Base on length
	  switch (length) {
	    case 12:
	      // 639087800765 Must start with 63
	      if (string.substr(0, 3) !== '639') {
	        return false;
	      }
	      break;
	    case 11:
	      // 09087800765 Must start with 0
	      if (string.substr(0, 2) !== '09') {
	        return false;
	      }
	      break;
	    case 10:
	      if (string.substr(0, 1) !== '9') {
	        return false;
	      }
	      break;
	    default:
	      return false;
	  }
	  return string.substr(length - 10, 10);
	}

	/**
	 * Check if single character is a number
	 */
	isNumber(char) {
	  var code = char.charCodeAt(0);
	  return (code >= 48) && (code <= 57);
	}

	/**
	 * Check if numeric
	 */
	isNumeric(string) {
	  var length = (string || '').length;
	  for (var i = 0; i < length; i++) {
	    if (!utils.isNumber(string.charAt(i))) {
	      return false;
	    }
	  }
	  return true;
	}

	/**
	 * Convert id to string
	 */
	objectIdToString(object_id) {
	  if (mongoose.Types.ObjectId.isValid(object_id)) {
	    return (new mongoose.Types.ObjectId(object_id)).toString();
	  } else {
	    return null;
	  }
	}

	/**
	 * Convert array of ids to array of strings
	 */
	objectIdsToStrings(objects) {
	  var converted = [];
	  (objects || []).forEach((object) => {
	    if (mongoose.Types.ObjectId.isValid(object)) {
	      object = utils.objectIdToString(object);
	      converted.push(object);
	    } else if (!_.isUndefined(object.id)) {
	      object.id = utils.objectIdToString(object.id);
	      converted.push(object);
	    }
	  });
	  return converted;
	}

	/**
	 * Queue callbacks that return a promise
	 */
	queue(callbacks, index, value) {
	  index = index || 0;
	  if (_.isUndefined(callbacks[index])) {
	    return q.resolve(value);
	  }
	  return q.when(callbacks[index]()).then((value) => {
	    return this.queue(callbacks, index + 1, value);
	  });
	}

	/**
	 * Require
	 */
	require(patterns, callback, filter) {
		var hasCallback = _.isFunction(callback),
				hasFilter 	= _.isFunction(filter);
		(patterns || []).forEach((pattern) => {
			(glob.sync(pattern) || []).forEach((filename) => {
				var value = require(filename);
				if (hasCallback && (!hasFilter || (filter(value) === true))) {
					callback(value, filename);
				}
			})
		});
		return this;
	}

	/**
	 * Generate safe filename
	 */
	safeFilename(filename) {
	  var count = 0,
	      dir   = path.dirname(filename),
	      ext   = path.extname(filename) || '',
	      base  = path.basename(filename, ext),
	      safe  = '';
	  do {
	    count++;
	    safe = base + ((count > 1) ? ('-' + count) : '') + ext;
	    filename = dir + '/' + safe;
	  } while (fs.existsSync(filename));
	  return filename;
	}

	/**
	 * Sort documents by id
	 */
	sortById(documents, order) {
	  var sorted = [],
	      length = documents.length;
	  (order || []).forEach((id) => {
	    for (var i = 0; i < length; i++) {
	      if (id === utils.objectIdToString(documents[i].id)) {
	        sorted.push(documents[i]);
	        break;
	      }
	    }
	  });
	  return sorted;
	}

	/**
	 * Convert to permalink
	 */
	toPermalink(string) {
	  // Convert accented characters to latin then trim both ends dashes
	  return _.trim(latinize(string).replace(/["'`]/g, '')         // Remove all quotes
	                                .replace(/[^A-Za-z0-9]/g, '-') // Replace all non-alphanumeric to dash
	                                .replace(/--+/g, '-')          // Replace all multiple dash to single dash
	                                .toLowerCase(), '-');          // All permalinks must be lowercased
	}

	/**
	 * Validate phone number
	 */
	validatePhoneNumber(number) {
	  return /^[0-9 \.\(\)\-\+]*$/.test(number);
	}

	/**
	 * Validate email
	 */
	validateEmail(email) {
	  return /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email);
	}

	/**
	 * Validate url
	 */
	validateUrl(url) {
	  return /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:[/?#]\S*)?$/i.test(url);
	}
}

module.exports = new Utils();