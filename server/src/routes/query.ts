import { Router } from 'express';
import * as queryController from '../controllers/query';

const router = Router();

router.post('/', queryController.executeQuery);

export default router;
