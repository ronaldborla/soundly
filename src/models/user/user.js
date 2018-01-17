'use strict';

const _ 			= require('lodash'),
			bcrypt 	= require('bcrypt'),
			q 			= require('q');

/**
 * User model
 */
module.exports = function(Schema) {
	const Exceptions  			= this.api.soundly.Exceptions,
				model 						= this,
				mongoose 					= this.api.mongoose,
				utils 						= this.api.utils;
	this.name 							= 'User';
	this.options.attributes = {
		excluded: ['password']
	};
	this.options.password 	= {
		salt_rounds: 10
	};
	this.options.roles  		= {
		member: 		1,
		admin:  		2,
		moderator: 	4
	};

	/** 
	 * User schema
	 */
	const User = new Schema({
	  authentications: [{
	    ref:  'Authentication',
	    type: Schema.Types.ObjectId
	  }],
	  password: 	String,
	  roles: {
	  	default: 	this.options.roles.member,
	  	type: 		Number
	  },
	  status: {
	    default: 'pending',
	    enum: [
	      'pending',
	      'active',
	      'inactive',
	      'suspended',
	      'deleted'
	    ],
	    type: String
	  }
	});

	/**
	 * Pre methods
	 */
	User.pre('save', beforeSave);

	/**
	 * Methods
	 */
	User.methods.hasRole 				= hasRole;
	User.methods.verifyPassword = verifyPassword;

	/**
	 * Static methods
	 */
	User.statics.authenticate = authenticate;

	/**
	 * Virtual properties
	 */
	User.virtual('types').get(getTypes);

	return User;

	/**
	 * Authenticate user
	 * This is used for logging in
	 */
	function authenticate(user, password) {
	  var Authentication  = mongoose.model('Authentication'),
	      mobile          = utils.isMobile(user);
	  return q.Promise((resolve, reject) => {
		  user = (mobile || user || '').toLowerCase();
		  if (!user) {
		    return reject(new Exceptions(['MISSING_USER_AUTHENTICATION']));
		  }
		  if (!password) {
		    return reject(new Exceptions(['MISSING_PASSWORD']));
		  }
		  Authentication.identify(user).then((authentication) => {
		    authentication.user.verifyPassword(password).then(() => {
		      resolve(authentication);
		    }).catch((exceptions) => {
		      reject(exceptions);
		    });
		  });
	  });
	}

	/**
	 * Before saving
	 */
	function beforeSave(next) {
	  this.updated = Date.now();
	  if (!this.isModified('password')) {
	    return next();
	  }
	  bcrypt.hash(this.password, model.options.password.salt_rounds, (err, hash) => {
	    if (err) {
	      return next(err);
	    }
	    this.password = hash;
	    next();
	  });
	}

	/**
	 * Get role types
	 */
	function getTypes() {
	  var types = [];
	  _.forEach(model.options.roles, (value, type) => {
	    if (this.hasRole(type)) {
	      types.push(type);
	    }
	  });
	  return types;
	}

	/**
	 * Has role
	 */
	function hasRole(role) {
	  return this.roles & model.options.roles[role];
	}

	/**
	 * Verify password
	 */
	function verifyPassword(password) {
	  return q.Promise((resolve, reject) => {
		  bcrypt.compare(password, this.password, (err, valid) => {
		    if (err || !valid) {
		      reject(new Exceptions(['INVALID_PASSWORD']));
		    } else {
		      resolve(this);
		    }
		  });
	  });
	}
};