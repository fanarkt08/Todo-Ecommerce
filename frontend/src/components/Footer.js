/**
 * Pied de page de l'application.
 * @module frontend/components/Footer
 */
import React from "react";

/**
 * Pied de page affiché sur toutes les pages.
 * Bug corrigé (E27) : l'année du copyright était écrite en dur (2025).
 */
const Footer = () => {
  return (
    <footer style={{ backgroundColor: "#4b6cb7" }}>
      {/* Bug corrigé (E27) : l'année était écrite en dur (2025) */}
      <p>&copy; {new Date().getFullYear()} Application Mes Tâches</p>
    </footer>
  );
};

export default Footer;
