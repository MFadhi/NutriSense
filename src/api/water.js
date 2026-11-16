/** src/api/water.js */
import { get, post, del } from './client';
import { mockWater } from './mock/mockAdapter';

const isMock = import.meta.env.VITE_USE_MOCK === 'true';

export const addWater = (body) =>
  isMock ? mockWater.addWater(body) : post('/water', body);

export const getWater = (date) =>
  isMock ? mockWater.getWater(date) : get(`/water?date=${date}`);

export const deleteWater = (id) =>
  isMock ? mockWater.deleteWater(id) : del(`/water/${id}`);
