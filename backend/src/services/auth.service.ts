import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pgPool } from '../db/postgres';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface UserResponse {
  id: string;
  email: string;
  full_name?: string | null;
  role: string;
  created_at?: Date;
}

export interface AuthResult {
  user: UserResponse;
  token: string;
}

// In-memory fallback store for standalone testing or development when PostgreSQL is not yet spun up
const inMemoryUsers: Map<string, { id: string; email: string; password_hash: string; full_name?: string | null; role: string; created_at: Date }> = new Map();

export class AuthService {
  /**
   * Generates a signed JWT token
   */
  static generateToken(user: { id: string; email: string; role: string; full_name?: string | null }): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
      },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN as any }
    );
  }

  /**
   * Registers a new user with hashed password
   */
  static async signup(email: string, password: string, fullName?: string): Promise<AuthResult> {
    const normalizedEmail = email.toLowerCase().trim();

    // Password strength check
    if (password.length < 8) {
      const error: any = new Error('Password must be at least 8 characters long');
      error.statusCode = 400;
      throw error;
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    try {
      // 1. Try PostgreSQL database insertion
      const existingRes = await pgPool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
      if (existingRes.rows.length > 0) {
        const error: any = new Error('User already exists with this email address');
        error.statusCode = 409;
        throw error;
      }

      const insertRes = await pgPool.query(
        `INSERT INTO users (email, password_hash, full_name, role)
         VALUES ($1, $2, $3, 'researcher')
         RETURNING id, email, full_name, role, created_at`,
        [normalizedEmail, passwordHash, fullName || null]
      );

      const dbUser = insertRes.rows[0];
      const token = this.generateToken(dbUser);

      return {
        user: {
          id: dbUser.id,
          email: dbUser.email,
          full_name: dbUser.full_name,
          role: dbUser.role,
          created_at: dbUser.created_at,
        },
        token,
      };
    } catch (err: any) {
      if (err.statusCode === 409 || err.statusCode === 400) {
        throw err;
      }

      // If PostgreSQL is unreachable, use in-memory fallback store
      logger.warn('PostgreSQL query failed, utilizing in-memory auth store for request');
      if (inMemoryUsers.has(normalizedEmail)) {
        const error: any = new Error('User already exists with this email address');
        error.statusCode = 409;
        throw error;
      }

      const id = crypto.randomUUID();
      const newUser = {
        id,
        email: normalizedEmail,
        password_hash: passwordHash,
        full_name: fullName || null,
        role: 'researcher',
        created_at: new Date(),
      };
      inMemoryUsers.set(normalizedEmail, newUser);

      const token = this.generateToken(newUser);
      return {
        user: {
          id: newUser.id,
          email: newUser.email,
          full_name: newUser.full_name,
          role: newUser.role,
          created_at: newUser.created_at,
        },
        token,
      };
    }
  }

  /**
   * Authenticates user credentials and returns JWT
   */
  static async login(email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = email.toLowerCase().trim();

    try {
      // 1. Try PostgreSQL database lookup
      const res = await pgPool.query(
        'SELECT id, email, password_hash, full_name, role, created_at FROM users WHERE email = $1',
        [normalizedEmail]
      );

      if (res.rows.length > 0) {
        const user = res.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
          const error: any = new Error('Invalid email or password');
          error.statusCode = 401;
          throw error;
        }

        const token = this.generateToken(user);
        return {
          user: {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            created_at: user.created_at,
          },
          token,
        };
      }
    } catch (err: any) {
      if (err.statusCode === 401) throw err;
      // Fall through to in-memory check if DB failed
    }

    // 2. Check in-memory fallback
    const memUser = inMemoryUsers.get(normalizedEmail);
    if (!memUser) {
      const error: any = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const isMatch = await bcrypt.compare(password, memUser.password_hash);
    if (!isMatch) {
      const error: any = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const token = this.generateToken(memUser);
    return {
      user: {
        id: memUser.id,
        email: memUser.email,
        full_name: memUser.full_name,
        role: memUser.role,
        created_at: memUser.created_at,
      },
      token,
    };
  }

  /**
   * Retrieves profile by user id
   */
  static async getProfile(userId: string): Promise<UserResponse> {
    try {
      const res = await pgPool.query(
        'SELECT id, email, full_name, role, created_at FROM users WHERE id = $1',
        [userId]
      );
      if (res.rows.length > 0) {
        return res.rows[0];
      }
    } catch {
      // Fall through to in-memory check
    }

    for (const u of inMemoryUsers.values()) {
      if (u.id === userId) {
        return {
          id: u.id,
          email: u.email,
          full_name: u.full_name,
          role: u.role,
          created_at: u.created_at,
        };
      }
    }

    const error: any = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }
}
