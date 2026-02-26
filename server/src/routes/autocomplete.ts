import { Router } from 'express';
import * as autocompleteController from '../controllers/autocomplete';

const router = Router();

router.get('/suggestions', autocompleteController.getAutocompleteSuggestions);

export default router;
