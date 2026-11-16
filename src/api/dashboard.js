/** src/api/dashboard.js */
import { get } from './client';
import { mockDashboard } from './mock/mockAdapter';

const isMock = import.meta.env.VITE_USE_MOCK === 'true';

export const getDailyDashboard = (date) =>
  isMock ? mockDashboard.getDailyDashboard(date) : get(`/dashboard/daily?date=${date}`);

export const getWeeklyDashboard = (end, days = 7) =>
  isMock ? mockDashboard.getWeeklyDashboard(end, days) : get(`/dashboard/weekly?end=${end}&days=${days}`);
