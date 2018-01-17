'use strict';

var _ = require('lodash'),
    q = require('q');

/**
 * Authentication model
 */
module.exports = function(Schema) {
  const Exceptions  = this.api.soundly.Exceptions;
  this.name         = 'Authentication';

  /**
   * Authentication schema
   */
  const Authentication = new Schema({
    type: {
      enum: [
        'email',
        'username'
      ],
      type: String
    },
    user: {
      ref:  'User',
      type: Schema.Types.ObjectId
    },
    value: String
  });

  /**
   * Static methods
   */
  Authentication.statics.identify = identify;

  return Authentication;

  /**
   * Identify authentication
   */
  function identify(value, type) {
    var filters = {
      value: value
    };
    if (!_.isUndefined(type)) {
      filters.type = type;
    }
    return q.Promise((resolve, reject) => {
      this
        .findOne(filters)
        .populate(['user'])
        .exec((err, authentication) => {
          if (err || !authentication || !authentication.user) {
            resolve(new Exceptions(['USER_NOT_FOUND']));
          } else {
            reject(authentication);
          }
        });
    });
  }
};