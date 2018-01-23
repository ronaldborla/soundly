'use strict';

const _ 		= require('lodash'),
			q 		= require('q'),
			Base 	= require('./base');

/**
 * Navigator
 */
module.exports = class Navigator extends Base {
	
	/**
	 * The constructor
	 */
	constructor(model, request) {
		super(...arguments);
	  this.$ = {
	    fields:   null,
	    order:    null,
	    populate: null,
	    sort:     []
	  };
	  this.model    = model;
	  this.orders   = ['asc', 'desc'];
	  this.request  = request;
	}

	/**
	 * Execute
	 */
	exec(filters) {
	  filters = filters || {};
	  return q.Promise((resolve, reject) => {
		  this.model
		    .find(filters, '_id')
		    .count((err, count) => {
		      if (count > 0) {
		        var query     = this.request.query || {},
		            start     = query.start || 0,
		            limit     = query.limit || 20,
		            sortField = (query.sort  || '').toLowerCase(),
		            order     = (query.order || '').toLowerCase(),
		            sort      = null;
		        if (limit < 0) {
		          limit = 1;
		        }
		        if (limit > 20) {
		          limit = 20;
		        }
		        if (start < 0) {
		          start = 0;
		        }
		        if (start >= count) {
		          start = Math.floor(count / limit) * limit;
		        }
		        if (!sortField && this.$.order) {
		          sortField = 'order';
		        }
		        if (sortField) {
		          if (this.$.order || 
		              (this.$.sort && 
		               this.$.sort.length && 
		               (this.$.sort.indexOf(sortField) >= 0))) {
		            sort = {};
		            if (this.orders.indexOf(order) < 0) {
		              order = 'asc';
		            }
		            sort[sortField] = (order === 'asc') ? 1 : -1;
		          }
		        }
		        if (this.$.order) {
		          var project = {
		            id: '$_id',
		            order: {
		              $indexOfArray: [this.$.order, '$_id']
		            }
		          };
		          this.query = this.model
		            .aggregate({
		              $match: filters
		            });
		          if (this.$.fields) {
		            var fields  = _.isArray(this.$.fields) ? this.$.fields : (this.$.fields + '').split(' ');
		            fields.forEach((field) => {
		              project[field] = true;
		            });
		            this.query.project(project);
		          } else {
		            this.query.addFields(project);
		          }
		        } else {
		          this.query = this.model.find(filters, this.$.fields);
		        }
		        if (sort) {
		          this.query.sort(sort);
		        }
		        this.query
		          .skip(start)
		          .limit(limit)
		          .exec((err, results) => {
		            resolve({
		              count:    count,
		              results:  this.$.order ? results.map((result) => {
		                return _.omit(result, ['__v', '_id', 'order']);
		              }) : results
		            });
		          });
		      } else {
		        resolve({
		          count:    0,
		          results:  []
		        });
		      }
		    });
	  }).then((result) => {
	    if (result.count <= 0 || !this.$.populate || this.$.populate.length <= 0) {
	      return result;
	    } else {
	      return q.Promise((resolve, reject) => {
		      this.model
		        .populate(result.results, this.$.populate.map((field) => {
		          return {
		            path: field
		          };
		        }), (err, results) => {
		          resolve({
		            count:    result.count,
		            results:  results
		          });
		        });
	      });
	    }
	  });
	}

	/**
	 * Set fields
	 */
	fields(fields) {
	  this.$.fields = fields || null;
	  return this;
	}

	/**
	 * Order documents
	 */
	order(order) {
	  this.$.order = order || null;
	  return this;
	}

	/**
	 * Deep populate
	 */
	populate(fields) {
	  this.$.populate = fields || [];
	  return this;
	}

	/**
	 * Send results
	 */
	send(res) {
	  this.exec().then((data) => {
	    res.send(data);
	  });
	}

	/**
	 * Sort fields
	 */
	sort(fields) {
	  this.$.sort = fields || [];
	  return this;
	}
}