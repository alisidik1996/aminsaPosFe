# POS Cafe — Frontend

Vanilla JS + HTML + CSS. Deploy ke Vercel sebagai static site.

## Setup Lokal

Buka dengan Live Server VS Code, atau langsung buka `index.html`.

Backend harus jalan di `http://localhost:3001`.

## Deploy ke Vercel

1. Push ke GitHub: `https://github.com/alisidik1996/aminsaPosFe`
2. Import repo di [vercel.com](https://vercel.com)
3. Framework Preset: **Other** (static)
4. Output Directory: `.` (root)
5. Deploy

## Konfigurasi Backend URL

Edit `js/api.js` — ganti URL production dengan URL backend Vercel kamu:

```js
return 'https://aminsa-pos-be.vercel.app/api'; // ← sudah benar
```
