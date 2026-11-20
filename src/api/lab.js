import { get, post, patch, del } from './client';
import { mockLab } from './mock/mockAdapter';

const isMock = import.meta.env.VITE_USE_MOCK === 'true';

export const getConsent = () =>
  isMock ? mockLab.getConsent() : get('/lab/consent');

export const setConsent = (consented = true) =>
  isMock ? mockLab.setConsent(consented) : post('/lab/consent', { consented });

export const withdrawConsent = () =>
  isMock ? mockLab.withdrawConsent() : del('/lab/consent');

export const uploadReport = (formData) => {
  if (isMock) return mockLab.uploadReport(formData);
  // Using direct fetch via client's request pattern for multipart
  const token = sessionStorage.getItem('nutrilens_at') || '';
  const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1';
  return fetch(`${BASE}/lab/reports/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw {
        code: data?.error?.code || `http_${res.status}`,
        message: data?.error?.message || 'Report upload failed.',
        status: res.status,
      };
    }
    return data;
  });
};

export const listReports = () =>
  isMock ? mockLab.listReports() : get('/lab/reports');

export const getReport = (id) =>
  isMock ? mockLab.getReport(id) : get(`/lab/reports/${id}`);

export const deleteReport = (id) =>
  isMock ? mockLab.deleteReport(id) : del(`/lab/reports/${id}`);

export const saveResults = (results) =>
  isMock ? mockLab.saveResults(results) : post('/lab/results', { results });

export const listResults = (params = {}) => {
  if (isMock) return mockLab.listResults(params);
  const q = new URLSearchParams(params).toString();
  return get(`/lab/results${q ? `?${q}` : ''}`);
};

export const getResultsHistory = () =>
  isMock ? mockLab.getResultsHistory() : get('/lab/results/history');

export const updateResult = (id, patchBody) =>
  isMock ? mockLab.updateResult(id, patchBody) : patch(`/lab/results/${id}`, patchBody);

export const deleteResult = (id) =>
  isMock ? mockLab.deleteResult(id) : del(`/lab/results/${id}`);

export const getInsights = () =>
  isMock ? mockLab.getInsights() : get('/lab/insights');

export const evaluateAdHoc = (parameter, value, unit) =>
  isMock ? mockLab.evaluateAdHoc(parameter, value, unit) : post('/lab/insights/evaluate', { parameter, value, unit });
