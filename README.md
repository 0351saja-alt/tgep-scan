# TGEP Scan Drill Log

Aplikasi web (PWA) PT Terra Grapindo Eco Prima untuk:
- memotret formulir lapangan F-BOR → dibaca otomatis, divalidasi, disetujui verifier → database;
- memotret foto core (UTUH/BELAH) → cek standar SOP & kelengkapan per conto;
- memeriksa dan mengoreksi data dengan riwayat koreksi.

Alamat: https://0351saja-alt.github.io/tgep-scan/

Data tersimpan di server Supabase dan hanya bisa dibuka akun yang didaftarkan admin.
`config.js` hanya memuat kunci *publishable* (memang dirancang publik); tidak ada kunci rahasia di repo ini.
