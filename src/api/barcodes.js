/** src/api/barcodes.js */
import { get } from './client';
import { mockBarcodes } from './mock/mockAdapter';

const isMock = import.meta.env.VITE_USE_MOCK === 'true';

export const lookupBarcode = (code) =>
  isMock ? mockBarcodes.lookupBarcode(code) : get(`/barcodes/${encodeURIComponent(code)}`);
