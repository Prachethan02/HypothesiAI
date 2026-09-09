import { Router } from 'express';
import { z } from 'zod';
import { signup, login, logout, getMe } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate';

import { authRateLimiter } from '../middleware/rateLimiter';

export const authRouter = Router();

const signupSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  full_name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(1, 'Password is required'),
});

authRouter.post('/signup', authRateLimiter(), validateBody(signupSchema), signup);
authRouter.post('/login', authRateLimiter(), validateBody(loginSchema), login);
authRouter.post('/logout', requireAuth, logout);
authRouter.get('/me', requireAuth, getMe);
