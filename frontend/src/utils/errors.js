/**
 * Transforme une erreur d'appel à l'API (axios) en message lisible pour l'utilisateur.
 * - L'API a répondu avec un message (ex. 400) : on affiche ce message.
 * - L'API a répondu sans message (ex. 500) : message générique.
 * - Pas de réponse du tout : problème de réseau ou serveur injoignable.
 *
 * @param {unknown} err - erreur levée par axios
 * @param {string} [fallback] - message affiché si l'API ne fournit pas de détail
 * @returns {string}
 */
export function getErrorMessage(err, fallback = 'Une erreur est survenue, veuillez réessayer.') {
  if (err?.response?.data?.msg) return err.response.data.msg;
  if (err?.response) return fallback;
  return 'Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.';
}

/** En-têtes d'authentification à joindre aux appels protégés de l'API. */
export function authHeaders() {
  return { 'x-auth-token': localStorage.getItem('token') };
}
