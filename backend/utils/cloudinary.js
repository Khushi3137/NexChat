const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

const hasRealConfigValue = (value) =>
  Boolean(value) &&
  !String(value).includes('your_') &&
  !String(value).includes('example');

const isCloudinaryConfigured = () =>
  hasRealConfigValue(process.env.CLOUDINARY_CLOUD_NAME) &&
  hasRealConfigValue(process.env.CLOUDINARY_API_KEY) &&
  hasRealConfigValue(process.env.CLOUDINARY_API_SECRET);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    if (!isCloudinaryConfigured()) {
      throw new Error('Cloudinary is not configured. Update CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend/.env.');
    }

    return {
      folder: 'nexus-chat',
      resource_type: 'auto',
      allowed_formats: [
        'jpg',
        'jpeg',
        'png',
        'gif',
        'webp',
        'pdf',
        'txt',
        'doc',
        'docx',
        'ppt',
        'pptx',
        'xls',
        'xlsx',
        'csv',
        'zip',
        'mp3',
        'wav',
        'm4a',
        'ogg',
        'webm',
        'mp4',
        'mov',
        'avi',
      ],
    };
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

const requireCloudinaryConfig = (req, res, next) => {
  if (!isCloudinaryConfigured()) {
    return res.status(500).json({
      message:
        'Uploads are not configured yet. Add real Cloudinary credentials in backend/.env and restart the backend.',
    });
  }

  return next();
};

module.exports = { cloudinary, upload, isCloudinaryConfigured, requireCloudinaryConfig };
