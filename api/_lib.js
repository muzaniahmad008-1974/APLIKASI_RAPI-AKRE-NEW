import { Redis } from '@upstash/redis';

// Berkas berawalan "_" tidak dijadikan endpoint oleh Vercel; ini pustaka bersama
// untuk api/schools.js, api/evidence.js, dan api/pengawas.js.

export function getRedis() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    const err = new Error('Database Redis (Upstash) belum terkonfigurasi di server ini. Pasang integrasi "Upstash for Redis" lewat tab Storage di dashboard Vercel — lihat README bagian Troubleshooting.');
    err.code = 'REDIS_NOT_CONFIGURED';
    throw err;
  }
  return new Redis({ url, token });
}

export const ADMIN_CODE = process.env.ADMIN_CODE || 'akreditasi2026';

export function normalize(v) {
  return (v || '').toString().trim();
}
export function checkAdminCode(input) {
  return normalize(input) === normalize(ADMIN_CODE);
}

export function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body;
}

function header(req, name) {
  const h = req.headers || {};
  return h[name] || h[name.toLowerCase()] || '';
}

// Kredensial diambil dari header (DELETE) atau body (POST/PUT).
export function credsFrom(req, body) {
  return {
    adminCode: header(req, 'x-admin-code') || (body && body.adminCode) || '',
    pengawasId: header(req, 'x-pengawas-id') || (body && body.pengawasId) || '',
    pengawasCode: header(req, 'x-pengawas-code') || (body && body.pengawasCode) || '',
  };
}

// Mengembalikan { role: 'koordinator' } | { role: 'pengawas', pengawas: {id, name} } | null
export async function authorize(redis, creds) {
  if (normalize(creds.adminCode) && checkAdminCode(creds.adminCode)) return { role: 'koordinator' };
  if (creds.pengawasId && normalize(creds.pengawasCode)) {
    const list = (await redis.get('pengawas:list')) || [];
    const p = Array.isArray(list) ? list.find((x) => x.id === creds.pengawasId) : null;
    if (p && normalize(p.code) && normalize(p.code) === normalize(creds.pengawasCode)) {
      return { role: 'pengawas', pengawas: { id: p.id, name: p.name } };
    }
  }
  return null;
}

// Apakah pemanggil boleh mengelola sekolah ini?
export function canManageSchool(auth, school) {
  if (!auth || !school) return false;
  if (auth.role === 'koordinator') return true;
  return auth.role === 'pengawas' && school.pengawasId === auth.pengawas.id;
}
