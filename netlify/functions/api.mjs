// Netlify Function for the public API: /api, /api/date, /api/months, /api/holidays.
// See ../lib/hijri-api-core.mjs. Reads the months confirmed on the admin page from Netlify Blobs.
import { getStore } from '@netlify/blobs';
import { handleApi } from '../lib/hijri-api-core.mjs';
import data from '../lib/engine-data.mjs';

let cache = { at: 0, value: null };
async function confirmations() {
  if (Date.now() - cache.at < 30000) return cache.value;   // re-read the store at most every 30 s per instance
  const value = await getStore({ name: 'hijri-calendar', consistency: 'strong' }).get('confirmations', { type: 'json' });
  cache = { at: Date.now(), value };
  return value;
}

export default async (req) => handleApi(req, data, confirmations);

export const config = { path: ['/api', '/api/date', '/api/months', '/api/holidays'] };
