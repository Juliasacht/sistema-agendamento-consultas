import { asyncHandler } from '../middlewares/security.js';
import { Router } from 'express';
import { ensureAdmin } from '../middlewares/auth.js';
import {
  getList,
  getCreate,
  postCreate,
  getEdit,
  postEdit,
  getDelete,
  postCancel,
} from '../controllers/consultaController.js';

const router = Router();

router.use(ensureAdmin);

router.get('/', asyncHandler(getList));
router.get('/novo', asyncHandler(getCreate));
router.post('/novo', asyncHandler(postCreate));
router.get('/editar/:id', asyncHandler(getEdit));
router.post('/editar/:id', asyncHandler(postEdit));
router.post('/excluir/:id', asyncHandler(getDelete));
router.post('/cancelar/:id', asyncHandler(postCancel));

export default router;
