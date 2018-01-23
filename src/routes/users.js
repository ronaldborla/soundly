'use strict';

/**
 * Users routes
 */
module.exports = function() {
  this.controller = 'user/user';
  // Routes
  this.get('');
  this.get('me', 'authenticate');
  this.put('me', 'authenticate');
  this.get(':username');
};