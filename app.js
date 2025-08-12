
/* Simple SPA router + charts + interactions + theme */
const $ = (q, d=document)=>d.querySelector(q);
window.HAIlog = window.HAIlog || ((...a)=>console.log('[HannahAI]',...a));
const $$ = (q, d=document)=>Array.from(d.querySelectorAll(q));

function cssVar(name){
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}
function applyTheme(theme){
  const t = (theme==='light') ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('theme', t);
  const toggle = document.getElementById('themeToggle');
  if(toggle) toggle.checked = (t==='light');
  render();
}

const state = {
  route: 'overview',
  data: window.DEMO_DATA,
  filters: { callsSearch: '' }
};
// When navigating to settings from an external tab request (e.g., "numbers"),
// store the desired tab here so Settings can open it by default.
let nextSettingsTab = null;

function setActiveNav() {
  $$(".nav a").forEach(a=>{
    a.classList.toggle("active", a.dataset.route===state.route);
  });
}

function navigate(route){
  // Map deprecated standalone routes to Settings tabs
  if(route === 'numbers') { nextSettingsTab = 'numbers'; route = 'settings'; }
  state.route = route;
  window.location.hash = route;
  render();
  toast(`Navigated to ${route}`);
}

window.addEventListener('hashchange', ()=>{
  let r = location.hash.replace('#','') || 'overview';
  if(r === 'numbers'){ nextSettingsTab = 'numbers'; r = 'settings'; }
  state.route = r;
  render();
});

function fmt(n){ return new Intl.NumberFormat('en-GB').format(n); }

/* Charts */
let charts = {};
function renderOverview(){
  const root = $("#view");
  const callsToday = 124;
  const answerRate = 92;
  const bookingRate = 38;
  const csat = 4.7;
  root.innerHTML = `
    <section class="section">
      <div class="grid kpis">
        <div class="card"><h3>Calls Today</h3><div class="kpi-value">${fmt(callsToday)}</div></div>
        <div class="card"><h3>Answer Rate</h3><div class="kpi-value">${answerRate}%</div></div>
        <div class="card"><h3>Booking Rate</h3><div class="kpi-value">${bookingRate}%</div></div>
        <div class="card"><h3>CSAT</h3><div class="kpi-value">${csat} / 5</div></div>
      </div>
    </section>
    <section class="grid" style="grid-template-columns: 2fr 1fr; align-items:start">
      <div class="card"><h3>Calls Over Time</h3><canvas id="callsChart" height="120"></canvas></div>
      <div class="card"><h3>Top Intents</h3><canvas id="intentChart" height="120"></canvas></div>
    </section>
    <section class="section">
      <div class="card">
        <h3>Recent Calls</h3>
        <div class="toolbar">
          <input id="callsSearch" class="input" placeholder="Search caller or number"/>
          <button class="button" id="exportCalls">Export CSV</button>
        </div>
        <table class="table" id="recentTable">
          <thead><tr><th>Time</th><th>Caller</th><th>Number</th><th>Outcome</th><th>Duration</th><th>Sentiment</th><th>Cost</th><th></th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </section>
  `;
  // Charts
  const d = state.data;
  const ctx = $("#callsChart").getContext('2d');
  charts.calls && charts.calls.destroy();
  charts.calls = new Chart(ctx, {
    type:'line',
    data:{
      labels:d.dates,
      datasets:[
        {label:'Total Calls', data:d.calls_over_time, tension:.3},
        {label:'AI Resolved', data:d.ai_resolved, tension:.3},
        {label:'Escalated', data:d.human_escalated, tension:.3},
      ]
    },
    options:{plugins:{legend:{labels:{color:cssVar('--text')}}}, scales:{
      x:{ticks:{color:cssVar('--sub')}, grid:{color:cssVar('--grid')}},
      y:{ticks:{color:cssVar('--sub')}, grid:{color:cssVar('--grid')}}
    }}
  });
  const ictx = $("#intentChart").getContext('2d');
  charts.intents && charts.intents.destroy();
  charts.intents = new Chart(ictx, {
    type:'bar',
    data:{labels:d.intents.map(i=>i.name), datasets:[{label:'Share %', data:d.intents.map(i=>i.rate)}]},
    options:{indexAxis:'y', plugins:{legend:{labels:{color:cssVar('--text')}}},
      scales:{x:{ticks:{color:cssVar('--sub')}, grid:{color:cssVar('--grid')}}, y:{ticks:{color:cssVar('--sub')}, grid:{color:cssVar('--grid')}}}
    }
  });
  // Table
  const tbody = $("#recentTable tbody");
  function refreshTable(){
    const q = ($("#callsSearch").value||'').toLowerCase();
    tbody.innerHTML = state.data.recent_calls
      .filter(r => r.caller.toLowerCase().includes(q) || r.number.includes(q))
      .map(r=>`
        <tr>
          <td>${r.time}</td><td>${r.caller}</td><td>${r.number}</td>
          <td><span class="badge ${r.outcome==='Booked'?'good': r.outcome==='Missed'?'bad':'warn'}">${r.outcome}</span></td>
          <td>${r.duration}</td><td>${r.sentiment}</td><td>£${r.cost.toFixed(2)}</td>
          <td><button class="button" data-open-call="${r.caller}">View ▶</button></td>
        </tr>`).join('');
    $$("button[data-open-call]").forEach(b=>b.onclick=()=>openCallDetail(b.dataset.openCall));
  }
  $("#callsSearch").oninput = refreshTable;
  $("#exportCalls").onclick = exportCallsCSV;
  refreshTable();
}

function exportCallsCSV(){
  const rows = [["Time","Caller","Number","Outcome","Duration","Sentiment","Cost"]]
    .concat(state.data.recent_calls.map(r=>[r.time,r.caller,r.number,r.outcome,r.duration,r.sentiment,"£"+r.cost.toFixed(2)]));
  const csv = rows.map(r=>r.map(v=>`"${(v+"").replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download="recent-calls.csv"; a.click();
  URL.revokeObjectURL(url);
}

function openCallDetail(caller){
  const item = state.data.recent_calls.find(r=>r.caller===caller);
  if(!item) return;
  const m = $("#modal"); $(".modal-content", m).innerHTML = `
    <header><h3>Call Detail – ${item.caller}</h3><button class="button" id="closeModal">Close</button></header>
    <div class="grid" style="grid-template-columns: 1fr 1fr">
      <div class="card"><h3>Summary</h3>
        <p><b>Number:</b> ${item.number}</p>
        <p><b>Outcome:</b> ${item.outcome}</p>
        <p><b>Duration:</b> ${item.duration}</p>
        <p><b>Sentiment:</b> ${item.sentiment}</p>
        <p><b>Cost:</b> £${item.cost.toFixed(2)}</p>
      </div>
      <div class="card"><h3>Transcript</h3>
        <small class="mono">[00:00]</small> AI: Hello, thanks for calling ExampleCo. How can I help?<br/>
        <small class="mono">[00:04]</small> Caller: I'd like to book an appointment.<br/>
        <small class="mono">[00:20]</small> AI: Sure, what date works for you?<br/>
      </div>
    </div>
  `;
  $("#modalBackdrop").style.display='flex';
  $("#closeModal").onclick = ()=>$("#modalBackdrop").style.display='none';
}

function renderCalls(){
  const root = $("#view");
  root.innerHTML = `
    <section class="section">
      <div class="card">
        <h3>Recent Calls</h3>
        <div class="toolbar"><input id="callsSearch" class="input" placeholder="Search caller or number"/></div>
        <table class="table" id="recentTable">
          <thead><tr><th>Time</th><th>Caller</th><th>Number</th><th>Outcome</th><th>Duration</th><th>Sentiment</th><th>Cost</th><th></th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </section>
  `;
  const tbody = $("#recentTable tbody");
  function refresh(){
    const q = ($("#callsSearch").value||'').toLowerCase();
    tbody.innerHTML = state.data.recent_calls
      .filter(r => r.caller.toLowerCase().includes(q) || r.number.includes(q))
      .map(r=>`
        <tr>
          <td>${r.time}</td><td>${r.caller}</td><td>${r.number}</td>
          <td><span class="badge ${r.outcome==='Booked'?'good': r.outcome==='Missed'?'bad':'warn'}">${r.outcome}</span></td>
          <td>${r.duration}</td><td>${r.sentiment}</td><td>£${r.cost.toFixed(2)}</td>
          <td><button class="button" data-open-call="${r.caller}">View ▶</button></td>
        </tr>`).join('');
    $$('button[data-open-call]').forEach(b=>b.onclick=()=>openCallDetail(b.dataset.openCall));
  }
  $("#callsSearch").oninput = refresh; refresh();
}

function renderInbox(){
  const root = $("#view");
  const threads = state.data.sms_threads;
  root.innerHTML = `
    <section class="columns">
      <div class="card">
        <h3>Threads</h3>
        ${threads.map(t=>`<div class="thread" data-thread="${t.id}"><b>${t.caller}</b><br/><small class="sub">${t.preview}</small></div>`).join('')}
      </div>
      <div class="card" id="conv"><h3>Conversation</h3><div id="msgs"></div>
        <div class="toolbar"><input id="msgInput" class="input" placeholder="Type message..."/><button id="sendMsg" class="button">Send</button></div>
      </div>
      <div class="card"><h3>Contact</h3>
        <p><b>Name:</b> John Doe</p>
        <p><b>Tags:</b> <span class="badge">VIP</span></p>
        <p><b>Last Interaction:</b> 2 days ago</p>
      </div>
    </section>
  `;
  function openThread(id){
    $$(".thread").forEach(el=>el.classList.toggle('active', el.dataset.thread===id));
    const t = threads.find(x=>x.id===id);
    if(!t) return;
    $("#msgs").innerHTML = t.messages.map(m=>`<p><b>${m.from}:</b> ${m.text}</p>`).join('');
    $("#sendMsg").onclick = ()=>{
      const v = $("#msgInput").value.trim();
      if(!v) return;
      t.messages.push({from:"AI", text:v});
      $("#msgInput").value='';
      openThread(id);
      toast("Message sent");
    };
  }
  openThread(threads[0].id);
  $$(".thread").forEach(el=>el.onclick=()=>openThread(el.dataset.thread));
}

function renderFlow(){
  $("#view").innerHTML = `
    <section class="card">
      <h3>Call Flow (mock)</h3>
      <div class="flow">
        <div class="node">Start</div>
        <div class="connector" style="grid-column: span 8"></div>
        <div class="node">Greeting</div>
        <div class="node">Language Detect</div>
        <div class="connector" style="grid-column: span 8"></div>
        <div class="node">Intent Detect</div>
        <div class="node">Consent</div>
        <div class="connector" style="grid-column: span 8"></div>
        <div class="node">Booking</div>
        <div class="node">Fallback → Human</div>
      </div>
      <div class="toolbar">
        <button class="button" onclick="toast('Saved draft v2')">Save Draft</button>
        <button class="button" onclick="toast('Published flow v2')">Publish</button>
      </div>
    </section>
  `;
}

function renderNumbers(){
  const rows = state.data.numbers.map(n=>`
    <tr><td>${n.number}</td><td>${n.country}</td><td>${n.status}</td><td>${n.routing}</td><td>${n.calls}</td></tr>
  `).join('');
  $("#view").innerHTML = `
    <section class="card">
      <h3>Numbers & Routing</h3>
      <p class="sub">Forward your calls to the number we provide and we'll deal with the rest.</p>
      <table class="table">
        <thead><tr><th>Number</th><th>Country</th><th>Status</th><th>Routing</th><th>Calls MTD</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="toolbar">
        <button class="button" onclick="toast('Buy Number wizard…')">Buy Number</button>
        <button class="button" onclick="toast('Porting request created')">Port-in</button>
      </div>
      <div class="card" style="margin-top:12px">
        <h3>Setup Instructions</h3>
        <ol>
          <li>Choose a number above (auto-provisioned via Twilio in production).</li>
          <li>In your carrier portal, set call forwarding to this number.</li>
          <li>HannahAI will answer and route per your AI flow.</li>
        </ol>
      </div>
    </section>
  `;
}

function renderReports(){
  const root = $("#view");
  root.innerHTML = `
    <section class="section">
      <div class="card">
        <h3>Today's Activity</h3>
        <div class="grid kpis">
          <div class="card"><h3>Calls Today</h3><div id="kpiCallsToday" class="kpi-value">0</div></div>
          <div class="card"><h3>Live Calls</h3><div id="kpiLiveCalls" class="kpi-value">0</div></div>
          <div class="card"><h3>SMS Sent Today</h3><div id="kpiSmsToday" class="kpi-value">0</div></div>
          <div class="card"><h3>Last Updated</h3><div id="kpiUpdated" class="kpi-value"><small class="mono">—</small></div></div>
        </div>
      </div>
    </section>
    <section class="card">
      <div class="toolbar">
        <label>Frequency
          <select id="freq" class="select">
            <option value="hourly">Hourly</option>
            <option value="daily" selected>Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annually">Annually</option>
          </select>
        </label>
        <label>Filter
          <select id="range" class="select">
            <option value="today" selected>Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this_week">This Week</option>
            <option value="last_week">Last Week</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="custom">Custom Range…</option>
          </select>
        </label>
        <input id="fromDate" class="input" type="date" style="display:none"/>
        <input id="toDate" class="input" type="date" style="display:none"/>
        <span class="right"></span>
        <button id="updateNow" class="button">Update Now</button>
      </div>
      <div class="grid" style="grid-template-columns: 1fr 1fr">
        <div class="card"><h3>Volume</h3>
          <canvas id="rep1" height="120"></canvas>
        </div>
        <div class="card"><h3>Outcomes</h3><canvas id="rep2" height="120"></canvas></div>
      </div>
    </section>
  `;

  function generateData(freq, range, from, to){
    const labels = [];
    const points = [];
    const n = freq==='hourly' ? 24 : freq==='daily' ? 30 : freq==='weekly' ? 12 : freq==='monthly' ? 12 : freq==='quarterly' ? 8 : 5;
    for(let i=n-1;i>=0;i--){ labels.push(`${i}`); points.push(Math.floor(50 + Math.random()*150)); }
    return { labels, points, outcomes:[38,22,26,14], kpis:{calls: Math.floor(Math.random()*200), live: Math.floor(Math.random()*8), sms: Math.floor(Math.random()*60)} };
  }

  function refresh(){
    const freq = (document.getElementById('freq').value);
    const range = (document.getElementById('range').value);
    const from = document.getElementById('fromDate').value || null;
    const to = document.getElementById('toDate').value || null;
    const gen = generateData(freq, range, from, to);

    document.getElementById('kpiCallsToday').textContent = gen.kpis.calls;
    document.getElementById('kpiLiveCalls').textContent = gen.kpis.live;
    document.getElementById('kpiSmsToday').textContent = gen.kpis.sms;
    document.getElementById('kpiUpdated').innerHTML = `<small class="mono">${new Date().toLocaleString()}</small>`;

    const r1 = document.getElementById('rep1').getContext('2d');
    charts.rep1 && charts.rep1.destroy();
    charts.rep1 = new Chart(r1, {type:'line', data:{labels:gen.labels, datasets:[{label:'Calls', data:gen.points}]},
      options:{plugins:{legend:{labels:{color:cssVar('--text')}}}, scales:{x:{ticks:{color:cssVar('--sub')}, grid:{color:cssVar('--grid')}}, y:{ticks:{color:cssVar('--sub')}, grid:{color:cssVar('--grid')}}}}});
    const r2 = document.getElementById('rep2').getContext('2d');
    charts.rep2 && charts.rep2.destroy();
    charts.rep2 = new Chart(r2, {type:'pie', data:{labels:['Booked','Message','Escalated','Missed'], datasets:[{data:gen.outcomes}]}});
  }

  document.getElementById('range').addEventListener('change', (e)=>{
    const custom = e.target.value === 'custom';
    document.getElementById('fromDate').style.display = custom ? '' : 'none';
    document.getElementById('toDate').style.display = custom ? '' : 'none';
    refresh();
  });
  document.getElementById('freq').addEventListener('change', refresh);
  document.getElementById('fromDate').addEventListener('change', refresh);
  document.getElementById('toDate').addEventListener('change', refresh);
  document.getElementById('updateNow').addEventListener('click', refresh);
  refresh();
}

function renderBilling(){
  const u = state.data.usage;
  const pct = (v,lim)=>Math.round(v/lim*100);
  $("#view").innerHTML = `
    <section class="grid" style="grid-template-columns: 1fr 1fr">
      <div class="card">
        <h3>Plan</h3>
        <p><b>Business Pro</b> – £199/mo</p>
        <p>Minutes: ${u.minutes} / ${u.minutes_limit} <span class="badge ${pct(u.minutes,u.minutes_limit)>85?'warn':'good'}">${pct(u.minutes,u.minutes_limit)}%</span></p>
        <p>Numbers: ${u.numbers} / ${u.numbers_limit}</p>
        <p>Storage: ${u.storage} GB / ${u.storage_limit} GB</p>
        <div class="toolbar">
          <button class="button" onclick="toast('Plan upgraded')">Upgrade</button>
          <button class="button" onclick="toast('Payment method updated')">Update Card</button>
        </div>
      </div>
      <div class="card">
        <h3>Invoices</h3>
        <table class="table">
          <thead><tr><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>${state.data.invoices.map(i=>`<tr><td>${i.date}</td><td>${i.amount}</td><td>${i.status}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderDevelopers(){
  $("#view").innerHTML = `
    <section class="card">
      <h3>API Keys</h3>
      <div class="toolbar">
        <button class="button" id="newKey">Generate New Key</button>
      </div>
      <table class="table" id="keysTable"><thead><tr><th>Key</th><th>Created</th></tr></thead><tbody></tbody></table>
      <p><small class="mono">Webhooks:</small> <code class="inline">/webhooks/call.started</code>, <code class="inline">/webhooks/booking.created</code></p>
    </section>
  `;
  const tbody = $("#keysTable tbody");
  const keys = [];
  function addKey(){
    const key = "sk_" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const row = `<tr><td><code class="inline">${key}</code></td><td>${new Date().toLocaleString()}</td></tr>`;
    keys.push(key);
    tbody.insertAdjacentHTML('afterbegin', row);
  }
  $("#newKey").onclick = ()=>{ addKey(); toast("New API key created"); };
  addKey();
}

function renderContacts(){
  $("#view").innerHTML = `
    <section class="card">
      <h3>Contacts</h3>
      <table class="table">
        <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Tags</th><th>Last</th></tr></thead>
        <tbody>${state.data.contacts.map(c=>`<tr><td>${c.name}</td><td>${c.phone}</td><td>${c.email}</td><td>${c.tags}</td><td>${c.last}</td></tr>`).join('')}</tbody>
      </table>
    </section>
  `;
}

function renderBookings(){
  $("#view").innerHTML = `
    <section class="card">
      <h3>Bookings</h3>
      <table class="table">
        <thead><tr><th>When</th><th>Name</th><th>Type</th><th>Status</th></tr></thead>
        <tbody>${state.data.bookings.map(b=>`<tr><td>${b.when}</td><td>${b.name}</td><td>${b.type}</td><td>${b.status}</td></tr>`).join('')}</tbody>
      </table>
    </section>
  `;
}

function renderIntegrations(){
  $("#view").innerHTML = `
    <section class="grid" style="grid-template-columns: repeat(3, 1fr)">
      ${[
        {name:'Cal.com', status:'Connected'},
        {name:'Google Calendar', status:'Connected'},
        {name:'HubSpot', status:'Not connected'},
        {name:'Salesforce', status:'Not connected'},
        {name:'Twilio', status:'Connected'},
        {name:'Telnyx', status:'Not connected'}
      ].map(app=>`
        <div class="card">
          <h3>${app.name}</h3>
          <p>Status: <span class="badge ${app.status==='Connected'?'good':'warn'}">${app.status}</span></p>
          <div class="toolbar">
            <button class="button" onclick="toast('${app.name} settings opened')">Open</button>
            <button class="button" onclick="toast('${app.name} ${app.status==='Connected'?'disconnected':'connected'}')">${app.status==='Connected'?'Disconnect':'Connect'}</button>
          </div>
        </div>
      `).join('')}
    </section>
  `;
}

function renderSecurity(){
  $("#view").innerHTML = `
    <section class="card">
      <h3>Security & Compliance</h3>
      <div class="toolbar">
        <label>Data Residency <select class="select"><option>UK</option><option>EU</option><option>US</option></select></label>
        <label>Retention <select class="select"><option>90 days</option><option>180 days</option><option>365 days</option></select></label>
        <button class="button" onclick="toast('Settings saved')">Save</button>
      </div>
      <p><small class="mono">DPA & SCCs available for download in a real product.</small></p>
    </section>
  `;
}

function renderQA(){
  $("#view").innerHTML = `
    <section class="card">
      <h3>Quality Reviews</h3>
      <table class="table">
        <thead><tr><th>Call ID</th><th>Score</th><th>Sentiment</th><th>Notes</th></tr></thead>
        <tbody>${state.data.qa.map(q=>`<tr><td>${q.id}</td><td>${q.score}</td><td>${q.sentiment}</td><td>${q.notes}</td></tr>`).join('')}</tbody>
      </table>
    </section>
  `;
}


function renderSettings(){
  const tabs = [
    {id:'ai', name:'AI Assistant'},
    {id:'numbers', name:'Numbers'},
    {id:'integrations', name:'Integrations'},
    {id:'security', name:'Security & Compliance'}
  ];
  const root = $("#view");
  root.innerHTML = `
    <section class="card"><h3>Settings</h3>
      <p class="sub">Configure your assistant and account. Lorem ipsum dolor sit amet.</p>
      <div class="tabs" id="settingsTabs">
        ${tabs.map(t=>`<div class="tab" data-tab="${t.id}">${t.name}</div>`).join('')}
      </div>
      <div id="settingsBody"></div>
    </section>
  `;
  function openTab(id){
    $$("#settingsTabs .tab").forEach(el=>el.classList.toggle('active', el.dataset.tab===id));
    const body = $("#settingsBody");
    switch(id){
      case 'ai': return renderAISettings(body);
      case 'numbers': return renderNumbersInto(body);
      case 'integrations': return renderIntegrationsInto(body);
      case 'security': return renderSecurityInto(body);
    }
  }
  // helpers to mount existing renders into a container
  function renderNumbersInto(el){
    const rows = state.data.numbers.map(n=>`
      <tr><td>${n.number}</td><td>${n.country}</td><td>${n.status}</td><td>${n.routing}</td><td>${n.calls}</td></tr>
    `).join('');
    el.innerHTML = `
      <div class="card">
        <h3>Numbers & Routing</h3>
        <p class="sub">Forward your calls to the number we provide and we'll deal with the rest.</p>
        <table class="table">
          <thead><tr><th>Number</th><th>Country</th><th>Status</th><th>Routing</th><th>Calls MTD</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="toolbar">
          <button class="button" onclick="toast('Buy Number wizard…')">Buy Number</button>
          <button class="button" onclick="toast('Porting request created')">Port-in</button>
        </div>
        <div class="card" style="margin-top:12px">
          <h3>Setup Instructions</h3>
          <ol>
            <li>Choose a number above (auto-provisioned via Twilio in production).</li>
            <li>In your carrier portal, set call forwarding to this number.</li>
            <li>HannahAI will answer and route per your AI flow.</li>
          </ol>
        </div>
      </div>
    `;
  }
  
  function renderIntegrationsInto(el){
    el.innerHTML = `
      <div class="grid" style="grid-template-columns: 1fr 1fr">
        <div class="card">
          <h3>Twilio</h3>
          <div class="toolbar"><input class="input" placeholder="Account SID"/></div>
          <div class="toolbar"><input class="input" type="password" placeholder="Auth Token"/></div>
          <div class="toolbar"><button class="button">Connect</button></div>
          <p class="sub">Voice calls, SMS, phone number provisioning.</p>
        </div>
        <div class="card">
          <h3>ElevenLabs</h3>
          <div class="toolbar"><input class="input" type="password" placeholder="API Key"/></div>
          <div class="toolbar"><select class="select"><option>Voice Model</option><option>Rachel</option><option>Domi</option></select></div>
          <div class="toolbar"><button class="button">Connect</button></div>
          <p class="sub">AI voice synthesis and conversation.</p>
        </div>
      </div>
      <div class="grid" style="grid-template-columns: 1fr 1fr; margin-top:12px">
        <div class="card">
          <h3>CRM</h3>
          <div class="toolbar"><select class="select"><option>Select CRM</option><option>Salesforce</option><option>HubSpot</option><option>Pipedrive</option></select></div>
          <div class="toolbar"><input class="input" type="password" placeholder="API Key"/></div>
          <div class="toolbar"><button class="button">Connect</button></div>
        </div>
        <div class="card">
          <h3>Calendar</h3>
          <div class="toolbar"><select class="select"><option>Select Calendar</option><option>Google Calendar</option><option>Outlook</option><option>Calendly</option></select></div>
          <div class="toolbar"><button class="button">Connect with OAuth</button></div>
          <p class="sub">For appointment booking and scheduling.</p>
        </div>
      </div>
    `;
  }
  
  function renderBillingInto(el){
    const invoices = state.data.invoices.map(i=>`
      <tr><td>${i.date}</td><td>${i.amount}</td><td><span class="badge ${i.status==='paid'?'':'bad'}">${i.status}</span></td><td><a href="#" class="button">Download</a></td></tr>
    `).join('');
    el.innerHTML = `
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
          <tbody>${invoices}</tbody>
        </table>
      </div>
    `;
  }
  
  function renderSecurityInto(el){
    el.innerHTML = `
      <div class="grid" style="grid-template-columns: 1fr 1fr">
        <div class="card">
          <h3>Access Control</h3>
          <div class="toolbar"><label><input type="checkbox" checked/> Require 2FA for all users</label></div>
          <div class="toolbar"><label><input type="checkbox"/> IP allowlist</label></div>
          <div class="toolbar"><label><input type="checkbox" checked/> Session timeout (30 min)</label></div>
          <div class="toolbar"><button class="button">Save Settings</button></div>
        </div>
        <div class="card">
          <h3>Data & Compliance</h3>
          <div class="toolbar"><label><input type="checkbox" checked/> GDPR compliance mode</label></div>
          <div class="toolbar"><label><input type="checkbox" checked/> Call recording consent</label></div>
          <div class="toolbar"><label><input type="checkbox"/> Data retention (90 days)</label></div>
          <div class="toolbar"><button class="button">Export Data</button></div>
        </div>
      </div>
      <div class="card" style="margin-top:12px">
        <h3>API Keys</h3>
        <div class="toolbar">
          <input class="input" value="sk_live_..." readonly style="flex:1"/>
          <button class="button">Regenerate</button>
        </div>
        <p class="sub">Use this key to access the HannahAI API from your applications.</p>
      </div>
    `;
  }
  function renderAISettings(el){
    el.innerHTML = `
      <div class='card'>
        <h3>Assistant Identity</h3>
        <div class='toolbar'>
          <label for='ai_name' style='display:block; margin-bottom:4px; font-weight:500;'>Assistant Name</label>
          <input class='input' id='ai_name' placeholder="Assistant's name (e.g., Hannah)"/>
        </div>
        <div class='toolbar'>
          <label for='ai_greeting' style='display:block; margin-bottom:4px; font-weight:500;'>Welcome Greeting</label>
          <input class='input' id='ai_greeting' placeholder='Welcome greeting' />
        </div>
        <div class='toolbar'>
          <label for='ai_email' style='display:block; margin-bottom:4px; font-weight:500;'>Contact Email</label>
          <input class='input' id='ai_email' placeholder='Contact email' />
        </div>
        <div class='toolbar'>
          <label for='ai_phone' style='display:block; margin-bottom:4px; font-weight:500;'>Contact Phone</label>
          <input class='input' id='ai_phone' placeholder='Contact phone' />
        </div>
        <div class='toolbar'>
          <label for='ai_fax' style='display:block; margin-bottom:4px; font-weight:500;'>Fax (Optional)</label>
          <input class='input' id='ai_fax' placeholder='Fax (optional)' />
        </div>
        <div class='toolbar'>
          <label for='ai_website' style='display:block; margin-bottom:4px; font-weight:500;'>Website URL</label>
          <input class='input' id='ai_website' placeholder='Website URL' />
        </div>
        <div class='toolbar'>
          <label for='ai_address' style='display:block; margin-bottom:4px; font-weight:500;'>Business Address</label>
          <input class='input' id='ai_address' placeholder='Business address' />
        </div>
        <div class='toolbar'><button class='button' id='saveAI'>Save Settings</button></div>
        <p class='sub'>These values will be used by your AI during calls and messages.</p>
      </div>
    `;
    document.getElementById('saveAI').onclick=()=>toast('AI settings saved');
  }
  // default tab or nextSettingsTab if coming from numbers route
  openTab(nextSettingsTab || 'ai');
  nextSettingsTab = null; // Reset after use
  $$("#settingsTabs .tab").forEach(el=>el.onclick=()=>openTab(el.dataset.tab));
}


function renderPlaceholder(title){
  $("#view").innerHTML = `<section class="card"><h3>${title}</h3><p>Demo placeholder.</p></section>`;
}

function render(){
  setActiveNav();
  switch(state.route){
    case 'overview': return renderOverview();
    case 'calls': return renderCalls();
    case 'inbox': return renderInbox();
    case 'contacts': return renderContacts();
    case 'bookings': return renderBookings();
    case 'knowledge': return renderPlaceholder('Knowledge & Scripts');
    case 'flow': return renderFlow();
    case 'numbers': return renderNumbers();
    case 'ai': return renderPlaceholder('AI Settings');
    case 'integrations': return renderIntegrations();
    case 'analytics': return renderReports();
    case 'qa': return renderQA();
    case 'team': return renderPlaceholder('Team & Roles');
    case 'billing': return renderBilling();
    case 'developers': return renderDevelopers();
    case 'security': return renderSecurity();
    case 'onboarding': return renderPlaceholder('Onboarding Checklist');
    case 'support': return renderPlaceholder('Support & Status');
    case 'settings': return renderSettings();
  }
}

/* Toasts */
let toastTimer=null;
function toast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.style.display='block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.style.display='none', 1800);
}

/* Boot */
function bootApp(){
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);
  const tog = document.getElementById('themeToggle');
  if(tog){ tog.checked = (saved==='light'); tog.addEventListener('change', ()=>applyTheme(tog.checked?'light':'dark')); }

  // nav bindings: only intercept if data-route exists
  $$(".nav a").forEach(a=>a.onclick=(e)=>{
    const route = a.dataset.route;
    if(!route) return; // normal navigation for external pages
    e.preventDefault(); navigate(route);
  });

  state.route = (location.hash ? location.hash.replace('#','') : 'overview');
  render();
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}
