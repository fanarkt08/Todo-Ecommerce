const { app, request, connect, disconnect, registerUser, authHeader } = require('./helpers');

let alice;
let bob;

beforeAll(async () => {
  await connect('tasks');
  alice = await registerUser('alice');
  bob = await registerUser('bob');
});
afterAll(() => disconnect());

/** Crée une tâche pour un utilisateur et renvoie la réponse. */
const createTask = (user, body) => request(app).post('/api/tasks').set(authHeader(user)).send(body);
/** Renvoie la liste des tâches d'un utilisateur. */
const listTasks = async (user) => (await request(app).get('/api/tasks').set(authHeader(user))).body;

describe('POST /api/tasks : création', () => {
  test('crée une tâche (titre nettoyé) visible dans la liste', async () => {
    const res = await createTask(alice, { title: '  Acheter du pain  ' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'Acheter du pain', isCompleted: false });
    expect((await listTasks(alice)).map((t) => t._id)).toContain(res.body._id);
  });

  test.each(['', '   '])('refuse un titre vide %j (bug B2)', async (title) => {
    const res = await createTask(alice, { title });
    expect(res.status).toBe(400);
    expect(res.body.msg).toBe('Le titre de la tâche est obligatoire.');
  });

  test('refuse un titre de plus de 200 caractères', async () => {
    const res = await createTask(alice, { title: 'a'.repeat(201) });
    expect(res.status).toBe(400);
  });

  test.each(["<script>alert('test')</script>", "<img src=x onerror=alert('XSS')>"])(
    'refuse le HTML dans le titre : %s (faille S2)',
    async (title) => {
      const res = await createTask(alice, { title });
      expect(res.status).toBe(400);
      expect(res.body.msg).toBe("Le HTML n'est pas autorisé dans le titre.");
    }
  );

  test('refuse le HTML dans la description (faille S2)', async () => {
    const res = await createTask(alice, { title: 'ok', description: "<script>alert('test')</script>" });
    expect(res.status).toBe(400);
  });

  test("refuse une description qui n'est pas un texte (400 et non 500)", async () => {
    const res = await createTask(alice, { title: 'ok', description: { $gt: '' } });
    expect(res.status).toBe(400);
  });

  test('refuse une description de plus de 1 000 caractères', async () => {
    const res = await createTask(alice, { title: 'ok', description: 'x'.repeat(1001) });
    expect(res.status).toBe(400);
  });
});

describe('PUT et DELETE /api/tasks/:id', () => {
  test('marque une tâche comme terminée puis modifie son titre (bug B4)', async () => {
    const { body: task } = await createTask(alice, { title: 'À terminer' });

    const done = await request(app).put(`/api/tasks/${task._id}`).set(authHeader(alice)).send({ isCompleted: true });
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ isCompleted: true, title: 'À terminer' });

    const renamed = await request(app).put(`/api/tasks/${task._id}`).set(authHeader(alice)).send({ title: 'Renommée' });
    expect(renamed.status).toBe(200);
    expect(renamed.body).toMatchObject({ isCompleted: true, title: 'Renommée' });
  });

  test('refuse un statut qui n’est pas un booléen', async () => {
    const { body: task } = await createTask(alice, { title: 'Statut' });
    const res = await request(app).put(`/api/tasks/${task._id}`).set(authHeader(alice)).send({ isCompleted: 'oui' });
    expect(res.status).toBe(400);
  });

  test('identifiant mal formé : 404 et non 500 (bug B9)', async () => {
    const put = await request(app).put('/api/tasks/123').set(authHeader(alice)).send({ title: 'x' });
    const del = await request(app).delete('/api/tasks/123').set(authHeader(alice));
    expect(put.status).toBe(404);
    expect(del.status).toBe(404);
  });

  test("IDOR : un autre utilisateur ne peut ni modifier ni supprimer la tâche d'Alice (faille S1)", async () => {
    const { body: task } = await createTask(alice, { title: 'Tâche privée' });

    const put = await request(app).put(`/api/tasks/${task._id}`).set(authHeader(bob)).send({ title: 'Piratée' });
    const del = await request(app).delete(`/api/tasks/${task._id}`).set(authHeader(bob));
    expect(put.status).toBe(404);
    expect(del.status).toBe(404);

    const stillThere = (await listTasks(alice)).find((t) => t._id === task._id);
    expect(stillThere).toMatchObject({ title: 'Tâche privée' });
  });

  test("un utilisateur ne voit pas les tâches d'un autre", async () => {
    const { body: task } = await createTask(alice, { title: 'Visible par Alice seulement' });
    expect((await listTasks(bob)).map((t) => t._id)).not.toContain(task._id);
  });

  test('supprime sa propre tâche', async () => {
    const { body: task } = await createTask(alice, { title: 'À supprimer' });
    const res = await request(app).delete(`/api/tasks/${task._id}`).set(authHeader(alice));
    expect(res.status).toBe(200);
    expect((await listTasks(alice)).map((t) => t._id)).not.toContain(task._id);
  });
});
