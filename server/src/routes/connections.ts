import { Router } from 'express';
import * as connectionsController from '../controllers/connections';

const router = Router();

router.post('/test', connectionsController.testConnection);
router.post('/:id/authenticate', connectionsController.authenticateConnection);
router.post('/', connectionsController.createConnection);
router.get('/', connectionsController.getAllConnections);
router.get('/:id', connectionsController.getConnection);
router.put('/:id', connectionsController.updateConnection);
router.delete('/:id', connectionsController.deleteConnection);

export default router;
