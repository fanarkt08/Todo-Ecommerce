import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TaskForm from "./TaskForm";
import api from "../api";

// L'API est simulée : les tests ne dépendent pas du backend.
jest.mock("../api", () => ({ __esModule: true, default: { post: jest.fn() } }));

const setup = (addTask = jest.fn()) => {
  render(<TaskForm addTask={addTask} onAuthError={() => false} />);
  const input = screen.getByPlaceholderText(/ajouter une tâche/i);
  const submit = (value) => {
    fireEvent.change(input, { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: /ajouter/i }));
  };
  return { addTask, submit };
};

beforeEach(() => jest.clearAllMocks());

test("refuse un titre vide sans appeler l'API (bug B2)", () => {
  const { submit } = setup();
  submit("   ");
  expect(screen.getByRole("alert").textContent).toBe("Le titre de la tâche ne peut pas être vide.");
  expect(api.post).not.toHaveBeenCalled();
});

test("envoie le titre nettoyé et ajoute la tâche à la liste sans recharger (bug B1)", async () => {
  const task = { _id: "1", title: "Acheter du pain", isCompleted: false };
  api.post.mockResolvedValue({ data: task });
  const { addTask, submit } = setup();

  submit("  Acheter du pain  ");

  await waitFor(() => expect(addTask).toHaveBeenCalledWith(task));
  expect(api.post).toHaveBeenCalledWith("/tasks", { title: "Acheter du pain" }, expect.any(Object));
});

test("affiche le message d'erreur renvoyé par l'API (faille S2 : HTML refusé)", async () => {
  api.post.mockRejectedValue({
    response: { status: 400, data: { msg: "Le HTML n'est pas autorisé dans le titre." } },
  });
  const { addTask, submit } = setup();

  submit("<img src=x onerror=alert(1)>");

  expect((await screen.findByRole("alert")).textContent).toBe("Le HTML n'est pas autorisé dans le titre.");
  expect(addTask).not.toHaveBeenCalled();
});
