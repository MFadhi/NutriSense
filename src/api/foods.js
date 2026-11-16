/** src/api/foods.js */
import { get, post, patch, del } from './client';
import { mockFoods } from './mock/mockAdapter';

const isMock = import.meta.env.VITE_USE_MOCK === 'true';

export const searchFoods = (q = '', options = {}) => {
  if (isMock) return mockFoods.searchFoods(q, options);
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (options.category) params.set('category', options.category);
  if (options.diet) params.set('diet', options.diet);
  if (options.limit) params.set('limit', options.limit);
  if (options.offset) params.set('offset', options.offset);
  return get(`/foods?${params.toString()}`);
};

export const getCategories = () =>
  isMock ? mockFoods.getCategories() : get('/foods/categories');

export const getFood = (id) =>
  isMock ? mockFoods.getFood(id) : get(`/foods/${id}`);

export const getRecentFoods = () =>
  isMock ? mockFoods.getRecentFoods() : get('/foods/recent');

export const createCustomFood = (body) =>
  isMock ? mockFoods.createCustomFood(body) : post('/foods/custom', body);

export const updateCustomFood = (id, body) =>
  isMock ? mockFoods.updateCustomFood(id, body) : patch(`/foods/custom/${id}`, body);

export const deleteCustomFood = (id) =>
  isMock ? mockFoods.deleteCustomFood(id) : del(`/foods/custom/${id}`);
