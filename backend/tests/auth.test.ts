import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('Authentication & Authorization Suite (Stage 3)', () => {
  const app = createApp();
  const testEmail = `researcher_${Date.now()}@hypothesiai.org`;
  const testPassword = 'StrongPassword123!';
  const testFullName = 'Dr. Ada Lovelace';

  let authToken: string;

  // 1. Signup test
  it('1. POST /api/v1/auth/signup should register a new user and return a JWT token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: testEmail,
        password: testPassword,
        full_name: testFullName,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user).toHaveProperty('id');
    expect(res.body.data.user.email).toBe(testEmail.toLowerCase());
    expect(res.body.data.user.full_name).toBe(testFullName);
    expect(res.body.data.user.role).toBe('researcher');
    // Ensure password_hash is never leaked in the API response
    expect(res.body.data.user).not.toHaveProperty('password_hash');

    authToken = res.body.data.token;
  });

  it('1b. POST /api/v1/auth/signup should reject duplicate email registrations', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('already exists');
  });

  it('1c. POST /api/v1/auth/signup should reject weak passwords (<8 chars)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: `short_${Date.now()}@test.org`,
        password: 'short',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // 2. Login test
  it('2. POST /api/v1/auth/login should authenticate valid credentials and return a token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user.email).toBe(testEmail.toLowerCase());

    authToken = res.body.data.token;
  });

  it('2b. POST /api/v1/auth/login should reject invalid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'WrongPassword!',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // 4. Protected API access test
  it('4. GET /api/v1/auth/me should grant access when provided with a valid Bearer token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(testEmail.toLowerCase());
    expect(res.body.data.full_name).toBe(testFullName);
    expect(res.body.data.role).toBe('researcher');
  });

  // 5. Unauthenticated access rejection test
  it('5. GET /api/v1/auth/me should reject access when no Bearer token is provided', async () => {
    const res = await request(app).get('/api/v1/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Authentication required');
  });

  it('5b. GET /api/v1/auth/me should reject access when an invalid token is provided', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid_bogus_jwt_token_123');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Invalid or expired');
  });

  // 3. Logout test
  it('3. POST /api/v1/auth/logout should acknowledge logout for authenticated session', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Logged out successfully');
  });
});
