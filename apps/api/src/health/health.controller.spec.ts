import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('reports liveness without configuration or readiness claims', () => {
    expect(new HealthController().check()).toEqual({
      status: 'ok',
      service: 'gst-billing-api',
    });
  });
});
