import { getRedis, parseBody, normalize, checkAdminCode, ADMIN_CODE, credsFrom, authorize, canManageSchool } from './_lib.js';

const SCHOOL_SEED = [
  { id: 's1', name: 'SMPN 1 Jorong', npsn: '', kepsek: '', code: '1001' },
  { id: 's2', name: 'SMPN 1 Kintap', npsn: '', kepsek: '', code: '1002' },
  { id: 's3', name: 'SMPN 3 Panyipatan', npsn: '', kepsek: '', code: '1003' },
  { id: 's4', name: 'SMPN 1 Tambang Ulang', npsn: '', kepsek: '', code: '1004' },
  { id: 's5', name: 'SMPN 4 Bajuin', npsn: '', kepsek: '', code: '1005' },
  { id: 's6', name: 'SMPN 4 Pelaihari', npsn: '', kepsek: '', code: '1006' },
  { id: 's7', name: 'SMPN 5 Pelaihari', npsn: '', kepsek: '', code: '1007' },
  { id: 's8', name: 'SMPS IT Sirajul Huda', npsn: '', kepsek: '', code: '1008' },
  { id: 's9', name: 'SMPS Muhammadiyah', npsn: '', kepsek: '', code: '1009' },
  { id: 's10', name: 'SMP Tahfizh Bilingual Daarul Qur\u2019an Istiqomah', npsn: '', kepsek: '', code: '1010' },
];

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const body = parseBody(req);
    const ok = checkAdminCode(body.adminCode);
    const usingDefault = normalize(ADMIN_CODE) === 'akreditasi2026';
    return res.status(ok ? 200 : 403).json({
      ok,
      usingDefault,
      providedLength: normalize(body.adminCode).length,
      expectedLength: normalize(ADMIN_CODE).length,
    });
  }

  let redis;
  try {
    redis = getRedis();
  } catch (e) {
    return res.status(500).json({ error: e.message, code: e.code || 'REDIS_NOT_CONFIGURED' });
  }

  if (req.method === 'GET') {
    let list;
    try {
      list = await redis.get('schools:list');
    } catch (e) {
      return res.status(500).json({ error: 'Gagal membaca database Redis.', code: 'REDIS_NOT_CONFIGURED' });
    }
    if (!list || !Array.isArray(list) || list.length === 0) {
      list = SCHOOL_SEED;
      await redis.set('schools:list', list);
    }
    return res.status(200).json(list);
  }

  if (req.method === 'PUT') {
    const body = parseBody(req);
    const { id, patch, newSchool } = body;
    let auth;
    try { auth = await authorize(redis, credsFrom(req, body)); } catch (e) {
      return res.status(500).json({ error: 'Gagal membaca database Redis.', code: 'REDIS_NOT_CONFIGURED' });
    }
    if (!auth) return res.status(403).json({ error: 'Kode akses tidak valid.' });

    let list;
    try {
      list = await redis.get('schools:list');
    } catch (e) {
      return res.status(500).json({ error: 'Gagal membaca database Redis.', code: 'REDIS_NOT_CONFIGURED' });
    }
    if (!list) list = SCHOOL_SEED;

    if (newSchool) {
      if (!newSchool.name || !newSchool.name.trim()) return res.status(400).json({ error: 'Nama sekolah wajib diisi.' });
      if (!newSchool.code || !newSchool.code.trim()) return res.status(400).json({ error: 'Kode akses wajib diisi.' });
      if (list.some((s) => s.code === newSchool.code)) return res.status(409).json({ error: 'Kode akses ini sudah dipakai sekolah lain.' });
      // Pengawas yang menambah sekolah otomatis menjadi pembinanya; koordinator boleh memilih.
      const pengawasId = auth.role === 'pengawas' ? auth.pengawas.id : (newSchool.pengawasId || null);
      const created = {
        id: 's' + Date.now(),
        name: newSchool.name.trim(),
        npsn: (newSchool.npsn || '').trim(),
        kepsek: (newSchool.kepsek || '').trim(),
        code: newSchool.code.trim(),
        pengawasId,
      };
      list.push(created);
      await redis.set('schools:list', list);
      return res.status(200).json({ school: created, list });
    }

    if (!id || !patch) return res.status(400).json({ error: 'id dan patch wajib diisi' });
    const idx = list.findIndex((s) => s.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Sekolah tidak ditemukan' });
    if (!canManageSchool(auth, list[idx])) return res.status(403).json({ error: 'Sekolah ini bukan sekolah binaan Anda.' });
    const safe = { ...patch };
    delete safe.id;
    // Hanya koordinator yang boleh memindahkan sekolah antarpengawas
    if (auth.role !== 'koordinator') delete safe.pengawasId;
    if (safe.code !== undefined) {
      const c = normalize(safe.code);
      if (!c) return res.status(400).json({ error: 'Kode akses wajib diisi.' });
      if (list.some((s) => s.id !== id && s.code === c)) return res.status(409).json({ error: 'Kode akses ini sudah dipakai sekolah lain.' });
      safe.code = c;
    }
    list[idx] = { ...list[idx], ...safe };
    await redis.set('schools:list', list);
    return res.status(200).json(list[idx]);
  }

  if (req.method === 'DELETE') {
    const body = parseBody(req);
    const id = (req.query && req.query.id) || body.id;
    let auth;
    try { auth = await authorize(redis, credsFrom(req, body)); } catch (e) {
      return res.status(500).json({ error: 'Gagal membaca database Redis.', code: 'REDIS_NOT_CONFIGURED' });
    }
    if (!auth) return res.status(403).json({ error: 'Kode akses tidak valid.' });
    if (!id) return res.status(400).json({ error: 'id wajib diisi' });

    let list;
    try {
      list = await redis.get('schools:list');
    } catch (e) {
      return res.status(500).json({ error: 'Gagal membaca database Redis.', code: 'REDIS_NOT_CONFIGURED' });
    }
    if (!list) list = SCHOOL_SEED;
    if (list.length <= 1) return res.status(400).json({ error: 'Tidak bisa menghapus — minimal harus ada 1 sekolah binaan tersisa.' });

    const idx = list.findIndex((s) => s.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Sekolah tidak ditemukan' });
    if (!canManageSchool(auth, list[idx])) return res.status(403).json({ error: 'Sekolah ini bukan sekolah binaan Anda.' });
    const removed = list.splice(idx, 1)[0];
    await redis.set('schools:list', list);

    try {
      await redis.del('evidence:' + id);
    } catch (e) { /* diabaikan — penghapusan sekolah tetap berhasil */ }

    return res.status(200).json({ removed, list });
  }

  return res.status(405).json({ error: 'Metode tidak didukung' });
}
