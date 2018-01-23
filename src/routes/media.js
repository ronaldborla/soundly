'use strict';

/**
 * Media routes
 */
module.exports = function() {
  this.controller = 'media';
  // Routes
  this.post('');
  this.get ('temp/:media_date/:media_filename');
  this.get ('uploads/:media_date/:media_filename');
};