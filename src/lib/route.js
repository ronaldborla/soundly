'use strict';

const _     = require('lodash'),
      Base  = require('./base');

module.exports = function() {
  const api = this;
  /**
   * Route class
   */
  return class Route extends Base {

    /**
     * Route constructor
     */
    constructor(base) {
      super(...arguments);
      this.base       = base || '';
      this.controller = null;
      this.endpoints  = [];
      this.name       = base || '';
    }

    /**
     * The api
     */
    get api() {
      return api;
    }

    /**
     * Get root
     */
    get root() {
      return this.base + '/';
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
     * Get endpoint
     */
    endpoint(relative) {
      return '/' + this.soundly.config.root + this.api.config.root + this.root + relative;
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
        if (data instanceof this.api.Media) {
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
      // Sort priority from largest
      this.endpoints.sort((a, b) => {
        return b.priority - a.priority;
      });
      this.endpoints.forEach((endpoint) => {
        var args = [endpoint.endpoint];
        // Use active middleware
        this.api.middleware.active._index.forEach((name) => {
          args.push((req, res, next) => {
            return this.api.middleware.active[name].apply(this, [req, res, next]);
          });
        });
        // Use passive middleware
        endpoint.middleware.forEach((name) => {
          var passive = this.api.middleware.passive[name];
          if (passive) {
            args.push((req, res, next) => {
              return passive.apply(this, [req, res, next]);
            });
          }
        });
        args.push((req, res, next) => {
          return this.handle(endpoint.method, endpoint.path, req, res, next);
        });
        // Register route to restify
        this.server[(endpoint.method === 'delete') ? 'del' : endpoint.method].apply(this.server, args);
      });
      this.controller = this.api.controller(this.controller);
      if (!this.controller) {
        this.api.error('Controller for route `' + this.name + '` is undefined');
      }
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
    request(method, path, middleware, priority) {
      var endpoint = {
        endpoint: this.endpoint(path),
        method:   method,
        path:     path,
        // Default priority is 100
        priority: priority || 100
      };
      if (!_.isUndefined(middleware)) {
        if (!_.isArray(middleware)) {
          middleware = [middleware];
        }
      }
      endpoint.middleware = middleware || [];
      // Check if endpoint is already registered
      var index = this.endpoints.findIndex((item) => {
        return (item.method   === endpoint.method) &&
               (item.endpoint === endpoint.endpoint);
      });
      if (index >= 0) {
        // If endpoint already exists, overwrite it
        this.endpoints[index] = endpoint;
      } else {
        this.endpoints.push(endpoint);
      }
      return this;
    }
  }
};
