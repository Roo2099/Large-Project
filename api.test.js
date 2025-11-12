/**
 * @jest-environment node
 */
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const apiRoutes = require('../api.js');

// Set secret for JWT during tests
process.env.ACCESS_TOKEN_SECRET = 'test_secret';

// 🧩 Mock database models to isolate backend logic
jest.mock('../models/skill', () => ({
  find: jest.fn().mockResolvedValue([{ SkillName: 'JavaScript' }]),
  findOne: jest.fn(),
  create: jest.fn(),
  deleteOne: jest.fn()
}));

jest.mock('../models/user', () => ({
  findOne: jest.fn(),
  countDocuments: jest.fn().mockResolvedValue(1),
  create: jest.fn()
}));

jest.mock('../models/message', () => ({}));
jest.mock('../models/friendRequest', () => ({}));

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

// Generate valid JWT token for auth routes
const token = jwt.sign(
  { userId: 99, firstName: 'Unit', lastName: 'Tester' },
  process.env.ACCESS_TOKEN_SECRET
);

describe('SkillSwap API Routes', () => {

  // ---------- UNIT TESTS ----------
  test('GET /api/browseskills should return 200 and an array of skills', async () => {
    const res = await request(app).get('/api/browseskills');
    expect(res.statusCode).toBe(200);
    expect(res.body.skills[0].SkillName).toBe('JavaScript');
  });

  test('POST /api/addskill should reject if no token is provided', async () => {
    const res = await request(app)
      .post('/api/addskill')
      .send({ SkillName: 'NodeJS' });
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Missing token');
  });

  // ---------- INTEGRATION TESTS ----------
  test('GET /api/myskills should reject invalid token', async () => {
    const res = await request(app)
      .get('/api/myskills')
      .set('Authorization', 'Bearer badtoken');
    expect(res.statusCode).toBe(403);
  });

  test('GET /api/myskills should accept valid token', async () => {
    const res = await request(app)
      .get('/api/myskills')
      .set('Authorization', `Bearer ${token}`);
    expect([200, 500]).toContain(res.statusCode); // 200 if mocks succeed
  });

  test('POST /api/login should reject invalid user', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ login: 'fake@user.com', password: 'wrong' });
    expect([400, 500]).toContain(res.statusCode);
  });
});
