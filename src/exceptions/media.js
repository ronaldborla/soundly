'use strict';

var codes = {};

codes.FAILED_TO_READ_IMAGE    = [500, 'Failed to read image'];
codes.FAILED_TO_SAVE_IMAGE    = [500, 'Failed to save image'];
codes.FAILED_TO_UPLOAD_MEDIA  = [500, 'Failed to upload media'];
codes.FILE_IS_MISSING         = [500, 'File is missing'];
codes.IMAGE_SIZE_IS_REQUIRED  = [400, 'Image size is required'];
codes.INVALID_IMAGE_SIZE      = [400, 'Invalid image size'];
codes.MEDIA_IS_NOT_SUPPORTED  = [415, 'Media is not supported'];
codes.MEDIA_NOT_FOUND         = [404, 'Media not found'];

module.exports = codes;