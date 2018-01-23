'use strict';

/**
 * Authentication routes
 */
module.exports = function() {
  this.controller = 'user/authentication';
  // Routes
  this.delete('', 'authenticate');
  this.post  ('');
  this.delete('sessions');
  this.get   ('sessions');
};