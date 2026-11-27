/**
 * Page de la liste des tâches (/tasks), réservée aux utilisateurs connectés.
 * @module frontend/pages/Tasks
 */
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import TaskForm from "../components/TaskForm";
import { authHeaders, getErrorMessage } from "../utils/errors";

/**
 * Liste des tâches de l'utilisateur connecté : ajout, modification, statut et suppression.
 * Bugs corrigés (E27) :
 * - une nouvelle tâche n'apparaissait qu'après rechargement de la page ;
 * - impossible de modifier une tâche ou de la marquer comme terminée ;
 * - session expirée : page vide et erreur JavaScript non gérée, sans redirection ;
 * - aucune erreur affichée à l'utilisateur (seulement dans la console).
 *
 * @param {Object} props
 * @param {function(): void} props.onLogout - déconnecte l'utilisateur dans App (session expirée)
 */
const Tasks = ({ onLogout }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const navigate = useNavigate();

  /**
   * Session expirée ou token invalide (401) : déconnexion et retour à la page de
   * connexion avec un message. Renvoie true si l'erreur a été traitée ici.
   */
  const handleAuthError = useCallback(
    (err) => {
      if (err?.response?.status !== 401) return false;
      onLogout();
      navigate("/login", {
        state: { message: "Votre session a expiré, veuillez vous reconnecter.", type: "error" },
      });
      return true;
    },
    [navigate, onLogout]
  );

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      navigate("/login");
      return;
    }
    const fetchTasks = async () => {
      try {
        const res = await api.get("/tasks", { headers: authHeaders() });
        setTasks(res.data);
      } catch (err) {
        if (!handleAuthError(err)) setError(getErrorMessage(err, "Impossible de charger vos tâches."));
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, [navigate, handleAuthError]);

  const addTask = (task) => {
    setTasks((prev) => [task, ...prev]);
    setError("");
  };

  /** Envoie une modification à l'API et met la liste à jour. Renvoie true si réussi. */
  const updateTask = async (id, changes) => {
    try {
      const res = await api.put(`/tasks/${id}`, changes, { headers: authHeaders() });
      setTasks((prev) => prev.map((t) => (t._id === id ? res.data : t)));
      setError("");
      return true;
    } catch (err) {
      if (!handleAuthError(err)) setError(getErrorMessage(err));
      return false;
    }
  };

  const toggleTask = (task) => updateTask(task._id, { isCompleted: !task.isCompleted });

  const startEdit = (task) => {
    setEditingId(task._id);
    setEditTitle(task.title);
    setError("");
  };

  const saveEdit = async (id) => {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setError("Le titre de la tâche ne peut pas être vide.");
      return;
    }
    if (await updateTask(id, { title: trimmed })) setEditingId(null);
  };

  const deleteTask = async (id) => {
    try {
      await api.delete(`/tasks/${id}`, { headers: authHeaders() });
      setTasks((prev) => prev.filter((task) => task._id !== id));
      setError("");
    } catch (err) {
      if (!handleAuthError(err)) setError(getErrorMessage(err));
    }
  };

  return (
    <div className="container">
      <h1>Mes Tâches</h1>
      <TaskForm addTask={addTask} onAuthError={handleAuthError} />
      {error && <p className="alert alert-error" role="alert">{error}</p>}

      {loading ? (
        <p className="empty-state">Chargement de vos tâches...</p>
      ) : tasks.length === 0 ? (
        <p className="empty-state">Aucune tâche pour le moment. Ajoutez-en une ci-dessus.</p>
      ) : (
        <ul className="task-list">
          {tasks.map((task) => (
            <li
              key={task._id}
              className={`task-item ${task.isCompleted ? "completed" : ""}`}
            >
              {editingId === task._id ? (
                <form
                  className="task-edit"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveEdit(task._id);
                  }}
                >
                  <input
                    type="text"
                    aria-label="Nouveau titre de la tâche"
                    maxLength={200}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    autoFocus
                  />
                  <div className="task-actions">
                    <button type="submit" className="btn-small btn-primary">Enregistrer</button>
                    <button type="button" className="btn-small btn-secondary" onClick={() => setEditingId(null)}>
                      Annuler
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <span className="task-title">{task.title}</span>
                  <div className="task-actions">
                    <button type="button" className="btn-small btn-success" onClick={() => toggleTask(task)}>
                      {task.isCompleted ? "Rouvrir" : "Terminer"}
                    </button>
                    <button type="button" className="btn-small btn-secondary" onClick={() => startEdit(task)}>
                      Modifier
                    </button>
                    <button type="button" className="btn-small btn-danger" onClick={() => deleteTask(task._id)}>
                      Supprimer
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Tasks;
