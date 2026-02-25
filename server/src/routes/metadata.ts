import { Router } from 'express';
import * as metadataController from '../controllers/metadata';

const router = Router();

router.get('/databases/:connectionId', metadataController.getDatabases);
router.get('/schemas/:connectionId/:database', metadataController.getSchemas);
router.get('/tables/:connectionId/:database/:schema', metadataController.getTables);
router.get('/table-structure/:connectionId/:database/:schema/:table', metadataController.getTableStructure);

export default router;
