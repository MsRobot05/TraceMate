import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { requireAuth } from '../middleware/auth.js';
import { UPLOAD_DIR } from '../config.js';

const router = Router();
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    // Random server-chosen name: the client-supplied filename is never used on disk.
    filename: (_req, file, cb) => cb(null, `${crypto.randomBytes(16).toString('hex')}${EXT[file.mimetype] || ''}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (EXT[file.mimetype]) return cb(null, true);
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only JPEG, PNG or WebP images are allowed.'));
  }
});

/** Verify the real file signature, not just the (spoofable) Content-Type header. */
function looksLikeImage(file) {
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(12);
  fs.readSync(fd, buf, 0, 12, 0);
  fs.closeSync(fd);
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP';
  return isJpeg || isPng || isWebp;
}

// POST /api/uploads  (multipart field "photo")
router.post('/', requireAuth, (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large. The limit is 5 MB.'
        : err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Only JPEG, PNG or WebP images are allowed.'
        : 'Upload failed.';
      return res.status(400).json({ message });
    }
    if (err) return next(err);
    if (!req.file) return res.status(400).json({ message: 'Choose an image file to upload.' });

    if (!looksLikeImage(req.file.path)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: 'That file is not a valid JPEG, PNG or WebP image.' });
    }
    res.status(201).json({
      photo: { url: `/uploads/${path.basename(req.file.path)}`, originalName: String(req.file.originalname || '').slice(0, 120) }
    });
  });
});

export default router;
