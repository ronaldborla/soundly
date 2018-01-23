'use strict';

var codes = {};

codes.BAD_REQUEST         = [401, 'Bad request'];
codes.METHOD_NOT_ALLOWED  = [405, 'Method not allowed'];
codes.PERMISSION_DENIED   = [403, 'Permission denied'];
codes.RESOURCE_NOT_FOUND  = [404, 'Resource not found'];
codes.UNKNOWN_EXCEPTION   = [500, 'Unknown exception'];

module.exports = codes;