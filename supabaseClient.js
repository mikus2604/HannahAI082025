// HAIlog function definition
const HAIlog = (...a) => console.log('[HannahAI]', ...a);

let sb;
let sbReady = false;

(async () => {
  function getFromWindow(){
    const url = (window.SUPABASE_URL || '').trim();
    const anonKey = (window.SUPABASE_ANON_KEY || '').trim();
    if (url && anonKey) return { url, anonKey };
    return null;
  }

  async function fetchConfigCandidates(){
    const candidates = [];
    // Same-origin
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      candidates.push(`${location.origin}/supabase-config`);
    }
    // Local dev fallback
    if (!candidates.includes('http://localhost:3000/supabase-config')) {
      candidates.push('http://localhost:3000/supabase-config');
    }
    return candidates;
  }

  try {
    HAIlog("Initializing Supabase client");
    let cfg = getFromWindow();
    if (!cfg) {
      const urls = await fetchConfigCandidates();
      let lastErr = null;
      for (const u of urls) {
        try {
          const res = await fetch(u, { credentials: 'same-origin' });
          if (!res.ok) { lastErr = new Error(`HTTP ${res.status}`); continue; }
          const { url, anonKey } = await res.json();
          if (url && anonKey) { cfg = { url, anonKey }; break; }
        } catch (err) { lastErr = err; }
      }
      if (!cfg) { throw lastErr || new Error('No config sources succeeded'); }
    }
    sb = supabase.createClient(cfg.url, cfg.anonKey);
    sbReady = true;
    HAIlog("Supabase client initialized");
  } catch (e) {
    console.error("Failed to load Supabase config", e);
  }
})();

// Helper to wait for Supabase to be ready with optional timeout
async function waitForSupabase(timeoutMs = 10000) {
  const start = Date.now();
  while (!sbReady) {
    await new Promise(resolve => setTimeout(resolve, 100));
    if (Date.now() - start > timeoutMs) {
      throw new Error('Supabase not configured. Check /supabase-config and .env');
    }
  }
  return sb;
}

async function sbEnsureProfile(user) {
  try {
    const { data } = await sb
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (!data) {
      // Always create minimal row first to avoid unknown-column errors
      await sb.from("profiles").insert({
        id: user.id,
        full_name: user.user_metadata.full_name || "",
        email: user.email,
        created_at: new Date().toISOString()
      });
    }
    // Best-effort: try to update optional fields (company/phone) if columns exist
    try {
      await sb.from("profiles").update({
        company: user.user_metadata.company || null,
        phone: user.user_metadata.phone || null,
        updated_at: new Date().toISOString()
      }).eq('id', user.id);
    } catch (_ignore) { /* ignore if columns do not exist */ }
  } catch (e) {
    console.error("Ensure profile error:", e);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const here = location.pathname.split("/").pop().toLowerCase();
  
  // Wait for Supabase to be ready
  await waitForSupabase();
  
  if (here === "login.html") {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      await sbEnsureProfile(session.user);
      location.href = "dashboard.html";
    }
  }
  
  // Auth-aware routing per page
  const { data: { session } } = await sb.auth.getSession();

  // Landing page (index):
  if (here === "index.html") {
    if (session) { location.href = "dashboard.html"; return; }
  }

  // Dashboard/profile pages require auth
  if (here === "dashboard.html" || here === "profile.html") {
    if (!session) { return; }
    await sbEnsureProfile(session.user);
  }
  
  // Show SuperUser link for authorized users
  if (session) {
    try {
      const { data: superuserPerms, error } = await sb
        .from('superuser_permissions')
        .select('is_active')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .single();
      
      const superUserLink = document.getElementById('superuserLink');
      if (superUserLink && superuserPerms && !error) {
        superUserLink.style.display = 'inline';
      }
    } catch (e) {
      // ignore
    }
  }

  // Avatar dropdown bindings
  const avatarBtn = document.getElementById('avatarBtn');
  const avatarDropdown = document.getElementById('avatarDropdown');
  const ddLogout = document.getElementById('ddLogout');
  if (avatarBtn && avatarDropdown) {
    avatarBtn.addEventListener('click', (e)=>{
      e.preventDefault();
      const isOpen = avatarDropdown.style.display === 'block';
      avatarDropdown.style.display = isOpen ? 'none' : 'block';
    });
    document.addEventListener('click', (e)=>{
      const root = document.getElementById('avatarMenuRoot');
      if (root && !root.contains(e.target)) avatarDropdown.style.display = 'none';
    });
  }
  if (ddLogout) {
    ddLogout.onclick = async ()=>{ await sb.auth.signOut(); location.href = 'login.html'; };
  }

  // Personalize avatar initial
  if (session) {
    const span = document.getElementById('avatarImg');
    if (span) {
      const name = session.user.user_metadata?.full_name || session.user.email || 'U';
      span.textContent = (name.trim()[0] || 'U').toUpperCase();
    }
    // Hash links for profile sections
    const ddSec = document.getElementById('ddSecurity');
    const ddBil = document.getElementById('ddBilling');
    if (ddSec) ddSec.href = '/profile#security';
    if (ddBil) ddBil.href = '/profile#billing';
  }
});
