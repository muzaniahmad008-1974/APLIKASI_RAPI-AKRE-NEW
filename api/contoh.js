import { getRedis, parseBody, normalize, checkAdminCode, credsFrom } from './_lib.js';

// Contoh dokumen / file data dukung (tautan Google Drive) yang dikelola koordinator.
// Disimpan di Redis pada kunci "contoh:list":
//   [{ id, judul, url, bagian: 'semua'|'kp'|'kk'|'il', kode: '' | '1.1.1', keterangan }]
// kode kosong = contoh umum untuk bagian itu; kode terisi = contoh untuk satu indikator.
// GET publik (dibaca guru dan kepala sekolah). Ubah/hapus hanya dengan ADMIN_CODE.

const BAGIAN = ['semua', 'kp', 'kk', 'il'];

function validate(input, partial) {
  const out = {};
  if (!partial || input.judul !== undefined) {
    const judul = normalize(input.judul);
    if (!judul) return { error: 'Judul contoh dokumen wajib diisi.' };
    if (judul.length > 150) return { error: 'Judul maksimal 150 karakter.' };
    out.judul = judul;
  }
  if (!partial || input.url !== undefined) {
    const raw = normalize(input.url);
    let u;
    try { u = new URL(raw); } catch (e) { return { error: 'Tautan tidak valid. Tempel tautan lengkap yang diawali https://' }; }
    if (u.protocol !== 'https:') return { error: 'Tautan harus diawali https://' };
    out.url = u.toString();
  }
  if (!partial || input.bagian !== undefined) {
    if (!BAGIAN.includes(input.bagian)) return { error: 'Bagian tidak valid.' };
    out.bagian = input.bagian;
  }
  if (!partial || input.kode !== undefined) {
    const kode = normalize(input.kode);
    if (kode.length > 20) return { error: 'Kode indikator tidak valid.' };
    out.kode = kode;
  }
  if (!partial || input.keterangan !== undefined) {
    const k = normalize(input.keterangan);
    if (k.length > 300) return { error: 'Keterangan maksimal 300 karakter.' };
    out.keterangan = k;
  }
  return { value: out };
}

export default async function handler(req, res) {
  let redis;
  try {
    redis = getRedis();
  } catch (e) {
    return res.status(500).json({ error: e.message, code: e.code || 'REDIS_NOT_CONFIGURED' });
  }

  try {
    const readList = async () => {
      const l = await redis.get('contoh:list');
      return Array.isArray(l) ? l : [];
    };

    if (req.method === 'GET') return res.status(200).json(await readList());

    const body = parseBody(req);
    if (req.method === 'PUT') {
      if (!checkAdminCode(credsFrom(req, body).adminCode)) {
        return res.status(403).json({ error: 'Hanya koordinator (ADMIN_CODE) yang dapat mengelola contoh dokumen.' });
      }
      const list = await readList();
      if (body.newContoh) {
        const v = validate(body.newContoh, false);
        if (v.error) return res.status(400).json({ error: v.error });
        const created = { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...v.value };
        list.push(created);
        await redis.set('contoh:list', list);
        return res.status(200).json({ contoh: created, list });
      }
      const { id, patch } = body;
      if (!id || !patch) return res.status(400).json({ error: 'id dan patch wajib diisi' });
      const idx = list.findIndex((c) => c.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Contoh dokumen tidak ditemukan' });
      const v = validate(patch, true);
      if (v.error) return res.status(400).json({ error: v.error });
      list[idx] = { ...list[idx], ...v.value };
      await redis.set('contoh:list', list);
      return res.status(200).json({ contoh: list[idx], list });
    }

    if (req.method === 'DELETE') {
      if (!checkAdminCode(credsFrom(req, body).adminCode)) {
        return res.status(403).json({ error: 'Hanya koordinator (ADMIN_CODE) yang dapat menghapus contoh dokumen.' });
      }
      const id = (req.query && req.query.id) || body.id;
      if (!id) return res.status(400).json({ error: 'id wajib diisi' });
      const list = await readList();
      const idx = list.findIndex((c) => c.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Contoh dokumen tidak ditemukan' });
      const removed = list.splice(idx, 1)[0];
      await redis.set('contoh:list', list);
      return res.status(200).json({ removed, list });
    }

    return res.status(405).json({ error: 'Metode tidak didukung' });
  } catch (e) {
    return res.status(500).json({ error: 'Gagal mengakses database Redis.', code: 'REDIS_NOT_CONFIGURED' });
  }
}
