import { getRedis, parseBody, normalize, checkAdminCode, credsFrom, authorize, ADMIN_CODE } from './_lib.js';

// Akun pengawas disimpan di Redis pada kunci "pengawas:list":
//   [{ id, name, nip, code }]
// GET publik hanya mengembalikan id dan nama (untuk pilihan di layar masuk).
// Koordinator (ADMIN_CODE) yang mengelola akun: tambah, ubah, hapus.

export default async function handler(req, res) {
  let redis;
  try {
    redis = getRedis();
  } catch (e) {
    return res.status(500).json({ error: e.message, code: e.code || 'REDIS_NOT_CONFIGURED' });
  }

  const readList = async () => {
    const l = await redis.get('pengawas:list');
    return Array.isArray(l) ? l : [];
  };

  try {
    if (req.method === 'GET') {
      const list = await readList();
      const auth = await authorize(redis, credsFrom(req, {}));
      if (auth && auth.role === 'koordinator') return res.status(200).json(list);
      return res.status(200).json(list.map((p) => ({ id: p.id, name: p.name })));
    }

    if (req.method === 'POST') {
      // Masuk sebagai pengawas
      const body = parseBody(req);
      const list = await readList();
      const p = list.find((x) => x.id === body.pengawasId);
      const ok = !!(p && normalize(p.code) && normalize(p.code) === normalize(body.code));
      return res.status(ok ? 200 : 403).json(ok ? { ok: true, pengawas: { id: p.id, name: p.name } } : { ok: false });
    }

    if (req.method === 'PUT') {
      const body = parseBody(req);
      if (!checkAdminCode(body.adminCode)) return res.status(403).json({ error: 'Hanya koordinator (ADMIN_CODE) yang dapat mengelola akun pengawas.' });
      const list = await readList();

      const codeTaken = (code, exceptId) =>
        normalize(code) === normalize(ADMIN_CODE) || list.some((p) => p.id !== exceptId && normalize(p.code) === normalize(code));

      if (body.newPengawas) {
        const n = body.newPengawas;
        if (!normalize(n.name)) return res.status(400).json({ error: 'Nama pengawas wajib diisi.' });
        if (!normalize(n.code)) return res.status(400).json({ error: 'Kode akses wajib diisi.' });
        if (codeTaken(n.code, null)) return res.status(409).json({ error: 'Kode akses ini sudah dipakai. Gunakan kode lain.' });
        const created = { id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: normalize(n.name), nip: normalize(n.nip), code: normalize(n.code) };
        list.push(created);
        await redis.set('pengawas:list', list);
        return res.status(200).json({ pengawas: created, list });
      }

      const { id, patch } = body;
      if (!id || !patch) return res.status(400).json({ error: 'id dan patch wajib diisi' });
      const idx = list.findIndex((p) => p.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Pengawas tidak ditemukan' });
      const next = { ...list[idx] };
      if (patch.name !== undefined) {
        if (!normalize(patch.name)) return res.status(400).json({ error: 'Nama pengawas tidak boleh kosong.' });
        next.name = normalize(patch.name);
      }
      if (patch.nip !== undefined) next.nip = normalize(patch.nip);
      if (patch.code !== undefined) {
        if (!normalize(patch.code)) return res.status(400).json({ error: 'Kode akses tidak boleh kosong.' });
        if (codeTaken(patch.code, id)) return res.status(409).json({ error: 'Kode akses ini sudah dipakai. Gunakan kode lain.' });
        next.code = normalize(patch.code);
      }
      list[idx] = next;
      await redis.set('pengawas:list', list);
      return res.status(200).json(next);
    }

    if (req.method === 'DELETE') {
      const body = parseBody(req);
      const creds = credsFrom(req, body);
      if (!checkAdminCode(creds.adminCode)) return res.status(403).json({ error: 'Hanya koordinator (ADMIN_CODE) yang dapat menghapus akun pengawas.' });
      const id = (req.query && req.query.id) || body.id;
      if (!id) return res.status(400).json({ error: 'id wajib diisi' });
      const list = await readList();
      const idx = list.findIndex((p) => p.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Pengawas tidak ditemukan' });
      const removed = list.splice(idx, 1)[0];
      await redis.set('pengawas:list', list);
      // Sekolah yang dibina pengawas ini menjadi "belum ditetapkan"
      let schools = await redis.get('schools:list');
      if (Array.isArray(schools)) {
        schools = schools.map((s) => (s.pengawasId === id ? { ...s, pengawasId: null } : s));
        await redis.set('schools:list', schools);
      }
      return res.status(200).json({ removed, list, schools: Array.isArray(schools) ? schools : undefined });
    }

    return res.status(405).json({ error: 'Metode tidak didukung' });
  } catch (e) {
    return res.status(500).json({ error: 'Gagal mengakses database Redis.', code: 'REDIS_NOT_CONFIGURED' });
  }
}
