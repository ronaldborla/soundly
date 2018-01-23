'use strict';

const q = require('q');

module.exports = function(Controller) {
  const Navigator = this.soundly.Navigator,
        Session   = this.mongoose.model('Session'),
        User      = this.mongoose.model('User');

  /**
   * Authentication controller
   */
  return class Authentication extends Controller {

    /**
     * The constructor
     */
    constructor() {
      super(...arguments);
    }

    /**
     * Logout
     */
    deleteMultiple(req) {
      return req.session.deactivate().then(() => {
        return {
          success: true
        };
      });
    }

    /**
     * Delete all sessions
     */
    deleteSessions(req) {
      return q.Promise((resolve, reject) => {
        Session
          .remove({})
          .exec(() => {
            resolve(null);
          });
      });
    }

    /**
     * Get all sessions
     */
    getSessions(req) {
      return (new Navigator(Session, req))
        .populate([
          'authentication'
        ])
        .exec({});
    }

    /**
     * Get authentication token
     */
    postMultiple(req) {
      return User
        .authenticate((req.body || {}).user, (req.body || {}).password)
        .then((authentication) => {
          return Session.generate(req, authentication, !!(req.body || {}).remember).then((session) => {
            return session.token;
          });
        });
    }
  }
};