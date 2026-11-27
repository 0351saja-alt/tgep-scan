// pdf.ts — PDF dokumen final (DDR bertanda tangan & form kirim sample) untuk diunggah ke Google Drive.
// Dibuat di server (pdf-lib, font standar Helvetica/Times) — tata letak mengikuti cetakan di aplikasi.
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const A4: [number, number] = [595.28, 841.89];
const HIJAU = rgb(0.9, 0.94, 0.91), ABU = rgb(0.55, 0.55, 0.55), HITAM = rgb(0.07, 0.07, 0.07);
const HOUR_CAT: [string, string[]][] = [["DRILLING SYSTEM", ["CORING DRILLING", "OPEN HOLE DRILLING"]],
  ["WORKING", ["RIG SET UP/DOWN/PREPARATION", "HOLE CONDITION/CEMENTING", "REAMING, CASING, INSTALLING", "RUNNING/PULL UP/STUCK ROD", "HANDLING HOLE"]],
  ["ACTIVE/STANDBY", ["TRAVELLING CREW", "P2H+P5M", "DRILL SITE PREPARATION", "WEATHER/UNSAVE CONDITION", "WAITING WATER", "WAITING ACCESS", "SERVICE/MAINTENANCE", "GEOSERVICES/LOGGING"]],
  ["ISTIRAHAT", ["ISTIRAHAT SIANG"]]];

// font standar hanya WinAnsi: ganti karakter lain
export function aman(s: unknown): string {
  return String(s ?? "").replace(/[→⇒]/g, "->").replace(/[←]/g, "<-").replace(/[≤]/g, "<=").replace(/[≥]/g, ">=")
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, "...").replace(/[\r\t]/g, " ")
    .replace(/[^\n\x20-\x7e -ÿ–—•€]/g, "");
}
const f2 = (x: any) => (x == null || x === "" || !Number.isFinite(Number(x)) ? "" : Number(x).toFixed(2));
const dk = (x: any) => (x == null || x === "" || !Number.isFinite(Number(x)) ? "" : String(Number(x)).replace(".", ","));
const jamWIB = (t: any) => { if (!t) return "-"; const d = new Date(t); return d.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
const menit = (a: string, b: string) => { const p = (s: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s ?? "").trim()); return m ? +m[1] * 60 + +m[2] : null; };
  const x = p(a), y = p(b); if (x == null || y == null) return 0; return y >= x ? y - x : y + 1440 - x; };

type Kol = { w: number; al?: "r" | "c" };
class Kertas {
  doc: any; f: any; fb: any; fi: any; pg: any; y = 0; m = 36; atasan = 0; bawah = 36; onPage?: (k: Kertas) => void;
  constructor(doc: any, f: any, fb: any, fi: any) { this.doc = doc; this.f = f; this.fb = fb; this.fi = fi; }
  get lebar() { return A4[0] - 2 * this.m; }
  baru() { this.pg = this.doc.addPage(A4); this.y = A4[1] - this.atasan; this.onPage?.(this); }
  cukup(h: number) { if (this.y - h < this.bawah) this.baru(); }
  bungkus(t: string, font: any, sz: number, w: number): string[] {
    const out: string[] = [];
    for (const para of aman(t).split("\n")) {
      const kata = para.split(/\s+/); let line = "";
      for (const k of kata) {
        const c = line ? line + " " + k : k;
        if (font.widthOfTextAtSize(c, sz) <= w) { line = c; continue; }
        if (line) out.push(line);
        let s = k; while (font.widthOfTextAtSize(s, sz) > w && s.length > 1) { let n = s.length; while (n > 1 && font.widthOfTextAtSize(s.slice(0, n), sz) > w) n--; out.push(s.slice(0, n)); s = s.slice(n); }
        line = s;
      }
      out.push(line);
    }
    return out.length ? out : [""];
  }
  teks(t: string, o: { sz?: number; b?: boolean; i?: boolean; al?: "c" | "l"; warna?: any; jarak?: number } = {}) {
    const sz = o.sz ?? 9, font = o.b ? this.fb : o.i ? this.fi : this.f;
    for (const ln of this.bungkus(t, font, sz, this.lebar)) {
      this.cukup(sz + 3);
      const w = font.widthOfTextAtSize(ln, sz), x = o.al === "c" ? (A4[0] - w) / 2 : this.m;
      this.pg.drawText(ln, { x, y: this.y - sz, size: sz, font, color: o.warna ?? HITAM }); this.y -= sz + 3;
    }
    this.y -= o.jarak ?? 0;
  }
  // baris tabel: sel = teks; kepala = latar hijau & tebal
  baris(sel: string[], kol: Kol[], o: { kepala?: boolean; sz?: number; tebal?: boolean[] } = {}) {
    const sz = o.sz ?? 8, pad = 3, tot = kol.reduce((s, k) => s + k.w, 0), sk = this.lebar / tot;
    const isi = sel.map((t, i) => this.bungkus(t, o.kepala || o.tebal?.[i] ? this.fb : this.f, sz, kol[i].w * sk - 2 * pad));
    const h = Math.max(...isi.map((l) => l.length)) * (sz + 2) + 2 * pad;
    this.cukup(h);
    let x = this.m;
    isi.forEach((ls, i) => {
      const w = kol[i].w * sk, font = o.kepala || o.tebal?.[i] ? this.fb : this.f;
      this.pg.drawRectangle({ x, y: this.y - h, width: w, height: h, borderColor: ABU, borderWidth: 0.5, color: o.kepala ? HIJAU : undefined });
      ls.forEach((ln, j) => { const lw = font.widthOfTextAtSize(ln, sz);
        const tx = kol[i].al === "r" ? x + w - pad - lw : kol[i].al === "c" ? x + (w - lw) / 2 : x + pad;
        this.pg.drawText(ln, { x: tx, y: this.y - pad - sz - j * (sz + 2) + 1, size: sz, font, color: HITAM }); });
      x += w;
    });
    this.y -= h;
  }
}

async function siapkan(judul: string, serif = false) {
  const doc = await PDFDocument.create();
  doc.setTitle(aman(judul)); doc.setAuthor("PT TERRA GRAPINDO ECO PRIMA - X-Terra"); doc.setCreator("X-Terra drive-sync");
  const [f, fb, fi] = await Promise.all(serif ? [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold, StandardFonts.TimesRomanItalic].map((x) => doc.embedFont(x))
    : [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique].map((x) => doc.embedFont(x)));
  return { doc, k: new Kertas(doc, f, fb, fi) };
}
async function gambar(doc: any, b?: Uint8Array | null) {
  if (!b || b.length < 8) return null;
  try { return b[0] === 0x89 ? await doc.embedPng(b) : await doc.embedJpg(b); } catch { return null; }
}

// ---------------- DDR ----------------
export async function pdfDDR(d: any, sig: any[], ttdBytes: Record<string, Uint8Array | null>, revisi: number) {
  const shift = d.shift === "PAGI" ? "Day" : "Night";
  const { doc, k } = await siapkan(`DDR ${d.rig} ${d.report_date} ${shift}`);
  k.atasan = 36; k.baru();
  const ttdImg: Record<string, any> = {}; for (const s of sig) ttdImg[s.slot] = await gambar(doc, ttdBytes[s.signature_path]);
  k.teks("DAILY DRILLING REPORT", { sz: 15, b: true });
  k.teks(`CLIENT: ${d.contractor ?? ""}  -  status: LENGKAP DITANDATANGANI${revisi > 1 ? `  -  revisi ${revisi}` : ""}`, { sz: 9, jarak: 4 });
  const K6: Kol[] = [{ w: 1 }, { w: 1.6 }, { w: 0.8 }, { w: 1.2 }, { w: 0.9 }, { w: 1.6 }];
  const crew = Array.isArray(d.crew) ? d.crew.map((c: any) => `${c.nama}${c.jabatan ? ` (${c.jabatan})` : ""}`).join(", ") : "";
  const tb = [false, true, false, true, false, true].map((x) => !x);
  k.baris(["PROJECT", d.project ?? "", "DATE", d.report_date ?? "", "DRILLER", d.driller_name ?? ""], K6, { tebal: tb });
  k.baris(["LOCATION", d.location ?? "", "TIME", shift, "ASSISTANT", d.helpers ?? ""], K6, { tebal: tb });
  k.baris(["HOLE ID", `${d.bhid ?? ""}${d.redrill ? ` (REDRILL dari ${d.lubang_asal ?? "-"})` : ""}`, "RIG NO", d.rig ?? "", "CREW", String(d.crew_count ?? "")], K6, { tebal: tb });
  k.baris(["RIG TYPE", d.rig_type ?? "", "HM", `${d.hm_start ?? ""} - ${d.hm_end ?? ""}`, "Cuaca", d.weather ?? ""], K6, { tebal: tb });
  if (d.koord_x && d.koord_y) k.baris(["KOORDINAT", `X ${d.koord_x}  Y ${d.koord_y}${d.koord_z ? `  Z ${d.koord_z}` : ""} (UTM WGS84 51S)${d.koord_sumber ? ` - ${d.koord_sumber}` : ""}`], [{ w: 1 }, { w: 6.1 }], { tebal: [true, false] });
  for (const t of Array.isArray(d.titik_lain) ? d.titik_lain : []) k.baris(["TITIK KE-2", `${t.bhid ?? ""}${t.koord_x ? `  X ${t.koord_x}  Y ${t.koord_y}` : ""}`], [{ w: 1 }, { w: 6.1 }], { tebal: [true, false] });
  if (crew) k.baris(["KRU", crew], [{ w: 1 }, { w: 6.1 }], { tebal: [true, false] });

  k.y -= 8; k.teks("1. DRILLING", { sz: 10, b: true, jarak: 2 });
  const oh = Array.isArray(d.open_hole) ? d.open_hole : [], cor = Array.isArray(d.coring) ? d.coring : [];
  const sumI = (xs: any[]) => xs.reduce((s, x) => s + ((+x.to || 0) - (+x.from || 0)), 0), sumC = cor.reduce((s: number, x: any) => s + (+x.core || 0), 0);
  const KO: Kol[] = [{ w: 1, al: "r" }, { w: 1, al: "r" }, { w: 1, al: "r" }];
  k.teks("OPEN HOLE (m)", { sz: 8, b: true });
  k.baris(["From", "To", "Interval"], KO, { kepala: true });
  for (const x of oh) k.baris([f2(x.from), f2(x.to), f2(x.to - x.from)], KO);
  k.baris(["Total", "", f2(sumI(oh))], KO, { tebal: [true, false, true] });
  k.y -= 4; k.teks("CORING (m) / CORE RESULT", { sz: 8, b: true });
  const KC: Kol[] = [{ w: 1, al: "r" }, { w: 1, al: "r" }, { w: 1, al: "r" }, { w: 1, al: "r" }, { w: 1, al: "r" }, { w: 2.5 }];
  k.baris(["From", "To", "Interval", "Length", "Recovery", "REMARK"], KC, { kepala: true });
  for (const x of cor) { const iv = (+x.to || 0) - (+x.from || 0); k.baris([f2(x.from), f2(x.to), f2(iv), f2(x.core), iv > 0 ? Math.round((100 * (+x.core || 0)) / iv) + "%" : "", x.remark ?? ""], KC); }
  k.baris(["Total", "", f2(sumI(cor)), f2(sumC), sumI(cor) ? Math.round((100 * sumC) / sumI(cor)) + "%" : "", ""], KC, { tebal: [true, false, true, true, true, false] });

  k.y -= 8; k.teks("2. HOURLY DISTRIBUTION", { sz: 10, b: true, jarak: 2 });
  const hrs = Array.isArray(d.hours) ? d.hours : [], KH: Kol[] = [{ w: 1.3 }, { w: 2 }, { w: 1.6 }, { w: 2.4 }, { w: 0.8, al: "r" }];
  k.baris(["Kelompok", "Kegiatan", "TIME", "DESCRIPTION", "TOTAL (jam)"], KH, { kepala: true });
  const dikenal = new Set(HOUR_CAT.flatMap(([, xs]) => xs)); let tot = 0;
  const lain = [...new Set(hrs.map((h: any) => h.kategori).filter((c: string) => !dikenal.has(c)))] as string[];
  for (const [g, xs] of [...HOUR_CAT, ["LAINNYA", lain] as [string, string[]]]) for (const c of xs) {
    const r = hrs.filter((h: any) => h.kategori === c); const m = r.reduce((s: number, h: any) => s + menit(h.mulai, h.selesai), 0); tot += m;
    if (!r.length) continue;
    k.baris([g, c, r.map((h: any) => `${h.mulai}-${h.selesai}`).join(", "), r.map((h: any) => h.ket).filter(Boolean).join("; "), m ? (m / 60).toFixed(2) : ""], KH);
  }
  k.baris(["TOTAL HOURS", "", "", "", (tot / 60).toFixed(2)], KH, { tebal: [true, false, false, false, true] });

  k.y -= 8; k.teks("3. ACCESSORIES AND CONSUMABLES", { sz: 10, b: true, jarak: 2 });
  const cons = (Array.isArray(d.consumables) ? d.consumables : []).filter((c: any) => Number(c.qty) || c.note);
  const KK: Kol[] = [{ w: 1.4 }, { w: 2.2 }, { w: 0.7, al: "r" }, { w: 0.8 }, { w: 2 }];
  k.baris(["Kategori", "Item", "QTY", "UNIT", "Catatan"], KK, { kepala: true });
  for (const c of cons) k.baris([c.kategori ?? "", c.item ?? "", dk(c.qty), c.unit ?? "", c.note ?? ""], KK);
  if (!cons.length) k.baris(["-", "tidak ada pemakaian", "", "", ""], KK);
  k.y -= 6;
  k.baris([d.hole_type ?? "", "ROD", `${d.rod_m ?? ""} m`, "TARGET", `${d.target_m ?? ""} m`, "TOTAL DEPTH", `${d.total_depth_m ?? ""} m`, "TOTAL HOURS", `${(tot / 60).toFixed(2)}`],
    [{ w: 1.6 }, { w: 0.6 }, { w: 0.8 }, { w: 0.8 }, { w: 0.8 }, { w: 1.1 }, { w: 0.8 }, { w: 1.1 }, { w: 0.7 }], { tebal: [true, true, false, true, false, true, false, true, false] });

  k.y -= 8; k.teks("4. COMMENTS", { sz: 10, b: true, jarak: 2 }); k.teks(d.notes || "-", { sz: 9 });

  k.y -= 8; k.cukup(150); k.teks("5. SIGNATURE", { sz: 10, b: true, jarak: 2 });
  const lb = k.lebar / 3, h = 120, y0 = k.y;
  ["DRILLER", "WELLSITE", "CLIENT"].forEach((slot, i) => {
    const x = k.m + i * lb, s = sig.find((z) => z.slot === slot);
    k.pg.drawRectangle({ x, y: y0 - h, width: lb, height: h, borderColor: ABU, borderWidth: 0.5 });
    k.pg.drawText(slot === "WELLSITE" ? "WELL SITE" : slot === "CLIENT" ? "CLIENT REPRESENTATIVE" : "DRILLER", { x: x + 4, y: y0 - 12, size: 8, font: k.fb });
    if (!s) { k.pg.drawText("belum ditandatangani", { x: x + 4, y: y0 - 60, size: 8, font: k.fi, color: ABU }); return; }
    const im = ttdImg[slot];
    if (im) { const sc = Math.min((lb - 10) / im.width, 52 / im.height); k.pg.drawImage(im, { x: x + 4, y: y0 - 18 - im.height * sc, width: im.width * sc, height: im.height * sc }); }
    const ket = `${jamWIB(s.signed_at)} WIB - ${s.method === "CORET" ? (s.ttd_tersimpan ? "TTD tersimpan" : "TTD langsung") : s.method ?? ""}`;
    k.pg.drawText(aman(s.signer_name ?? ""), { x: x + 4, y: y0 - 84, size: 8.5, font: k.fb });
    k.bungkus(ket, k.f, 6.5, lb - 8).slice(0, 3).forEach((ln, j) => k.pg.drawText(ln, { x: x + 4, y: y0 - 96 - j * 8, size: 6.5, font: k.f, color: ABU }));
  });
  k.y = y0 - h - 10;
  k.teks(`Dokumen elektronik database TGEP (X-Terra) - ID ${d.id} - dibuat ${jamWIB(d.created_at)} WIB - PDF dibuat otomatis ${jamWIB(new Date())} WIB. Foto aktivitas hari ini ada di folder yang sama.`, { sz: 6.5, i: true, warna: ABU });
  return await doc.save();
}

// ---------------- Form kirim sample ----------------
export async function pdfKirim(kp: any, items: any[], kopAtas: Uint8Array, kopBawah: Uint8Array, pt: string, revisi: number) {
  const { doc, k } = await siapkan(`Form Kirim Sample ${kp.no_kirim}`, true);
  const [ia, ib] = [await gambar(doc, kopAtas), await gambar(doc, kopBawah)];
  const hA = ia ? (A4[0] * ia.height) / ia.width : 0, hB = ib ? (A4[0] * ib.height) / ib.width : 0;
  k.m = 45; k.atasan = hA + 8; k.bawah = hB + 12;
  k.onPage = (kk) => { if (ia) kk.pg.drawImage(ia, { x: 0, y: A4[1] - hA, width: A4[0], height: hA }); if (ib) kk.pg.drawImage(ib, { x: 0, y: 0, width: A4[0], height: hB }); };
  k.baru();
  const tglPanjang = (t: string) => { try { return new Date(t + "T12:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); } catch { return t ?? ""; } };
  k.teks("FORM PENGIRIMAN SAMPLE KE PREPARASI", { sz: 13, b: true, al: "c" });
  k.teks(`Nomor: ${kp.no_kirim}${revisi > 1 ? ` (revisi ${revisi})` : ""}`, { sz: 10, al: "c", jarak: 6 });
  const tot = items.reduce((s, r) => s + (+r.berat_kg || 0), 0);
  const per: Record<string, number> = {}; for (const r of items) per[r.bhid ?? "-"] = (per[r.bhid ?? "-"] ?? 0) + 1;
  const KI: Kol[] = [{ w: 1.2 }, { w: 3 }];
  for (const [l, v] of [["Tanggal kirim", tglPanjang(kp.tanggal)], ["Tujuan", kp.tujuan], ["Proyek", kp.project], ["Titik bor (jumlah sample)", Object.entries(per).map(([b, n]) => `${b} (${n})`).join(", ")],
    ["Jumlah sample", String(items.length)], ["Total berat (kg)", dk(tot.toFixed(2))], ["Jumlah karung", kp.jumlah_karung], ["No. segel", kp.no_segel], ["Status", kp.status], ...(kp.catatan ? [["Catatan", kp.catatan]] : [])])
    k.baris([String(l), String(v ?? "") || "-"], KI, { sz: 9.5 });
  k.y -= 8;
  const KD: Kol[] = [{ w: 0.5, al: "c" }, { w: 1.3 }, { w: 1.3 }, { w: 0.7 }, { w: 0.8, al: "r" }, { w: 0.8, al: "r" }, { w: 0.7 }, { w: 0.8, al: "r" }, { w: 0.9, al: "r" }, { w: 1 }, { w: 1.3 }];
  k.baris(["No", "Titik", "No. sample", "ID", "From (m)", "To (m)", "Zona", "Core (m)", "Berat (kg)", "No. kantong", "Catatan"], KD, { kepala: true, sz: 7.5 });
  for (const r of items) k.baris([String(r.urut ?? ""), r.bhid ?? "", r.sample_no ?? "", r.sample_id ?? "", dk(r.depth_from), dk(r.depth_to), r.geozone_id ?? "", dk(r.core_length), dk(r.berat_kg), r.no_kantong ?? "", r.catatan ?? ""], KD, { sz: 7.5 });
  k.baris([`Total ${items.length} sample`, dk(tot.toFixed(2)), ""], [{ w: 8.1, al: "r" }, { w: 0.9, al: "r" }, { w: 2.3 }], { tebal: [true, true, false], sz: 7.5 });
  k.y -= 14; k.cukup(130);
  k.teks(`Luwuk, ${tglPanjang(kp.tanggal)}`, { sz: 10, jarak: 6 });
  const y0 = k.y, lb = k.lebar / 2;
  [["Pengirim,", pt, kp.pengirim], ["Penerima,", kp.tujuan || "PREPARASI", kp.penerima]].forEach(([a, b, n], i) => {
    const cx = k.m + i * lb + lb / 2, c = (t: string, y: number, font: any, sz: number) => { const s = aman(t); k.pg.drawText(s, { x: cx - font.widthOfTextAtSize(s, sz) / 2, y, size: sz, font }); };
    c(a, y0 - 10, k.f, 10); c(b, y0 - 23, k.fb, 10);
    const nm = n || "(......................)"; c(nm, y0 - 95, k.fb, 10);
    const w = k.fb.widthOfTextAtSize(aman(nm), 10); k.pg.drawLine({ start: { x: cx - w / 2, y: y0 - 97 }, end: { x: cx + w / 2, y: y0 - 97 }, thickness: 0.6 });
  });
  k.y = y0 - 110;
  k.teks(`Dokumen dari database X-Terra - ID ${kp.id} - PDF dibuat otomatis ${jamWIB(new Date())} WIB.`, { sz: 6.5, i: true, warna: ABU });
  return await doc.save();
}
