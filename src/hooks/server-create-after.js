'use strict';

const restify = require('restify');

/**
 * Hook after createServer
 */
module.exports = function() {
	this.server.pre(restify.pre.sanitizePath());
	this.server.use(restify.plugins.gzipResponse());
	this.server.use(restify.plugins.queryParser());
	this.server.use(restify.plugins.bodyParser());
};