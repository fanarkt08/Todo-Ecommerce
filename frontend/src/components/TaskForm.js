/**
 * Formulaire d'ajout d'une tâche.
 * @module frontend/components/TaskForm
 */
import React, { useState } from "react";
import api from "../api";
import { authHeaders, getErrorMessage } from "../utils/errors";

/**
 * Formulaire d'ajout d'une tâche.
 * Bugs corrigés (E27) :
 * - un titre vide (ou fait d'espaces) était envoyé à l'API : erreur 500 ou ligne vide ;
 * - en cas d'erreur, rien ne s'affichait.
 *
 * @param {Object} props
 * @param {function(Object): void} props.addTask - ajoute la tâche créée (réponse de l'API) à la liste
 * @param {function(*): boolean} props.onAuthError - traite une session expirée (401) ;
 *   renvoie true si l'erreur a été prise en charge
 */
const TaskForm = ({ addTask, onAuthError }) => {
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Le titre de la tâche ne peut pas être vide.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/tasks", { title: trimmed }, { headers: authHeaders() });
      addTask(res.data);
      setTitle("");
    } catch (err) {
      if (!onAuthError(err)) setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form-group" noValidate>
      <input
        type="text"
        placeholder="Ajouter une tâche ..."
        maxLength={200}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      {error && <p className="alert alert-error field-error" role="alert">{error}</p>}
      <button type="submit" className="btn" style={{ marginTop: "10px" }} disabled={loading}>
        {loading ? "Ajout..." : "Ajouter Tâche"}
      </button>
    </form>
  );
};

export default TaskForm;
