'use strict';

const _           = require('lodash'),
	    fileType    = require('file-type'),
	    fs          = require('fs-extra'),
	    Layers      = require('image-layers'),
	    imagemin    = require('imagemin'),
	    Jimp        = require('jimp'),
	    moment      = require('moment'),
	    mozjpeg 		= require('imagemin-mozjpeg'),
	    multer      = require('multer'),
	    path        = require('path'),
	    pngquant 		= require('imagemin-pngquant'),
	    q           = require('q'),
	    readChunk   = require('read-chunk'),
	    Base 				= require('./base'),
	    utils 			= require('./utils'),
	    upload 			= multer();

module.exports = function() {
	const api = this;

	/**
	 * Media
	 */
	return class Media extends Base {

		/**
		 * The constructor
		 */
		constructor(filepath) {
			super(...arguments);
			this.filepath = filepath || '';
		}

		/**
		 * Get dimensions index
		 */
		static getDimensionsIndex(basename) {
		  var index     = basename.lastIndexOf('x'),
		      length    = basename.length;
		  // If index is (first or less) or (last or greater)
		  if ((index <= 0) || (index >= (length - 1))) {
		    return -1;
		  }
		  for (var w = index + 1; w < length; w++) {
		    if (!utils.isNumber(basename.charAt(w))) {
		      return -1;
		    }
		  }
		  var dimensions = index;
		  while (utils.isNumber(basename.charAt(dimensions - 1))) {
		    dimensions--;
		  }
		  return (dimensions === index) ? -1 : dimensions;
		}

		/**
		 * Read media
		 */
		static read(filepath) {
		  return (new this(filepath));
		}

		/**
		 * Upload media
		 */
		static upload(req, key) {
			key = key || 'file';
		  return q.Promise((resolve, reject) => {
		  	var media = null;
			  upload.single(key)(req, null, (err) => {
			    if (err) {
			      reject(new this.api.Exceptions(['FAILED_TO_UPLOAD_MEDIA']));
			    } else {
			      var file = (req.files || {})[key];
			      if (file) {
			        media = new this(file.path);
			        media.uploaded_file = file;
			        media.load()
			          .then(() => {
			            if (media.supported()) {
			              media.test()
			                .then(resolve)
			                .catch(rejectAndDelete);
			            } else {
			              rejectAndDelete(new this.api.Exceptions(['MEDIA_IS_NOT_SUPPORTED']));
			            }
			          })
			          .catch(rejectAndDelete);
			      } else {
			        reject(new this.api.Exceptions(['FILE_IS_MISSING']));
			      }
			    }
			  });
			  /**
			   * Reject and delete uploaded media
			   */
			  function rejectAndDelete(exceptions) {
			    media.delete();
			    reject(exceptions);
			  }
		  });
		}

		/**
		 * The api
		 */
		get api() {
			return api;
		}

		/**
		 * Create image thumbnail
		 */
		createThumb(source, dest, width, height, type) {
		  var dirname = path.dirname(dest),
		      layers  = new Layers(width, height);
		  layers.fill(0xFFFFFFFF);
		  layers.add(source)
		        .position('center center')
		        .size('cover');
		  // Hook adding of layer
		  this.hook('thumb-add-layer', [layers]);
		  fs.ensureDirSync(dirname);
		  // Finalize layers
		  return layers
		    .save(dest)
		    .then(() => {
		      var plugins = [];
		      switch (type) {
		        case 'jpeg':
		        case 'jpg':
		          plugins.push(mozjpeg({
		          	quality: 90
		          }));
		          break;
		        case 'png':
		        	plugins.push(pngquant({
		        		quality: 98,
		        		speed: 		1
		        	}));
		          break;
		      }
		      return q.Promise((resolve, reject) => {
			      imagemin([dest], dirname, {
			      	plugins: plugins
			      }).then((files) => {
			      	resolve(this);
			      }).catch((err) => {
			      	reject(err);
			      });
		      });
		    }).catch(() => {
		      reject(new this.api.Exceptions(['FAILED_TO_SAVE_IMAGE']));
		    });
		}

		/**
		 * Delete
		 */
		delete() {
		  if (fs.existsSync(this.filepath || '')) {
		    fs.removeSync(this.filepath);
		  }
		  return this;
		}

		/**
		 * Generate a filename
		 */
		generateName() {
		  var subtype = this.getSubtype();
		  return moment().format('x') + (subtype ? ('.' + subtype) : '');
		}

		/**
		 * Get basename
		 */
		getBasename() {
		  return path.basename(this.filepath, this.getExtension());
		}

		/**
		 * Get dirname
		 */
		getDirname() {
		  return path.dirname(this.filepath);
		}

		/**
		 * Get extension
		 */
		getExtension() {
		  return path.extname(this.filepath);
		}

		/**
		 * Get filename
		 */
		getFilename() {
		  return path.basename(this.filepath);
		}

		/**
		 * Meta
		 */
		getMeta() {
		  var meta    = this.getType(),
		      subtype = this.getSubtype();
		  if (subtype) {
		    meta += ((meta ? '/' : '') + subtype);
		  }
		  return meta;
		}

		/**
		 * Get relative path
		 */
		getRelative() {
		  return (this.filepath.substr(0, this.api.root.length) === this.api.root) ?
				this.filepath.substr(this.api.root.length) :
		  	null;
		}

		/**
		 * Get stat
		 */
		getStat() {
		  return (this.info || {}).stat || {};
		}

		/**
		 * Get subtype
		 */
		getSubtype() {
		  return (this.info || {}).subtype || '';
		}

		/**
		 * Get type
		 */
		getType() {
		  return (this.info || {}).type || '';
		}

		/**
		 * Basename has dimensions
		 */
		hasDimensions() {
			return this.constructor.getDimensionsIndex(this.getBasename()) >= 0;
		}
		
		/**
		 * Initialize
		 */
		init() {
		  if (fs.pathExistsSync(this.filepath)) {
		    return this.load();
		  }
		  var original_path = this.filepath;
		  this.filepath = this.api.path('/' + original_path, 'media');
		  if (fs.pathExistsSync(this.filepath)) {
		  	return this.load();
		  }
		  var basename  = this.getBasename(),
		      index     = this.constructor.getDimensionsIndex(basename);
		  if (index >= 0) {
		    var dirname         = _.trimEnd(this.getDirname(), '/') + '/',
		        extension       = this.getExtension(),
		        target          = basename.substr(0, index),
		        arr_dimensions  = basename.substr(index).split('x'),
		        width           = parseInt(arr_dimensions[0]),
		        height          = parseInt(arr_dimensions[1]);
		    if (target.charAt(target.length - 1) === '-') {
		      target = target.substr(0, target.length -1);
		    }
		    this.setTarget({
		      filepath: this.api.path('/' + original_path, 'media'),
		      dimensions: {
		        width:  width,
		        height: height
		      }
		    });
		    this.filepath = dirname + target + extension;
		  }
		  if (!fs.pathExistsSync(this.filepath)) {
		    return q.reject(new this.api.Exceptions(['MEDIA_NOT_FOUND']));
		  }
		  return this.load().then(() => {
		  	return this.process();
		  });
		}

		/**
		 * Check mime type
		 */
		is(type, subtype) {
		  return (this.getType() === type) && (_.isUndefined(subtype) || (this.getSubtype() === subtype));
		}

		/**
		 * Load media
		 */
		load() {
		  var stat  = fs.statSync(this.filepath) || {},
		      mime  = ((fileType(readChunk.sync(this.filepath, 0, stat.size || 0)) || {}).mime || '').split('/');
		  this.info = {
		    stat:     stat,
		    type:     mime[0] || '',
		    subtype:  mime[1] || ''
		  };
		  return q.when(this);
		}

		/**
		 * Move uploaded media file
		 */
		moveUploaded(dest) {
		  var target = this.api.path('/' + dest + '/' + moment().format('YYYY-MM-DD') + '/', 'media')
		  fs.ensureDirSync(target);
		  var filename  = utils.safeFilename(target + (this.uploaded_file.name || this.generateName()));
		  fs.moveSync(this.filepath, filename);
		  this.filepath = filename;
		  return this.load();
		}

		/**
		 * Process media
		 * @param boolean force - Forces processing regardless of whether target already exists or not
		 */
		process(force) {
		  switch (this.getType()) {
		    case 'image':
		      if (_.isUndefined(this.target)) {
		        return q.reject(new this.api.Exceptions(['IMAGE_SIZE_IS_REQUIRED']));
		      }
		      if (!force && fs.pathExistsSync(this.target.filepath)) {
		      	return q.when(this);
		      }
		      var width   = this.target.dimensions.width,
		          height  = this.target.dimensions.height;
		      if ((width <= 0) || (height <= 0)) {
		        return q.reject(new this.api.Exceptions(['INVALID_IMAGE_SIZE']));
		      }
		      return this.createThumb(this.filepath, this.target.filepath, width, height, this.getSubtype()).then(() => {
		        this.filepath = this.target.filepath;
		        // Reset target
		      	this.target 	= utils.undefined;
		        return this.load();
		      });
		  }
		  return q.when(this);
		}

		/**
		 * Set target
		 */
		setTarget(target) {
			this.target = target;
			return this;
		}

		/**
		 * Stream this media
		 */
		stream(res) {
		  res.setHeader('Content-Type',   this.getMeta());
		  res.setHeader('Content-Length', this.info.stat.size || 0);
		  fs.createReadStream(this.filepath).pipe(res);
		  return this;
		}

		/**
		 * Media is supported
		 */
		supported() {
		  var supported = {
		    image: [
		      'jpg',
		      'jpeg',
		      'png'
		    ]
		  };
		  var type    = this.getType(),
		      subtype = this.getSubtype();
		  if (_.isUndefined(supported[type])) {
		    return false;
		  }
		  return supported[type].indexOf(subtype) >= 0;
		}

		/**
		 * Test media
		 */
		test() {
			return q.Promise((resolve, reject) => {
			  switch (this.getType()) {
			    case 'image':
			      try {
			        Jimp.read(this.filepath, (err) => {
			          if (err) {
			            reject(new this.api.Exceptions(['MEDIA_IS_NOT_SUPPORTED']));
			          } else {
			            resolve(this);
			          }
			        });
			      } catch (exception) {
			        reject(new this.api.Exceptions(['FAILED_TO_READ_IMAGE']));
			      }
			      break;
			    default:
			      resolve(this);
			      break;
			  }
			});
		}
	}
};