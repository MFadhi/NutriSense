/** src/api/auth.js */
import { get, post, patch } from './client';
import { mockAuth } from './mock/mockAdapter';

const isMock = import.meta.env.VITE_USE_MOCK === 'true';

export const login = (email, password) =>
  isMock ? mockAuth.login(email, password) : post('/auth/login', { email, password });

export const register = (email, password, diet_type) =>
  isMock ? mockAuth.register(email, password, diet_type) : post('/auth/register', { email, password, diet_type });

export const refresh = () =>
  isMock ? mockAuth.refresh() : post('/auth/refresh', {});

export const getMe = () =>
  isMock ? mockAuth.getMe() : get('/auth/me');

export const updateMe = (patch_body) =>
  isMock ? mockAuth.updateMe(patch_body) : patch('/auth/me', patch_body);
