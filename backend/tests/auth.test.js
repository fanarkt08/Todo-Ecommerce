const jwt = require('jsonwebtoken');
const { app, request, connect, disconnect, registerUser } = require('./helpers');

beforeAll(() => connect('auth'));
afterAll(() => disconnect());

describe('POST /api/auth/register', () => {
  test('crée un compte et renvoie un token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: `nouveau${Date.now().toString().slice(-6)}`, password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  test.each([
    [{}, 'Veuillez remplir tous les champs.'],
    [{ username: 'ab', password: 'secret123' }, "Le nom d'utilisateur doit contenir entre 3 et 30 caractères."],
    [{ username: 'valide', password: '123' }, 'Le mot de passe doit contenir au moins 6 caractères.'],
  ])('refuse un formulaire invalide %j (bug B2)', async (body, msg) => {
    const res = await request(app).post('/api/auth/register').send(body);
    expect(res.status).toBe(400);
    expect(res.body.msg).toBe(msg);
  });

  test('refuse un nom déjà utilisé', async () => {
    const { username } = await registerUser('doublon');
    const res = await request(app).post('/api/auth/register').send({ username, password: 'secret123' });
    expect(res.status).toBe(400);
    expect(res.body.msg).toBe("Ce nom d'utilisateur est déjà utilisé.");
  });
});

describe('POST /api/auth/login', () => {
  test('connecte un utilisateur existant', async () => {
    const { username } = await registerUser('login');
    const res = await request(app).post('/api/auth/login').send({ username, password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  test('mauvais mot de passe : message clair mais générique', async () => {
    const { username } = await registerUser('login');
    const res = await request(app).post('/api/auth/login').send({ username, password: 'mauvais' });
    expect(res.status).toBe(400);
    expect(res.body.msg).toBe("Nom d'utilisateur ou mot de passe incorrect.");
  });

  test('refuse une injection NoSQL ({"$ne": null}) (faille S2)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
    expect(res.body.token).toBeUndefined();
  });
});

describe('Protection des routes par token (middleware auth)', () => {
  test('sans token : 401', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
  });

  test('token invalide : 401 et non 418 (bug B5)', async () => {
    const res = await request(app).get('/api/tasks').set('x-auth-token', 'faux.token.jwt');
    expect(res.status).toBe(401);
  });

  test('token non signé (alg "none") refusé (faille S4)', async () => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const forged = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ user: { id: '000000000000000000000000' } })}.`;
    const res = await request(app).get('/api/tasks').set('x-auth-token', forged);
    expect(res.status).toBe(401);
  });

  test('token signé avec un autre secret refusé', async () => {
    const forged = jwt.sign({ user: { id: '000000000000000000000000' } }, 'un-autre-secret-de-plus-de-32-caracteres');
    const res = await request(app).get('/api/tasks').set('x-auth-token', forged);
    expect(res.status).toBe(401);
  });
});

describe('Sécurité HTTP', () => {
  test("CORS : aucun site tiers n'est autorisé (faille S5)", async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://site-malveillant.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  test("l'en-tête X-Powered-By n'est pas envoyé (faille S9)", async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('GET /api/health : 200 et base connectée', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'up' });
  });
});
