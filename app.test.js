const request = require('supertest');
const app = require('./app');

describe('App API', () => {
  test('GET /health returns status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('GET /data returns expected payload', async () => {
    const res = await request(app).get('/data');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      data: 'This is some data from the service'
    });
  });

  test('GET unknown route returns 404', async () => {
    const res = await request(app).get('/invalid-route');
    expect(res.statusCode).toBe(404);
  });
});