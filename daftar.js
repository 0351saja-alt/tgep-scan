import { createClient } from "./vendor/supabase.js";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const $ = (s) => document.querySelector(s);
$("#go").onclick = async () => {
  const v = (id) => $(id).value.trim();
  const d = { full_name: v("#fn"), phone: v("#ph"), company: v("#co"), position: v("#po"), requested_role: $("#rl").value, reason: v("#rs") };
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
