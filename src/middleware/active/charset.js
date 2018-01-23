'use strict';

module.exports = middleware;

/**
 * Charset middleware
 */
function middleware(req, res, next) {
  res.charSet(this.api.config.charset || 'utf-8');
  next();
};