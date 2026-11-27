/**
 * Barre de navigation de l'application.
 * @module frontend/components/Header
 */
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Header.css";

/**
 * Barre de navigation.
 * Bugs corrigés (E27) :
 * - la déconnexion laissait l'utilisateur sur la liste des tâches ;
 * - aucun lien ne menait à la page d'inscription ;
 * - le bouton « Déconnexion » n'avait pas le style des autres liens.
 *
 * @param {Object} props
 * @param {boolean} props.isAuthenticated - affiche « Mes Tâches / Déconnexion » si vrai,
 *   « Connexion / Inscription » sinon
 * @param {function(): void} props.onLogout - déconnecte l'utilisateur dans App
 */
const Header = ({ isAuthenticated, onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate("/login", {
      state: { message: "Vous êtes déconnecté.", type: "success" },
    });
  };

  return (
    <header className="header">
      <nav>
        <ul className="nav-list">
          {isAuthenticated ? (
            <>
              <li className="nav-item">
                <Link to="/tasks" className="nav-link">
                  Mes Tâches
                </Link>
              </li>
              <li className="nav-item">
                <button type="button" onClick={handleLogout} className="nav-link nav-button">
                  Déconnexion
                </button>
              </li>
            </>
          ) : (
            <>
              <li className="nav-item">
                <Link to="/login" className="nav-link">
                  Connexion
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/register" className="nav-link">
                  Inscription
                </Link>
              </li>
            </>
          )}
        </ul>
      </nav>
    </header>
  );
};

export default Header;
