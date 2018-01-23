'use strict';

module.exports = middleware;

/**
 * Authorize a session
 */
function middleware(req, res, next) {
  const authorization = req.header('authorization') || '',
        Exceptions    = this.api.Exceptions,
        Session       = this.api.mongoose.model('Session');
  if (authorization) {
    if (!Session) {
      this.error('Built-in `authorize` middleware requires using of built-in or extended `Session` model');
    }
    Session.authorize(authorization).then((session) => {
      session.refresh(req).save(() => {
        req.session = session;
        next();
      });
    }).catch((exceptions) => {
      exceptions.send(res);
    });
  } else {
    next(new Exceptions(['AUTHORIZATION_REQUIRED']));
  }
};