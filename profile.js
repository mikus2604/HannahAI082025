
/* profile.js */
const $ = (q, d=document)=>d.querySelector(q);
function toast(msg){
  let t = $("#toast"); if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent = msg; t.style.display='block'; setTimeout(()=>t.style.display='none', 1800);
}
function applyTheme(theme){
  const t = (theme==='light') ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('theme', t);
  const toggle = document.getElementById('themeToggle');
  if(toggle) toggle.checked = (t==='light');
}
async function requireAuthProfile(){
  // Wait for Supabase to be ready
  await waitForSupabase();
  
  const { data: { session } } = await sb.auth.getSession();
  if(!session){ HAIlog('No session on profile, redirect'); location.href = 'login.html'; return null; }
  const lo = $("#logoutBtn"); if(lo){ lo.onclick = async ()=>{ await sb.auth.signOut(); location.href='login.html'; }; }
  return session.user;
}

function tabsInit(rootId, defaultTab, onChange){
  const root = document.getElementById(rootId);
  root.onclick = (e)=>{
    const tab = e.target.closest('.tab'); if(!tab) return;
    const id = tab.dataset.tab;
    root.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t===tab));
    onChange(id);
  };
  // set default
  const first = root.querySelector(`.tab[data-tab="${defaultTab}"]`) || root.querySelector('.tab');
  if(first){ first.classList.add('active'); onChange(first.dataset.tab); }
}

async function renderProfileInfo(user){
  const { data: prof, error: perr } = await sb.from('profiles').select('*').eq('id', user.id).single(); HAIlog('Load profile', {has: !!prof, err: perr});
  const body = $("#profileBody");
  body.innerHTML = `
    <div class="grid" style="grid-template-columns: 1fr 1fr">
      <div class="card">
        <h3>Profile Info</h3>
        <div class="toolbar">
          <label for="p_full_name" style="display:block; margin-bottom:4px; font-weight:500;">Full Name</label>
          <input id="p_full_name" class="input" placeholder="Full name" value="${(prof && prof.full_name) || ''}" style="width:100%"/>
        </div>
        <div class="toolbar">
          <label for="p_company" style="display:block; margin-bottom:4px; font-weight:500;">Company</label>
          <input id="p_company" class="input" placeholder="Company" value="${(prof && prof.company) || ''}" style="width:100%"/>
        </div>
        <div class="toolbar">
          <label for="p_phone" style="display:block; margin-bottom:4px; font-weight:500;">Phone</label>
          <input id="p_phone" class="input" placeholder="Phone" value="${(prof && prof.phone) || ''}" style="width:100%"/>
        </div>
        <div class="toolbar">
          <label for="p_email" style="display:block; margin-bottom:4px; font-weight:500;">Email</label>
          <input id="p_email" class="input" value="${user.email}" disabled style="width:100%"/>
        </div>
        <div class="toolbar"><button class="button" id="saveProfile">Save Changes</button></div>
        <p id="p_msg" style="color:var(--bad); min-height:1.2em"></p>
      </div>
      <div class="card">
        <h3>Account</h3>
        <p><b>Plan:</b> ${(prof && prof.plan) || 'free'}</p>
        <p><b>Member since:</b> ${(prof && prof.created_at) ? new Date(prof.created_at).toLocaleDateString() : '—'}</p>
      </div>
    </div>
  `;
  $("#saveProfile").onclick = async ()=>{
    const btn = $("#saveProfile");
    btn.disabled = true;
    try{
      const upd = {
        full_name: $("#p_full_name").value.trim() || null,
        company: $("#p_company").value.trim() || null,
        phone: $("#p_phone").value.trim() || null,
        updated_at: new Date().toISOString()
      };
      // Update profiles row (fallback to minimal if schema lacks optional cols)
      let { error } = await sb.from('profiles').update(upd).eq('id', user.id); HAIlog('Save profile', upd, {err: error});
      if(error){
        const minimal = { full_name: upd.full_name, updated_at: upd.updated_at };
        HAIlog('Retry save with minimal payload due to schema mismatch');
        const retry = await sb.from('profiles').update(minimal).eq('id', user.id);
        if(retry.error) throw retry.error;
      }
      // Also sync to auth user metadata so it appears in Supabase Auth raw metadata
      const { error: mdErr } = await sb.auth.updateUser({ data: {
        full_name: upd.full_name,
        company: upd.company,
        phone: upd.phone
      }});
      if(mdErr){ HAIlog('Metadata update failed', mdErr); }
      toast('Saved');
    }catch(ex){ $("#p_msg").textContent = ex.message || 'Failed to save'; }
    finally{ btn.disabled = false; }
  };
}

async function renderSecurity(user){
  const body = $("#profileBody");
  // Fetch current MFA factors
  let factorsAll = [];
  try {
    const factors = await sb.auth.mfa.listFactors();
    factorsAll = factors.data?.all || [];
  } catch(_){/* ignore */}

  const existing = factorsAll.find(f=>f.factor_type==='totp' || f.factor_type==='phone');
  const status = existing ? 'Active' : 'Disabled';
  const buttonText = existing ? 'Disable' : 'Setup';

  body.innerHTML = `
    <div class="grid" style="grid-template-columns: 1fr 1fr">
      <div class="card">
        <h3>Change Password</h3>
        <div class="toolbar">
          <label for="currentPass" style="display:block; margin-bottom:4px; font-weight:500;">Current Password</label>
          <input id="currentPass" class="input" type="password" placeholder="Current password" style="width:100%"/>
        </div>
        <div class="toolbar">
          <label for="newPass" style="display:block; margin-bottom:4px; font-weight:500;">New Password</label>
          <input id="newPass" class="input" type="password" placeholder="New password" style="width:100%"/>
        </div>
        <div class="toolbar"><button class="button" id="changePass">Update Password</button></div>
        <p id="s_msg" style="color:var(--bad); min-height:1.2em"></p>
      </div>
      <div class="card">
        <h3>Two-Factor Authentication</h3>
        <p class="sub">We recommend that you setup Two-Factor Authentication. For more information about 2FA go to www.2factor.co.uk</p>
        <p><b>Status:</b> ${status}</p>
        <div class="toolbar">
          <button class="button" id="toggle2fa">${buttonText}</button>
        </div>
      </div>
    </div>
  `;
  $("#changePass").onclick = async ()=>{
    try{
      const currentPw = $("#currentPass").value;
      const newPw = $("#newPass").value;
      
      if(!currentPw || !newPw) {
        throw new Error('Please enter both current and new password');
      }
      
      // First verify current password by attempting to sign in
      const { error: signInError } = await sb.auth.signInWithPassword({ 
        email: user.email, 
        password: currentPw 
      });
      
      if(signInError) {
        throw new Error('Current password is incorrect');
      }
      
      // Update password
      const { error } = await sb.auth.updateUser({ password: newPw });
      if(error) throw error;
      
      // Clear fields
      $("#currentPass").value = '';
      $("#newPass").value = '';
      toast('Password updated');
    }catch(ex){ $("#s_msg").textContent = ex.message || 'Failed to update password'; }
  };
  // Helper: modal
  function openModal(title, contentHtml){
    let backdrop = document.getElementById('mfaModalBackdrop');
    if(!backdrop){
      backdrop = document.createElement('div');
      backdrop.id = 'mfaModalBackdrop';
      backdrop.className = 'modal-backdrop';
      backdrop.innerHTML = `<div class="modal"><div class="modal-content"></div></div>`;
      document.body.appendChild(backdrop);
    }
    const content = backdrop.querySelector('.modal-content');
    content.innerHTML = `
      <header><h3>${title}</h3><button class="button" id="mfaClose">✕</button></header>
      ${contentHtml}
    `;
    backdrop.style.display = 'flex';
    content.querySelector('#mfaClose').onclick = ()=>{ backdrop.style.display='none'; };
    backdrop.onclick = (e)=>{ if(e.target===backdrop) backdrop.style.display='none'; };
    document.onkeydown = (e)=>{ if(e.key==='Escape'){ backdrop.style.display='none'; }};
    return { backdrop, content };
  }

  function closeModal(){ const m = document.getElementById('mfaModalBackdrop'); if(m) m.style.display='none'; }

  async function getExisting(){
    const f = await sb.auth.mfa.listFactors();
    return (f.data?.all || []).find(x=>x.factor_type==='totp' || x.factor_type==='phone');
  }

  async function openAdd2fa(){
    const existing = await getExisting();
    if(existing){ openModal('2FA already configured', `<p class='sub'>Only one 2FA method can be active. Use Reset to re-enroll.</p>`); return; }
    const { content } = openModal('Add Two-Factor Authentication', `
      <div class='grid' style='grid-template-columns: 1fr'>
        <div class='card'>
          <h3>Choose a method</h3>
          <div class='toolbar'>
            <button class='button' id='optTotp'>Google Authenticator (TOTP)</button>
            <button class='button' id='optSms'>SMS code</button>
            <button class='button' id='optEmail' disabled title='Not supported by Supabase MFA'>Code to email (not supported)</button>
          </div>
        </div>
      </div>
    `);
    content.querySelector('#optTotp').onclick = ()=>startTotpFlow();
    content.querySelector('#optSms').onclick = ()=>startSmsFlow();
  }

  async function startTotpFlow(){
    try{
      const exists = await getExisting(); if(exists) { toast('2FA already exists'); return; }
      const enroll = await sb.auth.mfa.enroll({ factorType: 'totp' });
      if(enroll.error) throw enroll.error;
      const { id, totp } = enroll.data || {};
      // Create a challenge for this factor to verify the one-time code
      const { data: ch, error: chErr } = await sb.auth.mfa.challenge({ factorId: id });
      if(chErr) throw chErr;
      const { content } = openModal('Set up Google Authenticator', `
        <p class='sub'>Scan the QR code with your authenticator app, then enter the 6-digit code.</p>
        <div class='toolbar'><div id='totpQR' style='width:256px;height:256px'></div></div>
        <div class='toolbar'><input id='totpCode' class='input' placeholder='123456'/></div>
        <div class='toolbar'><button class='button' id='verifyTotp'>Verify</button></div>
      `);
      // Prefer server-provided QR; otherwise generate from URI (high correction level)
      const qrBox = content.querySelector('#totpQR');
      if(totp?.qr_code){
        if(/^data:image/.test(totp.qr_code)){
          qrBox.innerHTML = `<img alt='TOTP QR' src='${totp.qr_code}' width='256' height='256' style='display:block;background:#fff;border-radius:8px'/>`;
        } else if(/<svg/i.test(totp.qr_code)){
          qrBox.innerHTML = totp.qr_code;
        } else if(totp.uri && window.QRCode){
          new QRCode(qrBox, { text: totp.uri, width: 256, height: 256, correctLevel: QRCode.CorrectLevel.H });
        } else {
          qrBox.innerHTML = `<code class='inline'>${totp.uri||''}</code>`;
        }
      } else if(totp?.uri && window.QRCode){
        try{ new QRCode(qrBox, { text: totp.uri, width: 256, height: 256, correctLevel: QRCode.CorrectLevel.H }); }
        catch(_){ qrBox.innerHTML = `<code class='inline'>${totp.uri}</code>`; }
      } else if(totp?.uri){
        qrBox.innerHTML = `<code class='inline'>${totp.uri}</code>`;
      }
      content.querySelector('#verifyTotp').onclick = async ()=>{
        try{
          const code = document.getElementById('totpCode').value.trim();
          const verify = await sb.auth.mfa.verify({ factorId: id, challengeId: ch.id, code });
          if(verify.error) throw verify.error;
          toast('TOTP enabled');
          closeModal(); renderSecurity(user);
        }catch(ex){ document.getElementById('s_msg').textContent = ex.message || 'Failed to verify TOTP'; }
      };
    }catch(ex){ document.getElementById('s_msg').textContent = ex.message || 'Failed to enable TOTP'; }
  }

  async function startSmsFlow(){
    try{
      const exists = await getExisting(); if(exists) { toast('2FA already exists'); return; }
      const { content } = openModal('Enable SMS 2FA', `
        <div class='toolbar'><input id='mfaPhone' class='input' type='tel' placeholder='SMS phone (E.164, e.g. +447700900123)' style='width:100%'/></div>
        <div class='toolbar'><button class='button' id='sendSms'>Send code</button></div>
        <div id='smsStep2' class='hidden'>
          <div class='toolbar'><input id='smsCode' class='input' placeholder='Code from SMS'/></div>
          <div class='toolbar'><button class='button' id='verifySms'>Verify</button></div>
        </div>
      `);
      content.querySelector('#sendSms').onclick = async ()=>{
        try{
          const phone = content.querySelector('#mfaPhone').value.trim();
          if(!phone) throw new Error('Enter a phone number');
          const enroll = await sb.auth.mfa.enroll({ factorType: 'phone', phone });
          if(enroll.error) throw enroll.error;
          const { data: ch, error: chErr } = await sb.auth.mfa.challenge({ factorId: enroll.data.id });
          if(chErr) throw chErr;
          content.querySelector('#smsStep2').classList.remove('hidden');
          content.querySelector('#verifySms').onclick = async ()=>{
            try{
              const code = content.querySelector('#smsCode').value.trim();
              const verify = await sb.auth.mfa.verify({ factorId: enroll.data.id, challengeId: ch.id, code });
              if(verify.error) throw verify.error;
              toast('SMS 2FA enabled');
              closeModal(); renderSecurity(user);
            }catch(ex){ document.getElementById('s_msg').textContent = ex.message || 'Failed to verify SMS'; }
          };
        }catch(ex){ document.getElementById('s_msg').textContent = ex.message || 'Failed to enroll SMS'; }
      };
    }catch(ex){ document.getElementById('s_msg').textContent = ex.message || 'Failed to enable SMS 2FA'; }
  }

  async function disable2faWithAAL2(){
    const f = await sb.auth.mfa.listFactors();
    const cur = (f.data?.all || []).find(x=>x.factor_type==='totp' || x.factor_type==='phone');
    if(!cur) throw new Error('No 2FA enabled');

    // Create challenge first to reach AAL2
    const { data: challenge, error: chErr } = await sb.auth.mfa.challenge({ factorId: cur.id });
    if(chErr) throw chErr;

    const { content } = openModal('Verify 2FA to Disable', `
      <p class='sub'>Please verify your current 2FA to disable it.</p>
      <div class='toolbar'>
        <input id='disable2faCode' class='input' placeholder='Enter your ${cur.factor_type === 'totp' ? '6-digit code' : 'SMS code'}' style='width:100%'/>
      </div>
      <div class='toolbar'>
        <button class='button' id='verifyDisable'>Verify and Disable</button>
      </div>
    `);

    content.querySelector('#verifyDisable').onclick = async ()=>{
      try{
        const code = content.querySelector('#disable2faCode').value.trim();
        if(!code) throw new Error('Please enter the verification code');

        // Verify to reach AAL2
        const { error: verifyErr } = await sb.auth.mfa.verify({ 
          factorId: cur.id, 
          challengeId: challenge.id, 
          code 
        });
        if(verifyErr) throw verifyErr;

        // Now unenroll the factor
        const { error: unenrollErr } = await sb.auth.mfa.unenroll({ factorId: cur.id });
        if(unenrollErr) throw unenrollErr;

        toast('2FA disabled successfully');
        closeModal();
        renderSecurity(user);
      }catch(ex){
        document.getElementById('s_msg').textContent = ex.message || 'Failed to disable 2FA';
      }
    };
  }

  document.getElementById('toggle2fa').onclick = async ()=>{
    try{
      const f = await sb.auth.mfa.listFactors();
      const cur = (f.data?.all || []).find(x=>x.factor_type==='totp' || x.factor_type==='phone');
      
      if(cur) {
        // Disable existing 2FA - requires AAL2 verification
        await disable2faWithAAL2();
      } else {
        // Setup new 2FA
        openAdd2fa();
      }
    }catch(ex){ document.getElementById('s_msg').textContent = ex.message || 'Failed to toggle 2FA'; }
  };
}

async function renderBilling(user){
  // Try to load invoices from Supabase; fallback to demo data.js if none
  let rows = [];
  try{
    const { data, error } = await sb.from('invoices').select('id, date, amount, status, file_url').order('date', { ascending:false }); HAIlog('Load invoices', {count: (data&&data.length)||0, err: error});
    if(!error && data) rows = data;
  }catch(_){}
  if(!rows.length && window.DEMO_DATA){ rows = window.DEMO_DATA.invoices.map((i, idx)=>({ id: 'demo-'+idx, date: i.date, amount: i.amount, status: i.status, file_url: '#' })); }
  
  const body = $("#profileBody");
  body.innerHTML = `
    <div class="grid" style="grid-template-columns: 1fr 1fr">
      <div class="card">
        <h3>Current Plan</h3>
        <p><b>Starter Plan</b> - $49/month</p>
        <p>500 minutes included, $0.05/min overage</p>
        <div class="toolbar">
          <button class="button">Upgrade Plan</button>
          <button class="button outline">Billing Portal</button>
        </div>
      </div>
    <div class="card">
        <h3>Usage This Month</h3>
        <p><b>Minutes:</b> 347 / 500</p>
        <p><b>Overage:</b> $0.00</p>
        <p><b>Next billing:</b> Jan 15, 2024</p>
      </div>
    </div>
    <div class="card" style="margin-top:12px">
      <h3>Invoices</h3>
      <table class="table">
        <thead><tr><th>Date</th><th>Amount</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${rows.map(r=>`<tr><td>${r.date || ''}</td><td>${r.amount || ''}</td><td>${r.status || ''}</td><td><a class="button" href="${r.file_url || '#'}" target="_blank">Download</a></td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', async ()=>{
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);
  const tog = document.getElementById('themeToggle');
  if(tog){ tog.checked = (saved==='light'); tog.addEventListener('change', ()=>applyTheme(tog.checked?'light':'dark')); }

  const user = await requireAuthProfile();
  if(!user) return;

  function openTabByHash(){
    const h = (location.hash||'').replace('#','') || 'profile';
    const root = document.getElementById('profileTabs');
    const el = root && root.querySelector(`.tab[data-tab="${h}"]`);
    if(el){
      root.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t===el));
      if(h==='profile') renderProfileInfo(user);
      if(h==='security') renderSecurity(user);
      if(h==='billing') renderBilling(user);
    }
  }

  tabsInit('profileTabs', 'profile', (id)=>{
    if(id==='profile') renderProfileInfo(user);
    if(id==='security') renderSecurity(user);
    if(id==='billing') renderBilling(user);
  });

  // If hash present, override default
  if(location.hash){ openTabByHash(); }
  window.addEventListener('hashchange', openTabByHash);
});
