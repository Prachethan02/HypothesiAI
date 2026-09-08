import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';

export async function signup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, full_name } = req.body;
    const result = await AuthService.signup(email, password, full_name);
    res.status(201).json({
      success: true,
      data: result,
      message: 'Account registered successfully',
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;
    const result = await AuthService.login(email, password);
    res.status(200).json({
      success: true,
      data: result,
      message: 'Authenticated successfully',
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  // Clear any server-side cookies if used, and acknowledge client session termination
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { message: 'Unauthorized', statusCode: 401 },
      });
      return;
    }

    const profile = await AuthService.getProfile(req.user.id);
    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (err) {
    next(err);
  }
}
