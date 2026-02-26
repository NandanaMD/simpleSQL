import { Router } from 'express';
import multer from 'multer';
import * as importController from '../controllers/import';
import appConfig from '../config';
import { Request, Response, NextFunction } from 'express';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: appConfig.csv.maxSizeMB * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    // Accept CSV files
    if (file.mimetype === 'text/csv' || 
        file.mimetype === 'application/csv' || 
        file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// Error handler for multer
const handleMulterError = (err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: `File too large. Maximum size is ${appConfig.csv.maxSizeMB}MB`,
      });
    }
    return res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`,
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      error: err.message || 'File upload failed',
    });
  }
  return next();
};

const router = Router();

router.post('/preview', upload.single('file'), handleMulterError, importController.previewCSV);
router.post('/', upload.single('file'), handleMulterError, importController.importCSV);

export default router;
