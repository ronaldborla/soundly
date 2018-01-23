'use strict';

const fs  = require('fs-extra'),
      q   = require('q');

module.exports = function(Controller) {

  /**
   * Media controller
   */
  return class Media extends Controller {

    /**
     * The constructor
     */
    constructor() {
      super(...arguments);
      this.context = {
        ':media_date':      this.handleContext,
        ':media_filename':  this.handleContext,
        temp:     'media',
        uploads:  'media'
      };
    }

    /**
     * The Media
     */
    get Media() {
      return this.api.Media;
    }

    /**
     * Get by context
     */
    handleContext(req, method, context, path, parent) {
      switch (context.substr(1)) {
        case 'media_date':
          parent = parent || 'uploads';
          var directory = parent + '/' + req.context.media_date;
          if (fs.pathExistsSync(this.api.path('/' + directory, 'media'))) {
            return this[method](req, path, directory);
          } else {
            return q.reject(new this.Exceptions(['MEDIA_NOT_FOUND']));
          }
          break;
        case 'media_filename':
          var media = this.Media.read(parent + '/' + (req.context.media_filename || ''));
          this.hook('media-initialize-before', [media]);
          return media.init().then((media) => {
            this.hook('media-initialize-after', [media]);
            // Make sure that image files has dimensions
            if (media.is('image') && !media.hasDimensions()) {
              return media.process();
            }
            return media;
          });
      }
    }

    /**
     * Upload media
     */
    postMultiple(req) {
      return this.Media.upload(req).then((media) => {
        return media.moveUploaded('temp').then(() => {
          return media.getRelative();
        });
      });
    }
  }
}