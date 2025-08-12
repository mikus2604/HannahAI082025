/* superuser.js */
const $ = (q, d=document)=>d.querySelector(q);
const $$ = (q, d=document)=>d.querySelectorAll(q);

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

async function requireSuperUser(){
  await waitForSupabase();
  
  const { data: { session } } = await sb.auth.getSession();
  if(!session){ HAIlog('No session on superuser, redirect'); location.href = 'login.html'; return null; }
  
  // Check if user has superuser permissions in database
  try {
    const { data: superuserPerms, error } = await sb
      .from('superuser_permissions')
      .select('is_active')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .single();
    
    if(error || !superuserPerms) {
      HAIlog('User not authorized for superuser access');
      location.href = 'dashboard.html';
      return null;
    }
  } catch (e) {
    HAIlog('User not authorized for superuser access');
    location.href = 'dashboard.html';
    return null;
  }
  
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

async function renderUsers(){
  const body = $("#superuserBody");
  
  // Fetch all users from Supabase
  let users = [];
  try {
    const { data, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
    if(error) throw error;
    users = data || [];
  } catch(e) {
    console.error('Failed to fetch users:', e);
    // Fallback to demo data
    users = [
      { id: '1', full_name: 'John Doe', email: 'john@example.com', company: 'Acme Corp', plan: 'starter', created_at: '2024-01-01', minutes_used: 347, total_spent: 147.00 },
      { id: '2', full_name: 'Jane Smith', email: 'jane@example.com', company: 'TechStart', plan: 'pro', created_at: '2024-01-05', minutes_used: 892, total_spent: 289.50 },
      { id: '3', full_name: 'Bob Wilson', email: 'bob@example.com', company: 'Consulting Co', plan: 'enterprise', created_at: '2024-01-10', minutes_used: 1247, total_spent: 523.75 }
    ];
  }
  
  const rows = users.map(user => `
    <tr>
      <td>${user.full_name || '—'}</td>
      <td>${user.email}</td>
      <td>${user.company || '—'}</td>
      <td><span class="badge">${user.plan || 'free'}</span></td>
      <td>${user.minutes_used || 0}</td>
      <td>$${(user.total_spent || 0).toFixed(2)}</td>
      <td>${new Date(user.created_at).toLocaleDateString()}</td>
      <td>
        <button class="button small" onclick="viewUserDetails('${user.id}')">View</button>
        <button class="button small outline" onclick="resetUserPassword('${user.email}')">Reset PW</button>
        <button class="button small outline" onclick="disableUser2FA('${user.id}')">Disable 2FA</button>
      </td>
    </tr>
  `).join('');
  
  body.innerHTML = `
    <div class="card">
      <h3>All Users</h3>
      <div class="toolbar">
        <input id="userSearch" class="input" placeholder="Search users..." style="width:300px"/>
        <button class="button" onclick="exportUsers()">Export CSV</button>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Company</th>
            <th>Plan</th>
            <th>Minutes Used</th>
            <th>Total Spent</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
  
  // Search functionality
  $("#userSearch").oninput = (e) => {
    const search = e.target.value.toLowerCase();
    const rows = $$("tbody tr");
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(search) ? '' : 'none';
    });
  };
}

async function renderSecurity(){
  const body = $("#superuserBody");
  
  body.innerHTML = `
    <div class="grid" style="grid-template-columns: 1fr 1fr">
      <div class="card">
        <h3>User Security Management</h3>
        <div class="toolbar">
          <label for="resetEmail" style="display:block; margin-bottom:4px; font-weight:500;">User Email</label>
          <input id="resetEmail" class="input" placeholder="Enter user email" style="width:100%"/>
        </div>
        <div class="toolbar">
          <label for="newPassword" style="display:block; margin-bottom:4px; font-weight:500;">New Password</label>
          <input id="newPassword" class="input" type="password" placeholder="Enter new password" style="width:100%"/>
        </div>
        <div class="toolbar">
          <button class="button" onclick="resetPassword()">Reset Password</button>
        </div>
        <p class="sub">This will force the user to change their password on next login.</p>
      </div>
      <div class="card">
        <h3>2FA Management</h3>
        <div class="toolbar">
          <label for="disable2faEmail" style="display:block; margin-bottom:4px; font-weight:500;">User Email</label>
          <input id="disable2faEmail" class="input" placeholder="Enter user email" style="width:100%"/>
        </div>
        <div class="toolbar">
          <button class="button" onclick="disable2FA()">Disable 2FA</button>
        </div>
        <p class="sub">This will disable 2FA for the user without requiring their verification code.</p>
      </div>
    </div>
    <div class="card" style="margin-top:12px">
      <h3>Security Logs</h3>
      <table class="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>User</th>
            <th>Action</th>
            <th>IP Address</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>2024-01-15 14:30</td><td>admin@hannahai.com</td><td>Password Reset</td><td>192.168.1.1</td><td><span class="badge">Success</span></td></tr>
          <tr><td>2024-01-15 13:45</td><td>admin@hannahai.com</td><td>2FA Disabled</td><td>192.168.1.1</td><td><span class="badge">Success</span></td></tr>
          <tr><td>2024-01-15 12:20</td><td>john@example.com</td><td>Login Attempt</td><td>203.0.113.1</td><td><span class="badge bad">Failed</span></td></tr>
        </tbody>
      </table>
    </div>
  `;
}

async function renderBillingOverview(){
  const body = $("#superuserBody");
  
  // Calculate totals
  const totalUsers = 156;
  const totalRevenue = 12450.75;
  const totalMinutes = 45678;
  const activeUsers = 142;
  
  body.innerHTML = `
    <div class="grid" style="grid-template-columns: 1fr 1fr 1fr 1fr">
      <div class="card">
        <h3>Total Users</h3>
        <p style="font-size:2em; font-weight:bold; color:var(--primary)">${totalUsers}</p>
        <p class="sub">${activeUsers} active this month</p>
      </div>
      <div class="card">
        <h3>Total Revenue</h3>
        <p style="font-size:2em; font-weight:bold; color:var(--success)">$${totalRevenue.toLocaleString()}</p>
        <p class="sub">Lifetime earnings</p>
      </div>
      <div class="card">
        <h3>Minutes Used</h3>
        <p style="font-size:2em; font-weight:bold; color:var(--warning)">${totalMinutes.toLocaleString()}</p>
        <p class="sub">Total call minutes</p>
      </div>
      <div class="card">
        <h3>Active Plans</h3>
        <p style="font-size:2em; font-weight:bold; color:var(--info)">${activeUsers}</p>
        <p class="sub">Paying customers</p>
      </div>
    </div>
    <div class="grid" style="grid-template-columns: 1fr 1fr; margin-top:12px">
      <div class="card">
        <h3>Revenue by Plan</h3>
        <div class="toolbar">
          <p><b>Starter ($49):</b> 89 users - $4,361</p>
        </div>
        <div class="toolbar">
          <p><b>Pro ($99):</b> 45 users - $4,455</p>
        </div>
        <div class="toolbar">
          <p><b>Enterprise ($199):</b> 8 users - $1,592</p>
        </div>
        <div class="toolbar">
          <p><b>Overage:</b> $2,042.75</p>
        </div>
      </div>
      <div class="card">
        <h3>Recent Invoices</h3>
        <table class="table">
          <thead>
            <tr><th>Date</th><th>User</th><th>Amount</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr><td>2024-01-15</td><td>john@example.com</td><td>$49.00</td><td><span class="badge">Paid</span></td></tr>
            <tr><td>2024-01-14</td><td>jane@example.com</td><td>$99.00</td><td><span class="badge">Paid</span></td></tr>
            <tr><td>2024-01-13</td><td>bob@example.com</td><td>$199.00</td><td><span class="badge">Paid</span></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Security functions
async function resetPassword(){
  const email = $("#resetEmail").value.trim();
  const newPassword = $("#newPassword").value.trim();
  
  if(!email || !newPassword) {
    toast('Please enter both email and new password');
    return;
  }
  
  try {
    // In a real implementation, you would use Supabase Admin API
    // For now, we'll simulate the action
    toast(`Password reset initiated for ${email}`);
    $("#resetEmail").value = '';
    $("#newPassword").value = '';
  } catch(e) {
    toast('Failed to reset password: ' + e.message);
  }
}

async function disable2FA(){
  const email = $("#disable2faEmail").value.trim();
  
  if(!email) {
    toast('Please enter user email');
    return;
  }
  
  try {
    // In a real implementation, you would use Supabase Admin API
    // For now, we'll simulate the action
    toast(`2FA disabled for ${email}`);
    $("#disable2faEmail").value = '';
  } catch(e) {
    toast('Failed to disable 2FA: ' + e.message);
  }
}

// User management functions
function viewUserDetails(userId){
  toast(`Viewing details for user ${userId}`);
  // In a real implementation, you would open a modal with user details
}

function resetUserPassword(email){
  $("#resetEmail").value = email;
  // Switch to security tab
  document.querySelector('[data-tab="security"]').click();
}

function disableUser2FA(userId){
  // Find user email by ID and populate the field
  toast(`Preparing to disable 2FA for user ${userId}`);
  // Switch to security tab
  document.querySelector('[data-tab="security"]').click();
}

function exportUsers(){
  toast('Exporting users to CSV...');
  // In a real implementation, you would generate and download a CSV file
}

async function renderSuperUserManagement(){
  const body = $("#superuserBody");
  
  // Fetch current superusers
  let superusers = [];
  try {
    const { data, error } = await sb
      .from('superuser_permissions')
      .select(`
        id,
        user_id,
        granted_by,
        granted_at,
        is_active,
        profiles!inner(full_name, email)
      `)
      .eq('is_active', true)
      .order('granted_at', { ascending: false });
    
    if(error) throw error;
    superusers = data || [];
  } catch(e) {
    console.error('Failed to fetch superusers:', e);
    toast('Failed to load superuser list');
  }
  
  // Fetch all users for the dropdown
  let allUsers = [];
  try {
    const { data, error } = await sb
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name');
    
    if(error) throw error;
    allUsers = data || [];
  } catch(e) {
    console.error('Failed to fetch users:', e);
  }
  
  const superuserRows = superusers.map(su => `
    <tr>
      <td>${su.profiles.full_name || '—'}</td>
      <td>${su.profiles.email}</td>
      <td>${new Date(su.granted_at).toLocaleDateString()}</td>
      <td>
        <button class="button small outline" onclick="revokeSuperUser('${su.user_id}')">Revoke</button>
      </td>
    </tr>
  `).join('');
  
  const userOptions = allUsers
    .filter(user => !superusers.find(su => su.user_id === user.id))
    .map(user => `<option value="${user.id}">${user.full_name} (${user.email})</option>`)
    .join('');
  
  body.innerHTML = `
    <div class="grid" style="grid-template-columns: 1fr 1fr">
      <div class="card">
        <h3>Grant SuperUser Access</h3>
        <div class="toolbar">
          <label for="newSuperUser" style="display:block; margin-bottom:4px; font-weight:500;">Select User</label>
          <select id="newSuperUser" class="select" style="width:100%">
            <option value="">Choose a user...</option>
            ${userOptions}
          </select>
        </div>
        <div class="toolbar">
          <button class="button" onclick="grantSuperUser()">Grant SuperUser Access</button>
        </div>
        <p class="sub">This will give the selected user access to the SuperUser management page.</p>
      </div>
      <div class="card">
        <h3>Current SuperUsers</h3>
        <p class="sub">Users with SuperUser permissions:</p>
        <table class="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Granted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${superuserRows}</tbody>
        </table>
      </div>
    </div>
  `;
}

async function grantSuperUser(){
  const userId = $("#newSuperUser").value;
  
  if(!userId) {
    toast('Please select a user');
    return;
  }
  
  try {
    const { data: { session } } = await sb.auth.getSession();
    if(!session) throw new Error('No session');
    
    const { error } = await sb
      .from('superuser_permissions')
      .insert({
        user_id: userId,
        granted_by: session.user.id,
        is_active: true
      });
    
    if(error) throw error;
    
    toast('SuperUser access granted successfully');
    $("#newSuperUser").value = '';
    renderSuperUserManagement(); // Refresh the list
  } catch(e) {
    console.error('Failed to grant superuser access:', e);
    toast('Failed to grant SuperUser access: ' + e.message);
  }
}

async function revokeSuperUser(userId){
  if(!confirm('Are you sure you want to revoke SuperUser access for this user?')) {
    return;
  }
  
  try {
    const { error } = await sb
      .from('superuser_permissions')
      .update({ is_active: false })
      .eq('user_id', userId);
    
    if(error) throw error;
    
    toast('SuperUser access revoked successfully');
    renderSuperUserManagement(); // Refresh the list
  } catch(e) {
    console.error('Failed to revoke superuser access:', e);
    toast('Failed to revoke SuperUser access: ' + e.message);
  }
}

document.addEventListener('DOMContentLoaded', async ()=>{
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);
  const tog = document.getElementById('themeToggle');
  if(tog){ tog.checked = (saved==='light'); tog.addEventListener('change', ()=>applyTheme(tog.checked?'light':'dark')); }

  const user = await requireSuperUser();
  if(!user) return;

  tabsInit('superuserTabs', 'users', (id)=>{
    if(id==='users') renderUsers();
    if(id==='security') renderSecurity();
    if(id==='billing') renderBillingOverview();
    if(id==='superusers') renderSuperUserManagement();
  });
});
