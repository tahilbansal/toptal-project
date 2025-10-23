function mockReqRes(overrides = {}) {
  const req = {
    params: {},
    body: {},
    query: {},
    headers: {},
    user: { id: 'user-1' },
    ...overrides
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
  return { req, res };
}

module.exports = { mockReqRes };