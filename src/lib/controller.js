'use strict';

const _ 				= require('lodash'),
			q 				= require('q'),
			Base 			= require('./base'),
			Navigator = require('./navigator'),
			utils 		= require('./utils');

module.exports = function() {
	const api = this;

	/**
	 * Controller
	 */
	return class Controller extends Base {
		
		/**
		 * The constructor
		 */
		constructor(name) {
			super(...arguments);
		  this.attributes = {};
		  this.context    = {};
		  this.exceptions = {};
		  this.name 			= name || '';
		}

		/**
		 * The api
		 */
		get api() {
			return api;
		}

		/**
		 * The exceptions
		 */
		get Exceptions() {
			return this.api.Exceptions;
		}

		/**
		 * Get mongoose
		 */
		get mongoose() {
			return this.api.mongoose;
		}

		/**
		 * After an action
		 */
		after(req, action, single) {
		  var method = 'after' + _.upperFirst(action);
		  if (_.isFunction(this[method])) {
		    return this[method](req, single);
		  }
		  return q.when(single);
		}

		/**
		 * Perform before an action
		 */
		before(req, action, single, data) {
		  var method = 'before' + _.upperFirst(action);
		  if (_.isFunction(this[method])) {
		    data = this[method](req, single, data);
		  }
		  return q.when(data);
		}

		/**
		 * Delete resource
		 */
		delete(req, path, parent) {
		  return this.request('delete', req, path, parent);
		}

		/**
		 * Delete single
		 */
		deleteSingle(req, path, single) {
		  var action  = 'delete',
		      parent  = (single.$ || {}).parent;
		  if (path) {
		    return this.delete(req, path, single);
		  } else {
		    var promises = [];
		    if (parent) {
		      promises.push(this.getMultipleIds(parent).then((ids) => {
		        var index = ids.indexOf(utils.objectIdToString(single.id));
		        if (index >= 0) {
		          ids.splice(index, 1);
		        }
		        return this.putMultipleIds(parent, ids).then(() => {
		          return this.updatePrimary(parent);
		        });
		      }));
		    }
		    return q.all(promises).then(() => {
		      return this.before(req, action, single);
		    }).then(() => {
		      return this.performDelete(single);
		    });
		  }
		}

		/**
		 * Get resource
		 */
		get(req, path, parent) {
		  return this.request('get', req, path, parent);
		}

		/**
		 * Get data for create or update
		 */
		getData(req, method, parent, data) {
		  return data || req.body || {};
		}

		/**
		 * Get fields
		 */
		getFields(req, action, target) {
		  return [];
		}

		/**
		 * Get filters
		 */
		getFilters(req, target) {
		  return {};
		}

		/**
		 * Get multiple documents
		 */
		getMultiple(req, parent) {
		  var order = null;
		  return q.when(this.getFilters(req, 'multiple')).then((filters) => {
		    var promises = [];
		    if (parent && !_.isString(parent)) {
		      promises.push(this.getMultipleIds(parent, true).then((ids) => {
		        order = ids.map((id) => {
		          return new this.mongoose.Types.ObjectId(id);
		        });
		        filters._id = {
		          $in: order
		        };
		        return order;
		      }));
		    }
		    return q.all(promises).then(() => {
		      return this.navigate(req, filters, 
		        this.getFields(req, 'select',   'multiple'), 
		        this.getFields(req, 'populate', 'multiple'), 
		        this.getFields(req, 'sort'),
		        order);
		    });
		  });
		}

		/**
		 * Get multiple ids
		 */
		getMultipleIds(parent, retain_id) {
		  return q.Promise((resolve) => {
		    parent.constructor
		      .findById(parent.id, this.attributes.multiple)
		      .exec((err, single) => {
		        var ids = (single || {})[this.attributes.multiple] || [];
		        resolve(retain_id ? ids : utils.objectIdsToStrings(ids));
		      });
		  });
		}

		/**
		 * Get single
		 */
		getSingle(req, method, path, filters, parent) {
		  var is_get = (method === 'get');
		  if (_.isUndefined(filters)) {
		    filters = this.getFilters(req, 'single');
		  }
		  return q.when(filters).then((filters) => {
		    var target    = (is_get && !path) ? 'all' : 'reference',
		        select    = this.getFields(req, 'select',   target),
		        populate  = this.getFields(req, 'populate', target);
		    return q.Promise((resolve, reject) => {
		      this.model
		        .findOne(filters, select || null)
		        .populate(populate || [])
		        .exec((error, single) => {
		          if (!error && single) {
		            if (method && 
		                _.isFunction(single.hasPermission) && 
		                !(!req.session || single.hasPermission(req.session.authentication.user, method))) {
		              reject(new this.api.Exceptions([this.exceptions.PERMISSION_DENIED]));
		            } else {
		              resolve(single);
		            }
		          } else {
		            reject(new this.api.Exceptions([this.exceptions.NOT_FOUND]));
		          }
		        });
		    });
		  }).then((single) => {
		    single.$ = {
		      parent: parent
		    };
		    if (!is_get) {
		      return this[method + 'Single'](req, path, single);
		    } else if (path) {
		      return this.get(req, path, single);
		    } else {
		      return single;
		    }
		  });
		}

		/**
		 * Handle context
		 */
		handleContext(req, method, context, path, parent) {
		  var promises = [];
		  if (parent && !_.isString(parent)) {
		    promises.push(this.getMultipleIds(parent).then((ids) => {
		      var param = (context.charAt(0) === ':') ? context.substr(1) : context;
		      if (ids.indexOf(req.context[param]) >= 0) {
		        return q.resolve(req.context[param]);
		      } else {
		        return q.reject(new this.api.Exceptions([this.exceptions.NOT_FOUND]));
		      }
		    }));
		  }
		  return q.all(promises).then(() => {
		    return this.getSingle(req, method, path, utils.undefined, parent);
		  });
		}

		/**
		 * Handle primary
		 */
		handlePrimary(req, method, context, path, parent) {
		  var is_get = (method === 'get');
		  return this.getMultipleIds(parent).then((ids) => {
		    var filters = {
		      _id: {
		        $in: ids
		      },
		      primary: true
		    };
		    return this.getSingle(req, method, path, filters, parent);
		  });
		}

		/**
		 * Initialize
		 */
		init() {
		  if (this.model) {
		    this.model = this.mongoose.model(this.model);
		  }
		  return this;
		}

		/**
		 * Navigate resources
		 */
		navigate(req, filters, fields, populate, sort, order) {
		  return (new Navigator(this.model, req))
		    .fields   (fields   || null)
		    .order    (order    || null)
		    .populate (populate || [])
		    .sort     (sort     || [])
		    .exec     (filters  || {});
		}

		/**
		 * Get next path
		 */
		nextPath(path) {
		  var pos = (path || '').indexOf('/');
		  if (pos >= 0) {
		    return path.substr(0, pos);
		  } else {
		    return (path || '');
		  }
		}

		/**
		 * Perform create
		 */
		performCreate(data) {
		  return q.Promise((resolve, reject) => {
		    (new this.model(data))
		      .save((err, created) => {
		        if (err) {
		          reject(new this.api.Exceptions([this.exceptions.FAILED_TO_CREATE]));
		        } else {
		          resolve(created);
		        }
		      });
		  });
		}

		/**
		 * Perform delete
		 */
		performDelete(single) {
		  return q.Promise((resolve, reject) => {
		    this.model
		      .findByIdAndRemove(single.id)
		      .exec((err) => {
		        if (err) {
		          reject(new this.api.Exceptions([this.exceptions.FAILED_TO_DELETE]));
		        } else {
		          resolve({ success: true });
		        }
		      });
		  });
		}

		/**
		 * Perform update
		 */
		performUpdate(single, data) {
		  return q.Promise((resolve, reject) => {
		    this.model
		      .findByIdAndUpdate(single.id, data)
		      .exec((err, updated) => {
		        if (err || !updated) {
		          reject(new this.api.Exceptions([this.exceptions.FAILED_TO_UPDATE]));
		        } else {
		          resolve(updated);
		        }
		      });
		  });
		}

		/**
		 * Post resource
		 */
		post(req, path, parent) {
		  return this.request('post', req, path, parent);
		}

		/**
		 * Post multiple
		 */
		postMultiple(req, parent) {
		  var action = 'create';
		  return q.when(this.getFields(req, action)).then((fields) => {
		    return q.when(this.getData(req, 'post', _.pick(req.body || {}, fields)));
		  }).then((body) => {
		    return this.validate(body).then((data) => {
		      return this.before(req, action, parent, data);
		    }).then((data) => {
		      return this.performCreate(data);
		    });
		  }).then((created) => {
		    created.$ = {
		      parent: parent
		    };
		    var promises = [];
		    if (parent) {
		      promises.push(this.getMultipleIds(parent).then((ids) => {
		        ids.push(utils.objectIdToString(created.id));
		        return this.putMultipleIds(parent, ids);
		      }));
		    }
		    return q.all(promises).then(() => {
		      return this.updatePrimary(parent, created).then(() => {
		        return this.after(req, action, created);
		      }).then(() => {
		        return this.reload(req, created);
		      });
		    });
		  });
		}

		/**
		 * Post single
		 */
		postSingle(req, path, single) {
		  if (path) {
		    return this.post(req, path, single);
		  } else {
		    return q.reject(new this.api.Exceptions(['METHOD_NOT_ALLOWED']));
		  }
		}

		/**
		 * Put resource
		 */
		put(req, path, parent) {
		  return this.request('put', req, path, parent);
		}

		/**
		 * Update multiple ids
		 */
		putMultipleIds(parent, ids) {
		  var data = {};
		  data[this.attributes.multiple] = ids;
		  return q.Promise((resolve) => {
		    parent.constructor
		      .findByIdAndUpdate(parent.id, data)
		      .exec(() => {
		        resolve(parent);
		      });
		  });
		}

		/**
		 * Put single
		 */
		putSingle(req, path, single) {
		  var action 	= 'update',
		      parent 	= (single.$ || {}).parent;
		  if (path) {
		    return this.put(req, path, single);
		  } else {
		    return q.when(this.getFields(req, action)).then((fields) => {
		      return q.when(this.getData(req, 'put', _.pick(req.body || {}, fields)));
		    }).then((body) => {
		      return this.validate(body).then((data) => {
		        return this.before(req, action, single, data);
		      }).then((data) => {
		        return this.performUpdate(single, data);
		      });
		    }).then((updated) => {
		      return this.updatePrimary(parent, single).then(() => {
		        return this.reload(req, updated);
		      });
		    });
		  }
		}

		/**
		 * Reload single
		 */
		reload(req, single) {
		  return q.Promise((resolve) => {
		    this.model
		      .findById(single.id)
		      .exec((err, found) => {
		        found.save((err, saved) => {
		          resolve(saved);
		        });
		      });
		  }).then(() => {
		    return this.getSingle(req, 'get', '', { _id: single.id });
		  });
		}

		/**
		 * Get remaining path
		 */
		remPath(path) {
		  var pos = (path || '').indexOf('/');
		  if (pos >= 0) {
		    return path.substr(pos + 1) || '';
		  } else {
		    return '';
		  }
		}

		/**
		 * Request resource
		 */
		request(method, req, path, parent) {
		  var next = this.nextPath(path);
		  if (next) {
		    var rem     = this.remPath(path),
		        action  = this.context[next];
		    if (_.isUndefined(action)) {
		      return this[_.camelCase([method, next].join(' '))](req, rem, parent);
		    } else if (_.isFunction(action)) {
		      return action.apply(this, [req, method, next, rem, parent]);
		    } else if (_.isString(action)) {
		      var controller = this.api.controller(action);
		      if (!controller) {
		      	this.api.error('Controller `' + action + '` is undefined');
		      }
		      return controller[method](req, rem, parent || next);
		    } else {
		      return q.when(utils.undefined);
		    }
		  } else {
		    return this[method + 'Multiple'](req, parent);
		  }
		}

		/**
		 * Update primary
		 */
		updatePrimary(parent, single) {
		  // Make sure the 'primary' attribute is defined
		  if (!parent || _.isUndefined(this.model.schema.paths.primary)) {
		    return q.resolve(parent);
		  }
		  var single_id   = _.isUndefined(single) ? null : utils.objectIdToString(single.id),
		      primary_id  = null;
		  return this.getMultipleIds(parent).then((ids) => {
		    var filters = {
		      _id: {
		        $in: ids
		      }
		    };
		    return q.Promise((resolve, reject) => {
		      this.model
		        .find(filters, ['_id', 'primary'])
		        .exec((err, multiple) => {
		          if (!err && multiple && multiple.length) {
		            resolve(utils.sortById(utils.objectIdsToStrings(multiple), ids));
		          } else {
		            resolve([]);
		          }
		        });
		    });
		  }).then((multiple) => {
		    var current   = -1,
		        index     = -1,
		        length    = multiple.length,
		        promises  = [],
		        remove    = -1;
		    for (var i = 0; i < length; i++) {
		      if (current < 0 && !!multiple[i].primary) {
		        current = i;
		      }
		      if (multiple[i].id === single_id) {
		        index = i;
		      }
		    }
		    if ((index >= 0) && !!multiple[index].primary) {
		      remove = index;
		    } else if ((current < 0) && (length > 0)) {
		      // First in the list is the default primary
		      promises.push(q.Promise((resolve) => {
		        this.model
		          .findByIdAndUpdate(multiple[0].id, {
		            primary: true
		          })
		          .exec((err, doc) => {
		            resolve(doc || null);
		          });
		      }));
		      remove = 0;
		    } else {
		      remove = current;
		    }
		    if (remove >= 0) {
		      primary_id = multiple[remove].id;
		      multiple.splice(remove, 1);
		    }
		    return q.all(promises).then(() => {
		      return q.Promise((resolve) => {
		        this.model
		          .update({
		            _id: {
		              $in: multiple.map((doc) => {
		                return doc.id;
		              })
		            }
		          }, {
		            primary: false
		          }, {
		            multi: true
		          })
		          .exec(() => {
		            resolve(parent);
		          });
		      });
		    });
		  }).then(() => {
		    // Update primary field of parent
		    var primary_field = 'primary_' + this.attributes.single;
		    if (primary_id && !_.isUndefined(parent.constructor.schema.paths[primary_field])) {
		      var data = {};
		      data[primary_field] = primary_id;
		      return q.Promise((resolve) => {
		        parent.constructor
		          .findByIdAndUpdate(parent.id, data)
		          .exec(() => {
		            resolve(parent);
		          });
		      });
		    } else {
		      return q.resolve(parent);
		    }
		  });
		}

		/**
		 * Validate data
		 */
		validate(data) {
		  return this.model.validate(data).then((exceptions) => {
		    return exceptions.length ? q.reject(exceptions) : data;
		  });
		}
	}
};