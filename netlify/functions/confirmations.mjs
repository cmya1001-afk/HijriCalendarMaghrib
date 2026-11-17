// Netlify Function at /api/confirmations: stores the month starts confirmed on the admin page in
// Netlify Blobs (the site's built-in key-value store). See ../lib/confirmations-core.mjs for the rules.
// The admin key comes from the ADMIN_KEY environment variable set in the Netlify site settings.
import { getStore } from '@netlify/blobs';
import { handle } from '../lib/confirmations-core.mjs';
import base from '../lib/base.mjs';

export default async (req) =>
  handle(req, getStore({ name: 'hijri-calendar', consistency: 'strong' }), process.env.ADMIN_KEY || '', base);

export const config = { path: '/api/confirmations' };
