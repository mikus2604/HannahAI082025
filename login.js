
/* login.js */
const $ = (q, d=document)=>d.querySelector(q);
function toast(msg){
  let t = $("#toast"); if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent = msg; t.style.display='block'; setTimeout(()=>t.style.display='none', 1800);
}
// Theme from existing app
function applyTheme(theme){
  const t = (theme==='light') ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('theme', t);
  const toggle = document.getElementById('themeToggle');
  if(toggle) toggle.checked = (t==='light');
}
document.addEventListener('DOMContentLoaded', async ()=>{
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);
  const tog = document.getElementById('themeToggle');
  if(tog){ tog.checked = (saved==='light'); tog.addEventListener('change', ()=>applyTheme(tog.checked?'light':'dark')); }

  // Wait for Supabase to be ready
  try {
    await waitForSupabase();
  } catch (e) {
    $("#authMsg").textContent = e.message || 'Configuration error';
    return;
  }

  // If returning from OAuth redirect, ensure session and go to dashboard
  const { data: { session } } = await sb.auth.getSession();
  if(session){ location.href = 'index.html'; return; }

  // Tabs
  const tabs = $("#loginTabs");
  const nameRow = $("#nameRow");
  const companyRow = $("#companyRow");
  const phoneRow = $("#phoneRow");
  const submitBtn = $("#emailSubmit");
  let mode = 'signin';
  tabs.onclick = (e)=>{
    const tab = e.target.closest('.tab'); if(!tab) return;
    mode = tab.dataset.mode;
    document.querySelectorAll('#loginTabs .tab').forEach(t=>t.classList.toggle('active', t===tab));
    const show = (mode==='signup') ? '' : 'none';
    nameRow.style.display = show;
    companyRow.style.display = show;
    phoneRow.style.display = show;
    submitBtn.textContent = (mode==='signup') ? 'Sign up FREE' : 'Sign In';
    $("#authMsg").textContent='';
  };

  // Initialize the submit button label on first load
  submitBtn.textContent = (mode==='signup') ? 'Sign up FREE' : 'Sign In';



  // Email form
  const form = $("#loginForm");
  form.onsubmit = async (e)=>{
    e.preventDefault();
    $("#authMsg").textContent='';
    const email = $("#email").value.trim();
    const password = $("#password").value;
    const full_name = $("#full_name").value.trim() || null;
    const company = $("#company").value.trim() || null;
    const phone = $("#phone").value.trim() || null;
    try{
      HAIlog('Auth submit', {mode, email: $('#email').value.trim()});
      submitBtn.disabled = true;
      submitBtn.textContent = (mode==='signup') ? 'Creating account…' : 'Signing in…';
      if(mode==='signup'){
        // Basic guardrails for required signup fields
        if(!email || !password || !full_name){
          throw new Error('Please provide full name, email and password');
        }
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options:{ data:{ full_name, company, phone }}
        });
        if(error){ HAIlog('Supabase error', error); throw error; }
        // If email confirmations are enabled, user may be null until they confirm.
        if(data?.user){ HAIlog('Ensure profile after auth', data.user.id); await sbEnsureProfile(data.user); }
        toast('Account created. Check your email if confirmation is required.');
      }else{
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if(error){ HAIlog('Supabase error', error); throw error; }
        if(data?.user){ HAIlog('Ensure profile after auth', data.user.id); await sbEnsureProfile(data.user); }
      }
      // Ensure after-signin profile as well (covers confirm-required case)
      const { data: s } = await sb.auth.getSession(); HAIlog('Post-auth session check', !!s?.session);
      if(s?.session?.user){ await sbEnsureProfile(s.session.user); HAIlog('Redirect to dashboard'); location.href = 'dashboard.html'; return; }
      // If no session yet (confirmation flow), stay on page with info message
      $("#authMsg").style.color = 'var(--sub)';
      $("#authMsg").textContent = 'Please confirm your email to complete signup. Then sign in.';
    }catch(ex){
      $("#authMsg").style.color = 'var(--bad)';
      $("#authMsg").textContent = ex.message || 'Authentication error';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = (mode==='signup') ? 'Sign up FREE' : 'Sign In';
    }
  };

  // Google OAuth
  $("#googleBtn").onclick = async ()=>{
    try{ HAIlog('Auth submit', {mode, email: $('#email').value.trim()});
      HAIlog('Google OAuth start'); await sb.auth.signInWithOAuth({
        provider:'google',
        options:{
          redirectTo: new URL('login.html', location.href).href, // return to login, we'll redirect to dashboard
          queryParams: { prompt: 'consent' }
        }
      });
    }catch(ex){
      $("#authMsg").textContent = ex.message || 'Google sign-in failed';
    }
  };
});
