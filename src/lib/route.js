'use strict';

const _     = require('lodash'),
      Media = require('./media');

/**
 * Route class
 */
module.exports = class Route {

  /**
   * Route constructor
   */
  constructor(api, base) {
    this.api        = api;
    this.base       = base || '';
    this.controller = null;
    this.name       = this.base || '';
  }

  /**
   * Get root
   */
  get root() {
    return this.api.config.root + this.base + '/';
  }

  /**
   * Get server
   */
  get server() {
    return this.soundly.server;
  }

  /**
   * Get soundly
   */
  get soundly() {
    return this.api.soundly;
  }

  /**
   * Delete
   */
  delete(path, middleware) {
    return this.request('delete', path, middleware);
  }

  /**
   * Get route
   */
  get(path, middleware) {
    return this.request('get', path, middleware);
  }

  /**
   * Handle request
   */
  handle(method, path, req, res) {
    return this.controller[method](req, path).then((data) => {
      // Media must be streamed
      if (data instanceof Media) {
        data.stream(res);
      } else {
        res.send(data);
      }
    }).catch((exceptions) => {
      exceptions.send(res);
    });
  }

  /**
   * Initialize
   */
  init() {
    this.controller = require('../controllers/' + this.controller);
    return this;
  }

  /**
   * Post route
   */
  post(path, middleware) {
    return this.request('post', path, middleware);
  }

  /**
   * Put route
   */
  put(path, middleware) {
    return this.request('put', path, middleware);
  }

  /**
   * Request route
   */
  request(method, path, middleware) {
    var args = [this.root + path];
    if (!_.isUndefined(middleware)) {
      if (!_.isArray(middleware)) {
        middleware = [middleware];
      }
      middleware.forEach((passive) => {
        if (_.isString(passive)) {
          args.push(require('../middleware/passive/' + passive));
        }
      });
    }
    args.push((req, res, next) => {
      return this.handle(method, path, req, res, next);
    });
    return this.server[(method === 'delete') ? 'del' : method].apply(this.server, args);
  }
}