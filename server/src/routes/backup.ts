import { Router } from 'express';
import * as backupController from '../controllers/backup';

const router = Router();

router.post('/create', backupController.backupDatabase);
router.post('/restore', backupController.restoreDatabase);
router.get('/list', backupController.listBackups);
router.delete('/:filename', backupController.deleteBackup);
router.get('/download/:filename', backupController.downloadBackup);

export default router;
