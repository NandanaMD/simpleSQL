import { Router } from 'express';
import * as savedQueriesController from '../controllers/savedQueries';

const router = Router();

router.post('/', savedQueriesController.createSavedQuery);
router.get('/', savedQueriesController.getAllSavedQueries);
router.get('/:id', savedQueriesController.getSavedQuery);
router.put('/:id', savedQueriesController.updateSavedQuery);
router.delete('/:id', savedQueriesController.deleteSavedQuery);

export default router;
