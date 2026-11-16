import { createClient } from "./vendor/supabase.js";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const $ = (s) => document.querySelector(s);
const esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
let PJ = [];
const multi = () => $("#rl").value === "geologist";   // wellsite bisa mengawasi lebih dari satu rig
const isiRig = () => {
  const p = PJ.find((x) => x.code === $("#pj").value), rs = p?.rigs ?? [], t = multi() ? "checkbox" : "radio";
  $("#rgLbl").textContent = multi() ? "Rig (boleh lebih dari satu)" : "Rig";
  $("#rgBox").innerHTML = rs.map((r) => `<label style="flex:0;white-space:nowrap;margin:0"><input type="${t}" name="rg" value="${esc(r)}" style="width:auto"> ${esc(r)}</label>`).join("") || `<span class="muted">${p ? "proyek tanpa rig" : "pilih proyek dulu"}</span>`;
};
sb.rpc("daftar_proyek").then(({ data }) => {
  PJ = data ?? [];
  $("#pj").innerHTML = `<option value="">— belum tahu / tanya admin —</option>` + PJ.map((p) => `<option value="${esc(p.code)}">${esc(p.nama)}</option>`).join("");
  if (PJ.length === 1) $("#pj").value = PJ[0].code;
  isiRig();
});
$("#pj").onchange = isiRig;
$("#rl").addEventListener("change", () => { $("#pjBox").style.display = $("#rl").value === "client" ? "none" : ""; isiRig(); });
$("#go").onclick = async () => {
  const v = (id) => $(id).value.trim();
  const d = { full_name: v("#fn"), phone: v("#ph"), company: v("#co"), position: v("#po"), requested_role: $("#rl").value, reason: v("#rs") };
  if ($("#rl").value !== "client" && $("#pj").value) { d.project = $("#pj").value; d.rigs = [...document.querySelectorAll('[name="rg"]:checked')].map((x) => x.value); }
  const email = v("#em").toLowerCase(), pw = $("#pw").value;
  if (!d.full_name || !email || !d.phone || !d.company || !d.position) return ($("#e").textContent = "Lengkapi semua kolom bertanda *.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return ($("#e").textContent = "Format email tidak benar.");
  if (pw.length < 8) return ($("#e").textContent = "Kata sandi minimal 8 karakter.");
  if (pw !== $("#pw2").value) return ($("#e").textContent = "Ulangan kata sandi tidak sama.");
  $("#go").disabled = true; $("#e").textContent = "";
  const { error } = await sb.auth.signUp({ email, password: pw, options: { data: d, emailRedirectTo: new URL("./", location.href).href } });
  $("#go").disabled = false;
  if (error) return ($("#e").textContent = /registered|exists/i.test(error.message) ? "Email ini sudah terdaftar. Silakan masuk, atau hubungi admin." : /not allowed|disabled/i.test(error.message) ? "Pendaftaran sedang ditutup admin." : error.message);
  location.href = "./?daftar=ok&email=" + encodeURIComponent(email);
};
