/**
 * Client HTTP de l'application.
 * @module frontend/api
 */
import axios from 'axios';

/**
 * Client HTTP (axios) utilisé pour tous les appels à l'API.
 * URL relative `/api` : l'API est servie sur le même domaine que le frontend, quel que
 * soit l'environnement (prod, préprod). En local avec `npm start`, le `proxy` du
 * package.json relaie `/api` vers http://localhost:5000.
 * @type {AxiosInstance}
 */
const api = axios.create({
  baseURL: '/api',
});

export default api;
