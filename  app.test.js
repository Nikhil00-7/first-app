const request = require('supertest');
const app = require('./app');

describe('Express API Tests', () => {

  // Health Check
  describe('GET /health', () => {
    it('should return status ok', async () => {
      const res = await request(app).get('/health');

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  // Data Endpoint
  describe('GET /data', () => {
    it('should return data response', async () => {
      const res = await request(app).get('/data');

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        data: "This is some data from the service"
      });
    });
  });

  // Negative Test Case
  describe('GET /invalid-route', () => {
    it('should return 404 for unknown route', async () => {
      const res = await request(app).get('/invalid');

      expect(res.statusCode).toBe(404);
    });
  });

});