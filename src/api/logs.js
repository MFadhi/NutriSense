/** src/api/logs.js */
import { get, post, patch, del } from './client';
import { mockLogs } from './mock/mockAdapter';

const isMock = import.meta.env.VITE_USE_MOCK === 'true';

export const createLog = (body) =>
  isMock ? mockLogs.createLog(body) : post('/logs', body);

export const getLogs = (date) =>
  isMock ? mockLogs.getLogs(date) : get(`/logs?date=${date}`);

export const updateLog = (id, body) =>
  isMock ? mockLogs.updateLog(id, body) : patch(`/logs/${id}`, body);

export const deleteLog = (id) =>
  isMock ? mockLogs.deleteLog(id) : del(`/logs/${id}`);
