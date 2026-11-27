import axios from 'axios';

// URL relative : l'API est servie sur le même domaine que le frontend, quel que soit
// l'environnement (prod, préprod). En local avec "npm start", le "proxy" du
// package.json relaie /api vers http://localhost:5000.
const api = axios.create({
  baseURL: '/api',
});

export default api;
