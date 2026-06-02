const { upload } = require('../utils/cloudinary');

exports.uploadSingle = upload.single('file');
exports.uploadMultiple = upload.array('files', 5);
