import axios from 'axios';
import { clearAuthSession, getAuthSession } from './authStorage';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
});

api.interceptors.request.use((config) => {
    const session = getAuthSession();

    if (session?.token) {
        config.headers.Authorization = `Bearer ${session.token}`;
    }

    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            clearAuthSession();
        }

        return Promise.reject(error);
    },
);

export default api;
