import { asyncHandler, createLoginLimiter } from '../middlewares/security.js';
import { Router } from 'express';
import { getLogin, postLogin, getDashboard } from '../controllers/adminController.js';
import { ensureAdmin } from '../middlewares/auth.js';

const router = Router();

router.get('/login', getLogin);
router.post('/login', createLoginLimiter(), asyncHandler(postLogin));
router.get('/dashboard', ensureAdmin, asyncHandler(getDashboard));

router.post('/logout', ensureAdmin, (req, res, next) => {
  req.session.destroy(err => {
    if (err) return next(err);
    res.clearCookie('connect.sid', { path: '/' });
    res.redirect('/admin/login');
  });
});

export default router;
