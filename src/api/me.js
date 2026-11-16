/** src/api/me.js */
import { get, patch } from './client';
import { mockAuth } from './mock/mockAdapter';

const isMock = import.meta.env.VITE_USE_MOCK === 'true';

export const getMe = () =>
  isMock ? mockAuth.getMe() : get('/auth/me');

export const updateMe = (profileData) =>
  isMock ? mockAuth.updateMe(profileData) : patch('/auth/me', profileData);
