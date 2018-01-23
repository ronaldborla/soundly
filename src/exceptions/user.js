'use strict';

var codes = {};

codes.AUTHORIZATION_REQUIRED        = [401, 'Authorization required'];
codes.FAILED_TO_DEACTIVATE_SESSION  = [500, 'Failed to deactivate session'];
codes.FAILED_TO_GENERATE_SESSION    = [500, 'Failed to generate session'];
codes.FAILED_TO_GENERATE_TOKEN      = [500, 'Failed to generate token'];
codes.FAILED_TO_SAVE_TOKEN          = [500, 'Failed to save token'];
codes.INVALID_PASSWORD              = [401, 'Invalid password'];
codes.INVALID_SESSION               = [401, 'Invalid session'];
codes.INVALID_TOKEN                 = [401, 'Invalid token'];
codes.INVALID_TOKEN_PAYLOAD         = [401, 'Invalid token payload'];
codes.MISSING_PASSWORD              = [400, 'Missing password'];
codes.MISSING_USER_AUTHENTICATION   = [400, 'Missing user authentication'];
codes.SESSION_IS_EXPIRED            = [401, 'Session is expired'];
codes.SESSION_IS_INACTIVE           = [401, 'Session is inactive'];
codes.SESSION_NOT_FOUND             = [401, 'Session not found'];
codes.SESSION_NOT_SAVED             = [500, 'Session not saved'];
codes.TOKEN_ERROR                   = [401, 'Token error'];
codes.TOKEN_IS_EXPIRED              = [401, 'Token is expired'];
codes.USER_NOT_FOUND                = [401, 'User not found'];

module.exports = codes;