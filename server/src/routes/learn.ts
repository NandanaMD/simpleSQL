import { Router } from 'express';
import * as learnController from '../controllers/learn';

const router = Router();

router.post('/coach', learnController.getAdaptiveCoach);
router.post('/hints', learnController.getSocraticHints);
router.post('/visualize', learnController.getExecutionVisualization);
router.post('/misconceptions', learnController.getMisconceptions);
router.post('/lab', learnController.generateAutoLab);
router.post('/drills', learnController.generateFixDrills);
router.post('/nl2sql', learnController.naturalLanguageToSql);

export default router;
