import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { getRedis, parseBody, credsFrom, authorize, canManageSchool } from './_lib.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDICATOR_DATA = JSON.parse(readFileSync(path.join(__dirname, '..', 'src', 'data', 'indicators.json'), 'utf8'));

function emptyEvidence() {
  const ev = {};
  for (const k of ['kp', 'kk', 'il']) {
    INDICATOR_DATA[k].butir.forEach((b) =>
      b.items.forEach((it) => {
        ev[it.code] = { skor: 0, buktiPilih: null, buktiTersedia: '', buktiPerlu: '', lokasi: '', catatan: '', updatedAt: null };
      })
    );
  }
  return ev;
}

export default async function handler(req, res) {
  const schoolId = req.query && req.query.schoolId;

  let redis;
  try {
    redis = getRedis();
  } catch (e) {
    return res.status(500).json({ error: e.message, code: e.code || 'REDIS_NOT_CONFIGURED' });
  }

  if (req.method === 'GET') {
    if (!schoolId) return res.status(400).json({ error: 'schoolId wajib diisi' });
    let data;
    try {
      data = await redis.get('evidence:' + schoolId);
    } catch (e) {
      return res.status(500).json({ error: 'Gagal membaca database Redis.', code: 'REDIS_NOT_CONFIGURED' });
    }
    return res.status(200).json(data || emptyEvidence());
  }

  if (req.method === 'PUT') {
    const body = parseBody(req);
    const { schoolId: sid, evidence } = body;
    if (!sid || !evidence) return res.status(400).json({ error: 'schoolId dan evidence wajib diisi' });
    await redis.set('evidence:' + sid, evidence);
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const body = parseBody(req);
    const sid = schoolId || body.schoolId;
    let auth;
    try { auth = await authorize(redis, credsFrom(req, body)); } catch (err) {
      return res.status(500).json({ error: 'Gagal membaca database Redis.', code: 'REDIS_NOT_CONFIGURED' });
    }
    if (!auth) return res.status(403).json({ error: 'Kode akses tidak valid.' });
    if (auth.role !== 'koordinator') {
      const schools = (await redis.get('schools:list')) || [];
      const school = Array.isArray(schools) ? schools.find((x) => x.id === sid) : null;
      if (!canManageSchool(auth, school)) return res.status(403).json({ error: 'Sekolah ini bukan sekolah binaan Anda.' });
    }
    if (!sid) return res.status(400).json({ error: 'schoolId wajib diisi' });
    const empty = emptyEvidence();
    await redis.set('evidence:' + sid, empty);
    return res.status(200).json(empty);
  }

  return res.status(405).json({ error: 'Metode tidak didukung' });
}
