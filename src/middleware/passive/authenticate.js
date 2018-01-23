'use strict';

module.exports = middleware;

/**
 * Authenticate
 */
function middleware(req, res, next) {
	require('./authorize').apply(this, [req, res, (exceptions) => {
		if (exceptions) {
			exceptions.send(res);
		} else {
			next();
		}
	}]);
};