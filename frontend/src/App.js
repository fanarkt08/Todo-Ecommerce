import React, { useState } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import "./App.css";
import Tasks from "./pages/Tasks";
import Header from "./components/Header";
import Footer from "./components/Footer";

/**
 * Composant racine : état de connexion et routes de l'application.
 * La page /tasks est protégée par le composant Tasks lui-même (redirection vers
 * /login sans token valide).
 */
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem("token")
  );

  const handleLogin = () => setIsAuthenticated(true);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
  };

  return (
    <Router>
      <div className="App">
        {/* Bug corrigé (E27) : Header était entouré d'un second <header> (en-tête en double) */}
        <Header isAuthenticated={isAuthenticated} onLogout={handleLogout} />
        <main>
          <Routes>
            <Route
              path="/"
              element={<Navigate to={isAuthenticated ? "/tasks" : "/login"} />}
            />
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            <Route path="/register" element={<Register />} />
            <Route path="/tasks" element={<Tasks onLogout={handleLogout} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
