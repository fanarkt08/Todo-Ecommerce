import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Login from "./Login";
import api from "../api";

// L'API est simulée : les tests ne dépendent pas du backend.
jest.mock("../api", () => ({ __esModule: true, default: { post: jest.fn() } }));

/** Affiche la page de connexion, avec éventuellement un message transmis par une autre page. */
const renderLogin = (state) =>
  render(
    <MemoryRouter
      initialEntries={[{ pathname: "/login", state }]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Login onLogin={jest.fn()} />
    </MemoryRouter>
  );

const fillAndSubmit = (username, password) => {
  fireEvent.change(screen.getByLabelText("Nom d'utilisateur"), { target: { value: username } });
  fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /se connecter/i }));
};

beforeEach(() => jest.clearAllMocks());

test("champs vides : message affiché sans appel à l'API (bug B2)", () => {
  renderLogin();
  fillAndSubmit("", "");
  expect(screen.getByRole("alert").textContent).toBe("Veuillez remplir tous les champs.");
  expect(api.post).not.toHaveBeenCalled();
});

test("mauvais identifiants : le message de l'API est affiché (bug B3)", async () => {
  api.post.mockRejectedValue({
    response: { status: 400, data: { msg: "Nom d'utilisateur ou mot de passe incorrect." } },
  });
  renderLogin();
  fillAndSubmit("alice", "mauvais");
  expect((await screen.findByRole("alert")).textContent).toBe("Nom d'utilisateur ou mot de passe incorrect.");
});

test("affiche le message transmis par une autre page (session expirée, bug B5)", () => {
  renderLogin({ message: "Votre session a expiré, veuillez vous reconnecter.", type: "error" });
  expect(screen.getByRole("status").textContent).toBe("Votre session a expiré, veuillez vous reconnecter.");
});

test("propose un lien vers l'inscription (bug B7)", () => {
  renderLogin();
  expect(screen.getByRole("link", { name: /créer un compte/i }).getAttribute("href")).toBe("/register");
});
