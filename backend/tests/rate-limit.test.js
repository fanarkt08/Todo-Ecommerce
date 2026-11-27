// Fichier séparé : le compteur de tentatives (en mémoire) ne doit pas être
// influencé par les échecs volontaires des autres tests.
const { app, request, connect, disconnect, registerUser } = require('./helpers');

beforeAll(() => connect('ratelimit'));
afterAll(() => disconnect());

test('bloque la connexion après 10 échecs en 15 minutes (faille S6)', async () => {
  const { username } = await registerUser('cible');
  const attempt = () => request(app).post('/api/auth/login').send({ username, password: 'mauvais' });

  for (let i = 0; i < 10; i++) {
    expect((await attempt()).status).toBe(400);
  }

  const blocked = await attempt();
  expect(blocked.status).toBe(429);
  expect(blocked.body.msg).toBe('Trop de tentatives échouées. Réessayez dans 15 minutes.');
});
