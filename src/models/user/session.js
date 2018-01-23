'use strict';

const fs 		= require('fs-extra'),
    	jwt 	= require('jsonwebtoken'),
    	path  = require('path'),
    	q   	= require('q');

/**
 * Session model
 */
module.exports = function(Schema) {
	const Exceptions  = this.api.Exceptions;
	const keys 				= {
		private: 	null,
		public: 	null
	};
	this.name 					= 'Session';
	this.options.keys 	= {
		private: 	this.api.path('/session/private', 'keys'),
		public: 	this.api.path('/session/public', 	'keys')
	};
	this.options.paths  = {
		status: {
			default: 'active',
			enum: [
	      'active',
	      'inactive',
	      'expired'
			]
		}
	}

	/**
	 * Add hooks
	 */
	this.hooks['init-before'] = beforeInit;

	/** 
	 * Session schema
	 */
	const Session = new Schema({
	  authentication: {
	    ref:  'Authentication',
	    type: Schema.Types.ObjectId
	  },
	  extra: {
	    default:  {},
	    type:     Object
	  },
	  ip_addresses: {
	    default:  [],
	    type:     [String]
	  },
	  remember: Boolean,
	  status: {
	    default: 	this.options.paths.status.default,
	    enum: 		this.options.paths.status.enum,
	    type: 		String
	  },
	  token:    String
	});

	/**
	 * Methods
	 */
	Session.methods.createPayload = createPayload;
	Session.methods.deactivate    = deactivate;
	Session.methods.refresh       = refresh;

	/**
	 * Static methods
	 */
	Session.statics.authorize = authorize;
	Session.statics.expire    = expire;
	Session.statics.generate  = generate;

	/**
	 * Virtual properties
	 */
	Session.virtual('expiration').get(getExpiration);

	return Session;

	/**
	 * Authorize a given token
	 */
	function authorize(token) {
	  return q.Promise((resolve, reject) => {
		  jwt.verify(token, keys.public, {
		    algorithms: ['RS512']
		  }, (err, payload) => {
		    if (err) {
		      switch (err.name) {
		        case 'TokenExpiredError':
		          this.expire(token).finally(() => {
		            deferred.reject(new Exceptions(['TOKEN_IS_EXPIRED']));
		          });
		          break;
		        case 'JsonWebTokenError':
		          deferred.reject(new Exceptions(['INVALID_TOKEN']));
		          break;
		        default:
		          break;
		      }
		    } else if (!payload || !payload.id) {
		      reject(new Exceptions(['INVALID_TOKEN_PAYLOAD']));
		    } else {
		      this
		        .findById((payload || {}).id || null)
		        .populate([{
		          path: 'authentication',
		          populate: [{
		            path: 'user',
		            populate: [{
		              path: 'authentications'
		            }]
		          }]
		        }])
		        .exec((err, session) => {
		          if (err || !session) {
		            reject(new Exceptions(['INVALID_SESSION']));
		          } else {
		            switch (session.status) {
		              case 'inactive':
		                reject(new Exceptions(['SESSION_IS_INACTIVE']));
		                break;
		              case 'expired':
		                reject(new Exceptions(['SESSION_IS_EXPIRED']));
		                break;
		              default:
		                resolve(session);
		                break;
		            }
		          }
		        });
		    }
		  });
	  });
	}

	/**
	 * Before initialization
	 */
	function beforeInit() {
		if (!fs.existsSync(this.options.keys.private) || !fs.existsSync(this.options.keys.public)) {
			var dir 		= path.dirname(this.options.keys.private);
			var script 	= [
				'ssh-keygen -t rsa -f "' + this.options.keys.private + '" -q -N ""', 
				'openssl rsa -in "' + this.options.keys.private + '" -pubout -outform PEM -out "' + this.options.keys.public + '"',
				'rm "' + this.options.keys.private + '.pub"'
			];
			fs.ensureDirSync(dir);
			this.api.error('Could not find session keys. ' +
				'Please run the following command on your project\'s root directory to generate keys:\n\n' + 
				script.join(' && '));
		}
		keys.private 	= fs.readFileSync(this.options.keys.private);
		keys.public 	= fs.readFileSync(this.options.keys.public);
	}

	/**
	 * Create token payload
	 */
	function createPayload() {
	  return {
	    id: this.id
	  };
	}


	/**
	 * Deactivate the session
	 */
	function deactivate() {
	  this.status = 'inactive';
	  return q.Promise((resolve, reject) => {
		  this.save((err, session) => {
		    if (err) {
		      reject(new Exceptions(['FAILED_TO_DEACTIVATE_SESSION']));
		    } else {
		      resolve(session);
		    }
		  });
	  });
	}

	/**
	 * Force expire a session
	 */
	function expire(token) {
	  return q.Promise((resolve, reject) => {
		  this.findOne({ token: token }).exec((err, session) => {
		    if (err || !session) {
		      reject(new Exceptions(['SESSION_NOT_FOUND']));
		    } else {
		      session.status = 'expired';
		      session.save((err, session) => {
		        if (err) {
		          reject(new Exceptions(['SESSION_NOT_SAVED']));
		        } else {
		          resolve(session);
		        }
		      });
		    }
		  });
	  });
	}
	/**
	 * Generate new session
	 */
	function generate(req, authentication, remember, extra) {
		return q.Promise((resolve, reject) => {
		  (new this({
		    remember:       !!remember,
		    extra:          extra || {},
		    authentication: authentication
		  })).save((err, session) => {
		    if (err || !session) {
		      reject(new Exceptions(['FAILED_TO_GENERATE_SESSION']));
		    } else {
		      jwt.sign(session.createPayload(), keys.private, {
		        algorithm: 'RS512',
		        expiresIn: session.expiration
		      }, (err, token) => {
		        if (err || !token) {
		          reject(new Exceptions(['FAILED_TO_GENERATE_TOKEN']));
		        } else {
		          session.token = token;
		          session.refresh(req).save((err, session) => {
		            if (err || !session) {
		              reject(new Exceptions(['FAILED_TO_SAVE_TOKEN']));
		            } else {
		              resolve(session);
		            }
		          });
		        }
		      });
		    }
		  });
		});
	}

	/**
	 * Get expiration
	 */
	function getExpiration() {
	  return !this.remember ?
	         (60 * 30) :          // 30 minutes
	         (60 * 60 * 24 * 30); // 30 days
	}

	/**
	 * Refresh session
	 */
	function refresh(req) {
	  var ip_address = req.headers['x-forwarded-for'] || 
	                   req.connection.remoteAddress   || 
	                   req.socket.remoteAddress       ||
	                   req.connection.socket.remoteAddress;
	  if (this.ip_addresses.indexOf(ip_address) < 0) {
	    this.ip_addresses.push(ip_address);
	  }
	  return this;
	}
};