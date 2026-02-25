import { Router } from 'express';
import * as explainController from '../controllers/explain';

const router = Router();

router.post('/', explainController.explainQuery);

export default router;
