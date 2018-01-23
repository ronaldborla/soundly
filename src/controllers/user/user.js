'use strict';

const _ = require('lodash'),
      q = require('q');

module.exports = function(Controller) {
  const Authentication = this.mongoose.model('Authentication');

  /**
   * User controller
   */
  return class User extends Controller {

    /**
     * The constructor
     */
    constructor() {
      super(...arguments);
      this.attributes = {
        multiple: 'users',
        single:   'user'
      };
      this.context    = {
        ':username': this.handleContext
      };
      this.exceptions = {
        NOT_FOUND:          'USER_NOT_FOUND',
        PERMISSION_DENIED:  'PERMISSION_DENIED'
      };
      this.model      = 'User';
    }

    /**
     * Get fields
     */
    getFields(req, action, target) {
      switch (action) {
        case 'populate':
          switch (target) {
            case 'all':
            case 'multiple':
              return  [
                'authentications',
                'primary_address',
                'primary_contact',
                'primary_photo'
              ];
          }
          break;
        case 'select':
          switch (target) {
            case 'all':
            case 'multiple':
              return [
                '_id',
                'authentications',
                'birth_date',
                'created',
                'first_name',
                'last_name',
                'middle_name',
                'roles',
                'primary_address',
                'primary_contact',
                'primary_photo',
                'sex',
                'status',
                'updated'
              ];
            default:
              return [
                '_id'
              ];
          }
          break;
        case 'sort':
          return [
            'birth_date', 
            'first_name',
            'last_name',
            'middle_name',
            'roles',
            'sex', 
            'created', 
            'updated'
          ];
      }
      return [];
    }

    /**
     * Filters
     */
    getFilters(req, target) {
      var filters   = {},
          promises  = [];
      switch (target) {
        case 'single':
          promises.push(Authentication.identify(req.context.username, 'username').then((authentication) => {
            filters._id = (authentication.user || {}).id || authentication.user || null;
            return authentication;
          }));
          break;
      }
      return q.all(promises).then(() => {
        return filters;
      });
    }

    /**
     * Get me
     */
    getMe(req) {
      return q.when(_.extend(req.session.authentication.user.toJSON(), {
        authentication: req.session.authentication.toJSON()
      }));
    }

    /**
     * Put me
     */
    putMe(req) {

    }
  }
}