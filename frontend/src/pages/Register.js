import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { getErrorMessage } from '../utils/errors';

/**
 * Page d'inscription.
 * Bugs corrigés (E27) :
 * - formulaire vide ou nom déjà pris : rien ne s'affichait (erreur seulement dans la console) ;
 * - après une inscription réussie, aucune confirmation sur la page de connexion.
 * Les règles (3 à 30 caractères pour le nom, 6 minimum pour le mot de passe)
 * sont aussi vérifiées par l'API.
 */
const Register = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  /** @returns {string} message d'erreur, ou chaîne vide si le formulaire est valide */
  const validate = () => {
    const name = username.trim();
    if (!name || !password) return 'Veuillez remplir tous les champs.';
    if (name.length < 3 || name.length > 30) return "Le nom d'utilisateur doit contenir entre 3 et 30 caractères.";
    if (password.length < 6) return 'Le mot de passe doit contenir au moins 6 caractères.';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    setError(validationError);
    if (validationError) return;

    setLoading(true);
    try {
      await api.post('/auth/register', { username: username.trim(), password });
      navigate('/login', {
        state: { message: 'Compte créé avec succès, vous pouvez vous connecter.', type: 'success' },
      });
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Inscription</h1>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="username">Nom d'utilisateur</label>
          <input id="username" type="text" autoComplete="username" maxLength={30} value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="password">Mot de passe (6 caractères minimum)</label>
          <input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Création du compte...' : 'Créer mon compte'}
        </button>
      </form>
      <p className="form-footer">
        Déjà inscrit ? <Link to="/login">Se connecter</Link>
      </p>
    </div>
  );
};

export default Register;
