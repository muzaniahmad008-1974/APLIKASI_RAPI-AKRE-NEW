# RAPI-AKRE (Bukti Dukung Akreditasi SMP) - Versi Vercel

Aplikasi web database bukti dukung akreditasi untuk Pengawas Sekolah, Kepala Sekolah, dan
Guru — mengelola skor mandiri, bukti tersedia/perlu dilengkapi, dan catatan untuk **59
indikator** (19 Guru + 21 Kepala Sekolah + 19 Iklim Lingkungan Belajar) di seluruh sekolah
binaan (10 sekolah terisi otomatis saat pertama kali dipasang, jumlahnya menyesuaikan sendiri
begitu Pengawas menambah atau menghapus sekolah).

Versi ini fungsinya **identik** dengan versi Netlify yang sudah ada — fitur, tampilan, dan
data indikatornya sama persis — hanya cara deploy dan penyimpanan datanya yang disesuaikan
untuk platform Vercel.

## Perbedaan dari Versi Netlify

| | Netlify | Vercel |
|---|---|---|
| Fungsi backend | `netlify/functions/*.cjs` | `api/*.js` (format berbeda, tapi endpoint & perilakunya sama) |
| Database | Netlify Blobs | **Upstash Redis** (lewat Vercel Marketplace) |
| Konfigurasi | `netlify.toml` | `vercel.json` |

Frontend (`src/App.jsx`, tampilan, semua fitur) **sama persis** dengan versi Netlify.

## Isi Proyek

```
├── vercel.json                # Konfigurasi build & routing Vercel
├── package.json
├── index.html
├── src/
│   ├── App.jsx                # Aplikasi React utama (identik dengan versi Netlify)
│   ├── main.jsx
│   ├── index.css
│   └── data/indicators.json   # Data 59 indikator (boleh disunting bila rubrik berubah)
├── api/
│   ├── schools.js             # API data sekolah (GET/PUT/DELETE, pakai Upstash Redis)
│   ├── pengawas.js            # API akun pengawas (login, tambah/ubah/hapus oleh koordinator)
│   ├── evidence.js            # API bukti dukung per sekolah (GET/PUT/DELETE)
│   └── _lib.js                # Pustaka bersama: koneksi Redis & pemeriksaan hak akses
└── .env.example                # Contoh variabel ADMIN_CODE & kredensial Redis
```

## Cara Deploy ke Vercel (lewat GitHub — untuk pengguna non-teknis)

### 1. Unggah proyek ini ke GitHub

1. Buka [github.com/new](https://github.com/new), buat repository baru (mis. `bukti-dukung-akreditasi-vercel`), boleh **Private**.
2. Ekstrak file zip proyek ini di komputer Anda.
3. Di halaman repository GitHub yang baru dibuat, klik **"uploading an existing file"**, lalu
   seret (drag & drop) **seluruh isi folder** hasil ekstrak ke halaman tersebut (bukan folder
   itu sendiri — pastikan `package.json` langsung terlihat di akar repo, bukan di dalam
   subfolder), lalu klik **Commit changes**.

### 2. Hubungkan repository ke Vercel

1. Buka [vercel.com](https://vercel.com) → login/daftar (bisa pakai akun GitHub langsung).
2. Klik **Add New... → Project**.
3. Pilih **Import Git Repository**, cari repository yang baru Anda buat, klik **Import**.
4. Vercel otomatis mendeteksi ini proyek Vite — biarkan pengaturan **Build Command**
   (`npm run build`) dan **Output Directory** (`dist`) apa adanya (sudah sesuai `vercel.json`).
5. **Jangan klik Deploy dulu** — lanjut ke langkah 3 di bawah untuk memasang database, supaya
   tidak perlu deploy ulang.

### 3. Pasang Database (Upstash Redis lewat Vercel Marketplace)

> Vercel tidak lagi punya "Vercel KV" bawaan (dipensiunkan akhir 2024). Cara resmi sekarang
> adalah memasang integrasi Redis dari Upstash lewat Marketplace Vercel — gratis untuk
> pemakaian skala kecil seperti aplikasi ini.

1. Di halaman proyek Vercel Anda (sebelum atau sesudah deploy pertama, sama saja): buka tab
   **Storage** → **Create Database** → pilih **Upstash** → pilih produk **Redis**.
2. Ikuti langkah pembuatan database (pilih nama & region terdekat, mis. Singapore).
3. Setelah database dibuat, klik **Connect Project** dan pilih proyek `bukti-dukung-akreditasi-vercel`
   Anda. Vercel otomatis menambahkan environment variable `KV_REST_API_URL` dan
   `KV_REST_API_TOKEN` ke proyek — **tidak perlu isi manual**.

### 4. Atur Kode Akses Pengawas (WAJIB dilakukan)

Secara default, kode akses "Mode Pengawas" adalah `akreditasi2026` — ini **harus diganti**:

1. Di halaman proyek Vercel: **Settings → Environment Variables → Add New**.
2. Isi:
   - Key: `ADMIN_CODE`
   - Value: (buat kode rahasia sendiri, mis. `TanahLaut2026Aman!`)
   - Environments: centang **Production**, **Preview**, dan **Development** (supaya berlaku
     di semua kondisi).
3. Klik **Save**.

### 5. Deploy

1. Kembali ke tab **Deployments**, klik **Deploy** (jika ini deploy pertama), atau buka tab
   **Deployments** → klik titik tiga (⋯) pada deployment terakhir → **Redeploy** (jika Anda
   menambah environment variable setelah deploy pertama — **environment variable baru
   TIDAK berlaku tanpa redeploy**, sama seperti platform hosting lain).
2. Tunggu status berubah menjadi **Ready**.

### 6. Selesai — bagikan tautannya

Tautan situs Anda muncul di bagian atas dashboard proyek (format
`https://nama-proyek.vercel.app`, bisa diganti lewat **Settings → Domains**).

Bagikan tautan ini ke seluruh sekolah binaan, beserta **kode akses sekolah masing-masing** (lihat
tabel kode default di bagian "Cara Pakai Aplikasi" di bawah). Kode akses Pengawas (`ADMIN_CODE`)
cukup Anda dan pihak yang Anda percaya yang tahu.

## Cara Pakai Aplikasi

- **Guru / Kepala Sekolah**: buka tautan → layar awal akan menanyakan **"Masuk sebagai"** →
  pilih **Guru Mata Pelajaran** atau **Kepala Sekolah** → pilih nama sekolah dari daftar →
  masukkan **Kode Akses Sekolah**. Setelah masuk, mereka **hanya bisa membuka sekolahnya
  sendiri**. Guru otomatis hanya melihat **Bagian I**; Kepala Sekolah otomatis hanya melihat
  **Bagian II & III**. Setiap indikator punya panduan rubrik skor 1-4 (klik "Lihat panduan
  skor & sumber bukti"). Tombol **Unduh Laporan Rekap Sekolah Ini** mengunduh laporan sekolah
  sendiri dalam format **Word (.docx)**, **PDF (.pdf)**, atau **HTML** — ketiganya berkas asli
  yang langsung jadi. Tombol **Keluar** untuk berganti pengguna pada perangkat bersama.
- **Pengawas**: pada layar "Masuk sebagai", pilih **Pengawas**, pilih **nama Anda**, lalu
  masukkan **kode akses pribadi** dari koordinator. Pengawas hanya melihat dan mengelola
  **sekolah binaannya sendiri**. Menu yang tersedia: **Dashboard Binaan** (rekap sekolah
  binaan, tombol **+ Tambah Sekolah**), **Prioritas Pendampingan**, **Pilih Sekolah**, dan
  **Rekap Antarsekolah** (hanya sekolah binaan). Pengawas dapat menyunting NPSN, nama Kepala
  Sekolah, dan kode akses sekolah binaannya, mereset data, menghapus sekolah binaannya, dan
  mengunduh laporan. Sekolah yang ditambahkan pengawas otomatis menjadi binaannya. Tombol
  **Mode Pengawas** mengunci sementara akses ubah/reset/hapus; **Keluar** kembali ke layar
  pilih peran.
- **Koordinator (Pengawas Pembina)**: pada pilihan nama, pilih **Koordinator**, lalu masukkan
  `ADMIN_CODE`. Koordinator melihat semua sekolah (dengan filter per pengawas) dan memiliki
  menu **Kelola Pengawas**: membuat akun pengawas (nama, NIP opsional, kode akses), mengubah
  atau menghapus akun, serta menetapkan sekolah binaan tiap pengawas. Menghapus akun pengawas
  tidak menghapus sekolahnya; sekolah itu berstatus "belum ditetapkan".

### Dashboard Binaan dan Prioritas Pendampingan

**Dashboard Binaan** menampilkan skor rata-rata, kelengkapan bukti rata-rata, jumlah sekolah
berprioritas tinggi, jumlah sekolah yang belum mulai, rata-rata skor per bagian, tiga sekolah
yang perlu didampingi lebih dulu, dan kartu tiap sekolah.

**Prioritas Pendampingan** mengurutkan sekolah dari yang paling perlu didampingi. Urgensi
(0-100) dihitung dari data bukti dukung:

| Komponen | Bobot | Dasar |
|---|---|---|
| Kekurangan skor | 45% | selisih skor total terhadap skor maksimal 236 |
| Indikator belum diisi | 25% | porsi indikator berskor 0 dari 59 |
| Kekurangan bukti | 30% | porsi pilihan bukti pada dropdown yang belum dicentang (bila dropdown tidak dipakai, indikator dianggap lengkap jika kolom bukti tersedia atau lokasi berisi) |

Prioritas Tinggi bila urgensi 55 atau lebih, Sedang 35 sampai 54, Rendah di bawah 35. Tiap
sekolah juga menampilkan alasan (mis. jumlah indikator belum diisi atau berskor tanpa bukti),
bagian dengan skor terendah, dan tiga indikator yang sebaiknya didampingi lebih dulu. Bobot dan
ambang dapat diubah pada fungsi `computePriority` dan `PRIO_LEVEL` di `src/App.jsx`.

### Pilihan Bukti pada Setiap Indikator

Kolom **Bukti yang Sudah Tersedia** punya dropdown centang. Pilihannya dibentuk dari panduan
indikator itu sendiri: telaah dokumen, wawancara, observasi, dan tindakan yang perlu dilakukan.
Centang bukti yang sudah dimiliki sekolah. Kolom **Bukti yang Perlu Dilengkapi** terisi otomatis
dengan pilihan yang **belum dicentang**, dan ikut berubah saat centang diubah. Tersedia juga isian
teks bebas pada kedua kolom untuk bukti di luar daftar. Hasilnya ikut tercetak pada laporan Word,
PDF, dan HTML. Indikator yang dropdown-nya belum dipakai tidak menampilkan daftar otomatis, supaya
data lama tidak salah terbaca sebagai bukti yang kurang.

### Kode Akses Sekolah (default)

| Sekolah | Kode Default |
|---|---|
| SMPN 1 Jorong | 1001 |
| SMPN 1 Kintap | 1002 |
| SMPN 3 Panyipatan | 1003 |
| SMPN 1 Tambang Ulang | 1004 |
| SMPN 4 Bajuin | 1005 |
| SMPN 4 Pelaihari | 1006 |
| SMPN 5 Pelaihari | 1007 |
| SMPS IT Sirajul Huda | 1008 |
| SMPS Muhammadiyah | 1009 |
| SMP Tahfizh Bilingual Daarul Qur'an Istiqomah | 1010 |

Sangat disarankan menggantinya (lewat Mode Pengawas → buka sekolah tsb. → field "Kode Akses
Sekolah") sebelum dibagikan secara luas. Daftar 10 sekolah di atas hanya nilai **awal**
(seed pertama kali) — begitu Pengawas menambah atau menghapus sekolah lewat tombol "+ Tambah
Sekolah" / "Hapus Sekolah Ini" di aplikasi, jumlah dan daftarnya otomatis menyesuaikan di
seluruh bagian aplikasi (Beranda, Rekap Antarsekolah, layar "Masuk sebagai") tanpa perlu
mengubah kode apa pun.

## Menjalankan di Komputer Sendiri (opsional, untuk pengembangan)

Perlu [Node.js](https://nodejs.org) versi 18 ke atas dan [Vercel CLI](https://vercel.com/docs/cli):

```bash
npm install
npm install -g vercel
vercel link        # hubungkan folder ini ke proyek Vercel Anda
vercel env pull    # unduh environment variable (termasuk KV_REST_API_URL/TOKEN) ke .env.local
vercel dev         # jalankan frontend + /api sekaligus secara lokal
```

`vercel dev` menjalankan frontend dan fungsi `/api` bersamaan di satu alamat lokal (biasanya
`http://localhost:3000`), termasuk kredensial Redis dari `.env.local` — jadi bisa diuji
end-to-end tanpa memengaruhi data yang sudah live. Menjalankan `npm run dev` (Vite biasa) saja
TIDAK akan membuat `/api` berfungsi.

## Mengubah Data Indikator

Bila rubrik akreditasi diperbarui, sunting `src/data/indicators.json` (struktur: `kp` = Guru,
`kk` = Kepala Sekolah, `il` = Iklim Lingkungan). Setelah disunting, commit & push ke GitHub —
Vercel otomatis mem-build ulang dan men-deploy versi terbaru.

## Troubleshooting

| Gejala | Kemungkinan Penyebab & Solusi |
|---|---|
| Halaman blank/error setelah deploy | Buka tab **Deployments** di Vercel, klik deployment terakhir, lihat **Build Logs** untuk pesan error. |
| Muncul pita merah "Database Redis (Upstash) belum terkonfigurasi", atau error `REDIS_NOT_CONFIGURED` | Database belum dipasang atau belum dihubungkan ke proyek ini. Ulangi langkah 3 ("Pasang Database") di atas — pastikan mengklik **Connect Project** dan memilih proyek yang benar, lalu **Redeploy**. |
| "Gagal memuat data dari server" saat buka aplikasi | Cek tab **Functions** di dashboard Vercel (atau **Deployments → [deployment] → Functions**) — pastikan `api/schools` dan `api/evidence` terdaftar dan tidak error. Coba buka langsung `https://situs-anda.vercel.app/api/schools`; harus muncul JSON berisi daftar sekolah (10 sekolah bila baru pertama kali dipasang dan belum diubah). |
| Kode Pengawas tidak diterima padahal sudah benar | Verifikasi kode admin **tidak bergantung pada Redis** di versi ini, jadi kemungkinan besar murni soal kodenya. Lihat pesan error di layar login: (a) "kode bawaan" → env var `ADMIN_CODE` belum ter-set atau belum di-redeploy; (b) "Panjang kode... karakter" → ada spasi/karakter tersembunyi, aplikasi otomatis membersihkan spasi di awal/akhir tapi tidak karakter aneh di tengah (mis. kutip pintar dari salin-tempel Word) — ketik ulang manual di Vercel Environment Variables. |
| Environment variable baru tidak berpengaruh | Sama seperti semua platform hosting: environment variable yang baru ditambah/diubah **tidak pernah berlaku otomatis** — wajib **Redeploy** (Deployments → titik tiga pada deployment terakhir → Redeploy) setelah mengubahnya. |
| Data hilang/reset tanpa sengaja | Fitur reset & hapus sekolah hanya bisa diakses lewat Mode Pengawas + konfirmasi modal; pastikan kode akses hanya dipegang orang yang berwenang. |

## Keamanan & Batasan yang Perlu Diketahui

- **Kode Akses Sekolah bukan login sungguhan** — gerbang ringan mirip PIN, bukan autentikasi
  terenkripsi. Cukup untuk mencegah kesalahan/keisengan biasa, bukan keamanan tingkat enterprise.
- `ADMIN_CODE` (koordinator) dan kode pribadi pengawas diverifikasi di server (Vercel Function).
  Hak ubah/hapus sekolah dan reset bukti dibatasi di server menurut sekolah binaan masing-masing.
  Namun daftar sekolah (termasuk kode akses sekolah) dan data bukti dukung dapat dibaca lewat
  API tanpa login, dan pembatasan tampilan per pengawas dilakukan di aplikasi. Jadi pemisahan
  data antarpengawas bersifat pengelolaan, bukan kerahasiaan. Kode pengawas disimpan apa adanya
  di Redis dan tidak dibatasi percobaan masuk.
- Data tersimpan permanen di database Upstash Redis selama integrasinya aktif. Untuk cadangan
  tambahan, Pengawas dapat sesekali mengunduh Laporan Rekap tiap sekolah atau menyalin isi
  Rekap Antarsekolah secara manual.
- Bila ke depan dibutuhkan login sungguhan per sekolah (akun & kata sandi terenkripsi per
  pengguna), itu memerlukan penambahan sistem autentikasi terpisah (mis. Clerk, Auth.js, atau
  Supabase Auth) — beri tahu saya bila ingin dikembangkan ke arah itu.
