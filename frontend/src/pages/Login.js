/**
 * Page de connexion (/login).
 * @module frontend/pages/Login
 */
import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../api";
import { getErrorMessage } from "../utils/errors";

/**
 * Page de connexion.
 * Bugs corrigés (E27) :
 * - une erreur (mauvais mot de passe, champs vides) n'était visible que dans la console ;
 * - aucun lien vers l'inscription ;
 * - aucun message après une inscription, une déconnexion ou une session expirée.
 *
 * @param {Object} props
 * @param {function(): void} [props.onLogin] - prévient App que l'utilisateur est connecté
 *
 * La page affiche aussi le message transmis par une autre page dans `location.state`
 * (`{ message, type: "success" | "error" }`) : compte créé, déconnexion, session expirée.
 */
const Login = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Message transmis par une autre page (inscription réussie, déconnexion, session expirée)
  const info = location.state?.message;
  const infoType = location.state?.type || "success";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { username: username.trim(), password });
      localStorage.setItem("token", res.data.token);
      if (onLogin) onLogin();
      navigate("/tasks");
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Connexion</h1>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {!error && info && <p className={`alert alert-${infoType}`} role="status">{info}</p>}
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="username">Nom d'utilisateur</label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" className="btn" disabled={loading}>
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>
      <p className="form-footer">
        Pas encore de compte ? <Link to="/register">Créer un compte</Link>
      </p>
    </div>
  );
};

export default Login;
