import { get, post, put, del } from './client';
import { mockMealPlanner } from './mock/mockAdapter';

const isMock = import.meta.env.VITE_USE_MOCK === 'true';

export const getMealPreferences = () =>
  isMock ? mockMealPlanner.getPreferences() : get('/meal-planner/preferences');

export const updateMealPreferences = (body) =>
  isMock ? mockMealPlanner.updatePreferences(body) : put('/meal-planner/preferences', body);

export const generateDailyPlan = (body = {}) =>
  isMock ? mockMealPlanner.generateDaily(body) : post('/meal-planner/generate/daily', body);

export const generateWeeklyPlan = (body = {}) =>
  isMock ? mockMealPlanner.generateWeekly(body) : post('/meal-planner/generate/weekly', body);

export const replaceMeal = (body) =>
  isMock ? mockMealPlanner.replaceMeal(body) : post('/meal-planner/replace-meal', body);

export const saveMealPlan = (body) =>
  isMock ? mockMealPlanner.savePlan(body) : post('/meal-planner/save', body);

export const listMealPlans = () =>
  isMock ? mockMealPlanner.listPlans() : get('/meal-planner');

export const getMealPlan = (id) =>
  isMock ? mockMealPlanner.getPlan(id) : get(`/meal-planner/${id}`);

export const setActiveMealPlan = (id) =>
  isMock ? mockMealPlanner.setActivePlan(id) : put(`/meal-planner/${id}/active`, {});

export const deleteMealPlan = (id) =>
  isMock ? mockMealPlanner.deletePlan(id) : del(`/meal-planner/${id}`);
