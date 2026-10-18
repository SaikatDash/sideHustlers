const $ = (selector) => document.querySelector(selector);
const CATEGORY_COLORS = {Meals:'#7ea88b',Software:'#789bb0',Travel:'#d1a44d',Supplies:'#bd8276',Marketing:'#9c8ab4',Utilities:'#7ea7a2',Other:'#bbc1b5'};
const CURRENCY_LOCALE = {USD:'en-US',INR:'en-IN',EUR:'de-DE',GBP:'en-GB',CAD:'en-CA',AUD:'en-AU',JPY:'ja-JP'};
let expenses = [];
let invoices = [];
let invoiceAnalysis = null;
let selectedInvoiceFile = null;
let invoiceColumnHeaders = [];
let receiptImage = '';
let receiptName = '';
let toastTimer;
let authSetupRequired = false;
let authMode = 'login';
let scanInProgress = false;
let editingExpenseId = null;
let currentDetailItem = null;

function money(value, currency='USD') {
  try { return new Intl.NumberFormat(CURRENCY_LOCALE[currency] || 'en-US', {style:'currency', currency, minimumFractionDigits:2, maximumFractionDigits:2}).format(value); }
  catch { return `${currency} ${Number(value).toFixed(2)}`; }
}
function localDateString(date=new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime()-offset).toISOString().slice(0,10);
}
function monthKey(date) { return String(date || '').slice(0,7); }
function monthLabel(key, short=false) {
  const [year, month] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en', {month:short?'short':'long', ...(short?{}:{year:'numeric'})}).format(new Date(year, month-1, 1));
}
function displayDate(value) {
  if (!value) return 'Date not set';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en', {month:'short', day:'numeric', year:'numeric'}).format(new Date(year,month-1,day));
}
function toast(message) {
  const node = $('#toast'); node.textContent = message; node.classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('visible'), 2900);
}
async function request(url, options={}) {
  const response = await fetch(url, options);
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const result = isJson ? await response.json() : null;
  if (!response.ok) {
    if (response.status === 401 && !url.startsWith('/api/auth/')) showAuth(false);
    const message=result?.detail||result?.error||(response.status>=500?`The app could not complete that request (server error ${response.status}). Please try again.`:`The request could not be completed (error ${response.status}). Check your details and try again.`);
    throw new Error(message);
  }
  return result;
}
function selectedCurrency(rows) {
  const counts = new Map();
  for (const row of rows) counts.set(row.currency || 'USD', (counts.get(row.currency || 'USD') || 0) + 1);
  return [...counts].sort((a,b) => b[1]-a[1])[0]?.[0] || 'USD';
}
function renderStats() {
  const nowKey = localDateString().slice(0,7);
  const currency = selectedCurrency(expenses);
  const currentRows = expenses.filter(item => monthKey(item.spent_on) === nowKey && (item.currency || 'USD') === currency);
  const total = currentRows.reduce((sum,item) => sum + Number(item.amount), 0);
  $('#stat-total').textContent = money(total, currency);
  $('#stat-month').textContent = `${currency} · ${monthLabel(nowKey)}`;
  $('#stat-receipts').textContent = expenses.length;
  const counts = new Map();
  for (const item of expenses) counts.set(item.category, (counts.get(item.category) || 0) + 1);
  const topCategory = [...counts].sort((a,b) => b[1]-a[1])[0];
  $('#stat-category').textContent = topCategory?.[0] || '—';
  $('#stat-category-note').textContent = topCategory ? `${topCategory[1]} ${topCategory[1]===1?'expense':'expenses'} logged` : 'See where it goes';
  const extraCurrencies = new Set(expenses.map(item => item.currency || 'USD')).size - (expenses.length ? 1 : 0);
  $('#chart-total').innerHTML = `${money(total,currency)} <small>${currency} · this month</small>`;
  $('#nav-count').textContent = expenses.length;
  $('#list-count').textContent = expenses.length;
  $('#showing-count').textContent = `Showing ${expenses.length} ${expenses.length===1?'expense':'expenses'}`;
  $('#table-bottom').style.display = expenses.length ? 'flex' : 'none';
  $('#empty-ledger').style.display = expenses.length ? 'none' : 'block';
  $('#stat-month').title = extraCurrencies > 0 ? `${extraCurrencies} other currencies are listed separately; no exchange rates are applied.` : 'No currency conversion is applied.';
  renderChart(currency, nowKey);
  renderCategories();
}
function renderChart(currency, currentKey) {
  const [year, month] = currentKey.split('-').map(Number);
  const months = Array.from({length:6},(_,i) => {
    const d = new Date(year,month-6+i,1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const totals = months.map(key => expenses.filter(item => monthKey(item.spent_on)===key && (item.currency||'USD')===currency).reduce((sum,item)=>sum+Number(item.amount),0));
  const max = Math.max(...totals,1)*1.18;
  const width=600,height=132,left=15,right=15,top=9,bottom=12;
  const x = i => left+i*(width-left-right)/(months.length-1);
  const y = n => top+(height-top-bottom)*(1-n/max);
  const points = totals.map((v,i)=>[x(i),y(v)]);
  const line = points.map((p,i)=>`${i?'L':'M'} ${p[0]} ${p[1]}`).join(' ');
  const area = `${line} L ${points.at(-1)[0]} ${height-bottom} L ${points[0][0]} ${height-bottom} Z`;
  const grid = [0.25,0.5,0.75,1].map(f => `<line class="chart-gridline" x1="${left}" y1="${y(max*f)}" x2="${width-right}" y2="${y(max*f)}"/>`).join('');
  const dots = points.map(([cx,cy],i)=>`<circle class="chart-point" cx="${cx}" cy="${cy}" r="${i===5?4:3}"/>`).join('');
  $('#chart-wrap').innerHTML = expenses.length
    ? `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Expenses in ${currency} by month for the past six months"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#83ac91" stop-opacity=".2"/><stop offset="100%" stop-color="#83ac91" stop-opacity="0"/></linearGradient></defs>${grid}<path class="chart-area" d="${area}"/><path class="chart-line" d="${line}"/>${dots}</svg>`
    : '<div class="empty-chart"><span class="empty-chart-icon">⌁</span><span>Your spending will take shape here.</span><small>Add an expense to get started.</small></div>';
  $('#chart-months').innerHTML = months.map(key => `<span>${monthLabel(key,true)}</span>`).join('');
}
function renderCategories() {
  const sums = new Map();
  for (const row of expenses) sums.set(row.category, (sums.get(row.category)||0)+1);
  const entries = [...sums].sort((a,b)=>b[1]-a[1]);
  const palette = entries.map(([name])=>CATEGORY_COLORS[name]||CATEGORY_COLORS.Other);
  const all = entries.reduce((sum,[,amount])=>sum+amount,0);
  let cursor = 0;
  const segments = entries.map(([,amount],i)=>{
    const start=cursor; cursor+=all ? amount/all*100 : 0;
    return `${palette[i]} ${start}% ${cursor}%`;
  });
  $('#donut').style.background = entries.length ? `conic-gradient(${segments.join(',')})` : 'conic-gradient(#e9eee8 0 100%)';
  $('#category-count').textContent = entries.length;
  $('#category-legend').innerHTML = entries.length
    ? entries.slice(0,6).map(([name,count],i)=>`<div class="category-legend-item"><i style="background:${palette[i]}"></i><span>${escapeHtml(name)}</span><strong>${all?Math.round(count/all*100):0}%</strong></div>`).join('')
    : '<div class="category-empty">Your categories appear as you add expenses.</div>';
}
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function initials(value) { return String(value||'?').trim().split(/\s+/).slice(0,2).map(part=>part[0]?.toUpperCase()||'').join(''); }
function renderExpenses() {
  const query = $('#search').value.trim().toLowerCase();
  const rows = expenses.filter(item => [item.vendor,item.category,item.description,item.spent_on].some(value => String(value||'').toLowerCase().includes(query)));
  $('#expense-rows').innerHTML = rows.slice(0,12).map(item=>`<tr class="expense-row" data-expense-id="${Number(item.id)}"><td><button type="button" class="merchant-open" data-open="${Number(item.id)}" aria-label="View receipt and details for ${escapeHtml(item.vendor)}"><span class="merchant"><span class="merchant-mark">${escapeHtml(initials(item.vendor))}</span><span class="merchant-meta">${escapeHtml(item.vendor)}<small class="${item.needs_review?'review-row-label':''}">${escapeHtml(item.needs_review?'Needs your review':item.client_name || item.source_name || 'View details')}</small></span></span></button></td><td>${escapeHtml(displayDate(item.spent_on))}</td><td><span class="category-tag">${escapeHtml(item.category)}</span></td><td class="note-cell">${escapeHtml(item.description || '—')}${item.is_deductible?'<span class="deductible-mark" title="Marked business deductible">◆ deductible</span>':''}</td><td class="amount-cell">${escapeHtml(money(Number(item.amount),item.currency||'USD'))}</td><td><button class="row-delete" data-delete="${Number(item.id)}" title="Delete expense" aria-label="Delete ${escapeHtml(item.vendor)} expense">×</button></td></tr>`).join('');
  if (expenses.length && query && rows.length===0) $('#expense-rows').innerHTML = '<tr><td colspan="6" class="no-results">No expenses match that search.</td></tr>';
}
function refresh() { renderStats(); renderExpenses(); }
async function loadExpenses() {
  try { expenses = await request('/api/expenses'); refresh(); }
  catch(error) { toast(error.message); }
}
function renderInvoices() {
  const analysis=invoiceAnalysis||{invoice_count:0,totals:{},clients:[]};
  const formatTotals=totals=>Object.entries(totals||{}).map(([currency,value])=>money(Number(value),currency)).join(' · ')||money(0,'USD');
  $('#invoice-nav-count').textContent=invoices.length;
  $('#invoice-list-count').textContent=invoices.length;
  $('#invoice-total').textContent=formatTotals(analysis.totals?.billed);
  $('#invoice-paid').textContent=formatTotals(analysis.totals?.paid);
  $('#invoice-outstanding').textContent=formatTotals(analysis.totals?.outstanding);
  $('#invoice-overdue').textContent=formatTotals(analysis.totals?.overdue);
  const clientsByCurrency=new Map();
  for(const client of analysis.clients||[]){const currency=client.currency||'USD';if(!clientsByCurrency.has(currency))clientsByCurrency.set(currency,[]);clientsByCurrency.get(currency).push(client);}
  $('#client-invoice-chart').innerHTML=clientsByCurrency.size?[...clientsByCurrency].map(([currency,clients])=>{
    const chartClients=clients.sort((a,b)=>Number(b.billed)-Number(a.billed)).slice(0,6);
    const highestBill=Math.max(...chartClients.map(client=>Number(client.billed)||0),1);
    const rows=chartClients.map(client=>{
      const billed=Math.max(0,Number(client.billed)||0),paid=Math.min(billed,Math.max(0,Number(client.paid)||0));
      const overdue=Math.min(billed-paid,Math.max(0,Number(client.overdue)||0));
      const due=Math.max(0,billed-paid-overdue),width=amount=>highestBill?amount/highestBill*100:0;
      return `<div class="client-chart-row"><div class="client-chart-label"><span>${escapeHtml(client.client_name)}</span><strong>${escapeHtml(money(billed,currency))}</strong></div><div class="client-chart-track" role="img" aria-label="${escapeHtml(client.client_name)}: ${escapeHtml(money(paid,currency))} paid, ${escapeHtml(money(due,currency))} due, ${escapeHtml(money(overdue,currency))} overdue"><i class="chart-paid" style="width:${width(paid)}%"></i><i class="chart-due" style="width:${width(due)}%"></i><i class="chart-overdue" style="width:${width(overdue)}%"></i></div><div class="client-chart-axis"><span>Paid ${escapeHtml(money(paid,currency))}</span><span>${Math.round(billed/highestBill*100)}% of largest ${escapeHtml(currency)} client</span></div></div>`;
    }).join('');
    return `<section class="client-chart-currency"><strong>${escapeHtml(currency)}</strong>${rows}</section>`;
  }).join(''):'<div class="client-analysis-empty"><small>Import invoices to see payment progress by client.</small></div>';
  $('#client-analysis-list').innerHTML=analysis.clients?.length?analysis.clients.map(client=>`<article class="client-analysis-row"><span class="client-avatar">${escapeHtml(initials(client.client_name))}</span><div class="client-analysis-name"><strong>${escapeHtml(client.client_name)}</strong><small>${client.invoice_count} ${client.invoice_count===1?'invoice':'invoices'} · ${escapeHtml(client.currency)}</small></div><div class="client-analysis-amount"><strong>${escapeHtml(money(client.billed,client.currency))}</strong><small>${escapeHtml(money(client.outstanding,client.currency))} due</small></div></article>`).join(''):'<div class="client-analysis-empty"><span>◷</span><strong>Your client summary will appear here</strong><small>Import invoices to see who you billed and what is still outstanding.</small></div>';
  $('#invoice-rows').innerHTML=invoices.map(item=>`<tr class="invoice-row" data-invoice-id="${Number(item.id)}" tabindex="0" aria-label="View invoice ${escapeHtml(item.invoice_number||'details')} for ${escapeHtml(item.client_name)}"><td><strong>${escapeHtml(item.client_name)}</strong><small class="invoice-description">${escapeHtml(item.description||item.source_name||'')}</small></td><td>${escapeHtml(item.invoice_number||'—')}</td><td>${escapeHtml(item.invoice_date?displayDate(item.invoice_date):'—')}</td><td>${escapeHtml(item.due_date?displayDate(item.due_date):'—')}</td><td><span class="invoice-status status-${escapeHtml(item.status.toLowerCase())}">${escapeHtml(item.status)}${item.needs_review?' · Review':''}</span></td><td class="amount-cell">${escapeHtml(money(Number(item.amount),item.currency||'USD'))}</td><td><button class="row-delete" data-invoice-delete="${Number(item.id)}" title="Delete invoice" aria-label="Delete invoice for ${escapeHtml(item.client_name)}">×</button></td></tr>`).join('');
  $('#invoice-empty').hidden=invoices.length>0;
}
async function loadInvoices() {
  try { [invoices,invoiceAnalysis]=await Promise.all([request('/api/invoices'),request('/api/invoices/analysis')]);renderInvoices(); }
  catch(error) { toast(error.message); }
}
function chooseInvoiceFile(file) {
  if(!file)return;
  selectedInvoiceFile=file;
  invoiceColumnHeaders=[];
  $('#invoice-file-name').textContent=file.name;
  $('#invoice-file-preview').hidden=false;
  $('#invoice-column-mapping').hidden=true;
  $('#invoice-column-mapping').innerHTML='';
  $('#invoice-upload-button').disabled=false;
  $('#invoice-upload-button').innerHTML='Analyze and save invoices <span>↗</span>';
  $('#invoice-upload-message').textContent=`Ready to read ${file.name}. Saved invoice details will appear in your client list.`;
  $('#invoice-dropzone').classList.add('has-file');
}
function showInvoiceColumnMapping(result) {
  invoiceColumnHeaders=result.headers||[];
  const names={client_name:'Client name',amount:'Invoice amount',invoice_number:'Invoice number',invoice_date:'Invoice date',due_date:'Due date',currency:'Currency',status:'Payment status',description:'Description'};
  const aliases={client_name:['client name','client project','client','customer','party','buyer','bill to','billed to','project name','project client','company name','recipient'],amount:['invoice amount','invoice total','grand total','total amount','amount due','balance due','amount','total','payable','value','price'],invoice_number:['invoice number','invoice no','invoice id','invoice ref','bill no','reference','ref no'],invoice_date:['invoice date','issue date','billing date','bill date','date'],due_date:['due date','payment due','deadline'],currency:['currency code','currency'],status:['payment status','invoice status','status'],description:['description','particulars','service','project','item','details']};
  const normalize=header=>String(header||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const suggested={...(result.suggested_mapping||{})};
  for(const field of Object.keys(names)){
    if(invoiceColumnHeaders.includes(suggested[field]))continue;
    const normalizedHeaders=invoiceColumnHeaders.map(header=>[header,normalize(header)]);
    const hints=(aliases[field]||[]).map(normalize);
    const match=normalizedHeaders.find(([,header])=>hints.includes(header))||normalizedHeaders.find(([,header])=>[...hints].sort((a,b)=>b.length-a.length).some(hint=>header.includes(hint)));
    if(match)suggested[field]=match[0];
  }
  const required=new Set(['client_name','amount']);
  $('#invoice-column-mapping').innerHTML=`<div class="mapping-heading"><strong>Check the column matches</strong><small>We recognized these headings. Confirm the client and amount columns, then save. Other fields are optional.</small></div><div class="mapping-grid">${Object.entries(names).map(([field,label])=>`<label>${label}${required.has(field)?' <b>required</b>':''}<select data-invoice-column="${field}"><option value="">Choose a column${required.has(field)?'':' (optional)'}</option>${invoiceColumnHeaders.map(header=>`<option value="${escapeHtml(header)}" ${suggested[field]===header?'selected':''}>${escapeHtml(header)}</option>`).join('')}</select></label>`).join('')}</div><p class="mapping-preview">Example data: ${escapeHtml((result.preview||[]).slice(0,2).map(row=>row.join(' · ')).join(' | '))}</p>`;
  $('#invoice-column-mapping').hidden=false;
  $('#invoice-upload-button').innerHTML='Save invoices with these columns <span>↗</span>';
}
async function uploadInvoices() {
  if(!selectedInvoiceFile)return;
  const button=$('#invoice-upload-button');button.disabled=true;button.innerHTML='Reading and saving… <span class="invoice-spinner">✳</span>';
  $('#invoice-upload-message').textContent=selectedInvoiceFile.type.startsWith('image/')?'Ollama is reading this invoice image on your computer.':'Ollama is matching spreadsheet columns, then invoice rows are checked and saved.';
  const form=new FormData();form.append('file',selectedInvoiceFile);
  const selectedMapping=Object.fromEntries([...$('#invoice-column-mapping').querySelectorAll('[data-invoice-column]')].filter(select=>select.value).map(select=>[select.dataset.invoiceColumn,select.value]));
  if(Object.keys(selectedMapping).length)form.append('mapping',JSON.stringify(selectedMapping));
  try {
    const result=await request('/api/invoices/import',{method:'POST',body:form});
    if(result.mapping_needed){showInvoiceColumnMapping(result);$('#invoice-upload-message').textContent='We found your invoice rows. Please confirm which columns contain the client and invoice amount.';return;}
    selectedInvoiceFile=null;$('#invoice-file').value='';$('#invoice-file-preview').hidden=true;$('#invoice-dropzone').classList.remove('has-file');
    $('#invoice-column-mapping').hidden=true;$('#invoice-column-mapping').innerHTML='';invoiceColumnHeaders=[];
    await loadInvoices();
    const messages=[`${result.imported} ${result.imported===1?'invoice':'invoices'} saved to your database.`];
    if(result.skipped?.length)messages.push(`${result.skipped.length} row${result.skipped.length===1?'':'s'} skipped.`);
    $('#invoice-upload-message').textContent=messages.join(' ')+(result.skipped?.length?` First skipped row: ${result.skipped[0].reason}`:' Open any invoice to review the extracted details.');
    if(result.imported)toast(`${result.imported} invoice${result.imported===1?'':'s'} added.`);
  } catch(error) { $('#invoice-upload-message').textContent=error.message; }
  finally {button.disabled=!selectedInvoiceFile;button.innerHTML=$('#invoice-column-mapping').hidden?'Analyze and save invoices <span>↗</span>':'Save invoices with these columns <span>↗</span>';}
}
function openInvoiceDetails(id) {
  const item=invoices.find(row=>row.id===id);if(!item)return;
  $('#invoice-detail-dialog').dataset.invoiceId=String(id);
  $('#invoice-detail-title').textContent=item.client_name||'Invoice details';
  const fields=[['Client',item.client_name],['Invoice number',item.invoice_number],['Invoice date',item.invoice_date?displayDate(item.invoice_date):'Not provided'],['Due date',item.due_date?displayDate(item.due_date):'Not provided'],['Amount',money(Number(item.amount),item.currency||'USD')],['Payment status',item.status],['Description',item.description],['Original file',item.source_name]];
  const image=item.has_image?`<figure class="invoice-saved-image"><img src="/api/invoices/${Number(item.id)}/image" alt="Original invoice image"><figcaption>Original image stored in PostgreSQL on this computer.</figcaption></figure>`:`<div class="invoice-source-note"><span>▤</span><strong>Imported from spreadsheet</strong><small>${escapeHtml(item.source_name||'The invoice fields were saved in your database.')}</small></div>`;
  $('#invoice-detail-body').innerHTML=`${image}${item.needs_review?'<p class="needs-review-banner">Some details could not be confirmed. Please check these values against your original invoice.</p>':''}<dl class="detail-list">${fields.map(([label,value])=>detailField(label,value)).join('')}</dl><p class="detail-private">◆ Saved in your local database</p><div class="invoice-detail-actions"><button type="button" class="button button-quiet" id="invoice-edit-trigger">Correct these details</button></div>`;
  $('#invoice-detail-dialog').showModal();
}
function startInvoiceEdit(item) {
  const image=item.has_image?`<figure class="invoice-saved-image"><img src="/api/invoices/${Number(item.id)}/image" alt="Original invoice image"><figcaption>Original image stored in PostgreSQL on this computer.</figcaption></figure>`:'';
  $('#invoice-detail-body').innerHTML=`${image}<form class="invoice-edit-form" id="invoice-edit-form"><label>Client name<input name="client_name" required maxlength="160" value="${escapeHtml(item.client_name)}"></label><label>Invoice number<input name="invoice_number" maxlength="100" value="${escapeHtml(item.invoice_number)}"></label><div class="invoice-edit-row"><label>Invoice date<input name="invoice_date" type="date" value="${escapeHtml(item.invoice_date)}"></label><label>Due date<input name="due_date" type="date" value="${escapeHtml(item.due_date)}"></label></div><div class="invoice-edit-row"><label>Amount<input name="amount" type="number" min="0" step="0.01" required value="${Number(item.amount)||0}"></label><label>Currency<input name="currency" maxlength="3" minlength="3" required value="${escapeHtml(item.currency||'USD')}"></label></div><label>Payment status<select name="status"><option ${item.status==='Unpaid'?'selected':''}>Unpaid</option><option ${item.status==='Paid'?'selected':''}>Paid</option><option ${item.status==='Overdue'?'selected':''}>Overdue</option></select></label><label>Description<input name="description" maxlength="300" value="${escapeHtml(item.description)}"></label><div class="invoice-edit-actions"><button type="button" class="button button-quiet" id="invoice-edit-cancel">Cancel</button><button type="submit" class="button button-primary">Save corrections</button></div></form>`;
}
async function saveInvoiceEdit(event) {
  event.preventDefault();
  const form=event.currentTarget;
  const id=Number($('#invoice-detail-dialog').dataset.invoiceId);
  const values=Object.fromEntries(new FormData(form).entries());
  values.amount=Number(values.amount);values.currency=String(values.currency||'USD').toUpperCase();
  const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='Saving…';
  try { await request(`/api/invoices/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});await loadInvoices();openInvoiceDetails(id);toast('Invoice details updated.'); }
  catch(error) { toast(error.message);button.disabled=false;button.textContent='Save corrections'; }
}
async function updateHealth() {
  try {
    const status=await request('/api/health');
    const chip=$('.local-chip');
    $('#database-status').textContent=`Your data · ${status.database}`;
    $('#ai-panel-model').textContent=status.model_ready?`${status.model} is ready`:status.ollama?`${status.model} needs to be installed`:'Ollama is not running yet';
    $('#ai-ready-dot').classList.toggle('offline',!status.model_ready);
    if(status.model_ready){$('#local-status').textContent=`${status.model} · ready`;chip.classList.remove('offline');}
    else if(status.ollama){$('#local-status').textContent='Local AI · model needed';chip.classList.add('offline');}
    else{$('#local-status').textContent='Local AI · offline';chip.classList.add('offline');}
    $('#help-chat-status').textContent=status.model_ready?'Ollama ready':status.ollama?'Model needed':'AI offline';
    $('#help-chat-status').classList.toggle('offline',!status.model_ready);
  } catch { $('#local-status').textContent='Local AI · unavailable'; $('.local-chip').classList.add('offline');$('#ai-panel-model').textContent='Local AI status unavailable';$('#help-chat-status').textContent='AI unavailable';$('#help-chat-status').classList.add('offline'); }
}
function appendHelpMessage(role,text,sources=[]){
  const article=document.createElement('article');article.className=`help-chat-message ${role}`;
  const paragraph=document.createElement('p');paragraph.textContent=text;article.append(paragraph);
  if(sources.length){const sourceNote=document.createElement('small');sourceNote.className='help-chat-sources';sourceNote.textContent=`Help notes: ${sources.join(' · ')}`;article.append(sourceNote);}
  $('#help-chat-messages').append(article);$('#help-chat-messages').scrollTop=$('#help-chat-messages').scrollHeight;
  return article;
}
let helpChatPending=false;
async function askPocketLedgerHelp(question){
  const cleanQuestion=String(question||'').trim();
  if(!cleanQuestion||helpChatPending)return;
  helpChatPending=true;
  const input=$('#help-chat-input');const send=$('#help-chat-form button[type="submit"]');
  appendHelpMessage('user',cleanQuestion);input.value='';send.disabled=true;
  const pending=appendHelpMessage('assistant pending','Searching the help notes and asking Ollama on this computer…');
  try{
    const result=await request('/api/help/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:cleanQuestion})});
    pending.querySelector('p').textContent=result.answer||'I could not find an answer in the help notes. Try asking about expenses, invoices, or CSV imports.';
    pending.classList.remove('pending');
    if(result.sources?.length){const sourceNote=document.createElement('small');sourceNote.className='help-chat-sources';sourceNote.textContent=`Help notes: ${result.sources.join(' · ')}`;pending.append(sourceNote);}
  }catch(error){pending.querySelector('p').textContent=error.message;pending.classList.remove('pending');}
  finally{helpChatPending=false;send.disabled=false;input.focus();$('#help-chat-messages').scrollTop=$('#help-chat-messages').scrollHeight;}
}
function clearForm() {
  editingExpenseId=null;
  receiptImage=''; receiptName=''; $('#receipt-file').value=''; $('#receipt-image').removeAttribute('src'); $('#receipt-preview').classList.remove('visible'); $('#keep-receipt').checked=true; $('#receipt-text').value='';
  $('#dialog-title').textContent='Add an expense';$('#save-expense').innerHTML='Save expense <span>↗</span>';
  $('#upload-zone strong').textContent='Drop a receipt here';$('#upload-zone small').textContent='Choosing an image starts local analysis and saves a draft automatically.';
  $('#field-vendor').value=''; $('#field-date').value=localDateString(); $('#field-amount').value=''; $('#field-currency').value='USD'; $('#field-category').value='Meals'; $('#field-description').value=''; $('#field-client').value=''; $('#field-deductible').checked=false;
  $('#review-chip').textContent='MANUAL ENTRY'; $('#review-chip').className='review-chip'; $('#extract-note').className='extract-note'; $('#extract-note').innerHTML='<span>✧</span> AI suggests. You stay in control.';
}
function openDialog() { clearForm(); $('#expense-dialog').showModal(); }
function showImage(file) {
  if (!file) return;
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { toast('Choose a JPG, PNG or WEBP receipt image.'); return; }
  if (file.size > 8*1024*1024) { toast('Please choose an image smaller than 8 MB.'); return; }
  const reader = new FileReader();
  reader.onload = () => { receiptImage=String(reader.result); receiptName=file.name; $('#receipt-image').src=receiptImage; $('#receipt-preview').classList.add('visible'); $('#upload-zone strong').textContent=file.name; $('#upload-zone small').textContent='Analyzing with local AI and saving a draft…'; extractReceipt({autoSave:true}); };
  reader.readAsDataURL(file);
}
async function extractReceipt({autoSave=false}={}) {
  if(scanInProgress)return;
  scanInProgress=true;
  $('.close-dialog').disabled=true;
  const button=$('#extract-button'); button.disabled=true; button.innerHTML='<span class="ai-star">✳</span> Reading locally…';
  $('#extract-note').className='extract-note'; $('#extract-note').textContent=autoSave?'Local AI is reading your receipt. It will save a draft automatically.':'Your receipt is being read on this device.';
  let analysisCompleted=false;
  try {
    const fields=await request('/api/extract',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:$('#receipt-text').value,image:receiptImage})});
    analysisCompleted=true;
    $('#field-vendor').value=fields.vendor||'';
    $('#field-date').value=/^\d{4}-\d\d-\d\d$/.test(fields.date||'')?fields.date:'';
    $('#field-amount').value=fields.amount||''; $('#field-currency').value=[...$('#field-currency').options].some(option=>option.value===fields.currency)?fields.currency:'USD';
    $('#field-category').value=[...$('#field-category').options].some(option=>option.value===fields.category)?fields.category:'Other';
    $('#field-description').value=fields.description||'';
    $('#review-chip').textContent=fields.needs_review?'PLEASE REVIEW':'AI DRAFT'; $('#review-chip').className=`review-chip ${fields.needs_review?'check':'ready'}`;
    $('#extract-note').className=`extract-note ${fields.needs_review?'warning':''}`;
    $('#extract-note').textContent=fields.needs_review
      ? `AI finished. Please review the fields${fields.vendor?`: ${fields.vendor}`:''}${Number(fields.amount)>0?` · ${money(Number(fields.amount),fields.currency)}`:''}.`
      : `AI found ${fields.vendor} · ${money(Number(fields.amount),fields.currency)}. Check the details, then save.`;
    $('#field-vendor').focus();
    if(autoSave){
      const data={vendor:fields.vendor||'',date:fields.date||'',amount:Number(fields.amount)||0,currency:fields.currency||'USD',category:fields.category||'Other',description:fields.description||'',source_name:receiptName,keep_receipt:Boolean(receiptImage&&$('#keep-receipt').checked),receipt_image:receiptImage,needs_review:Boolean(fields.needs_review)};
      const item=await request('/api/expenses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      expenses.unshift(item);expenses.sort((a,b)=>String(b.spent_on).localeCompare(String(a.spent_on))||b.id-a.id);refresh();
      $('#expense-dialog').close();
      toast(item.needs_review?'Saved a draft. Open it to review the details.':'Receipt analyzed and saved. Check the details anytime.');
      setTimeout(()=>openExpenseDetails(item.id),180);
    }
  } catch(error) {
    $('#extract-note').className='extract-note warning'; $('#extract-note').textContent=error.message;
    if(autoSave&&!analysisCompleted){
      try{
        const item=await request('/api/expenses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({vendor:'',date:'',amount:0,currency:'USD',category:'Other',description:'',source_name:receiptName,keep_receipt:Boolean(receiptImage&&$('#keep-receipt').checked),receipt_image:receiptImage,needs_review:true})});
        expenses.unshift(item);expenses.sort((a,b)=>String(b.spent_on).localeCompare(String(a.spent_on))||b.id-a.id);refresh();$('#expense-dialog').close();
        toast('Receipt saved as a draft. Local AI could not read it, so please fill in the details.');setTimeout(()=>openExpenseDetails(item.id),180);
      }catch(saveError){$('#extract-note').textContent=`${error.message} We could not save the draft: ${saveError.message}`;toast(saveError.message);}
    }else if(autoSave)toast(error.message);
  } finally { scanInProgress=false;$('.close-dialog').disabled=false;button.disabled=false; button.innerHTML='<span class="ai-star">✳</span> Read with local AI'; }
}
async function saveExpense() {
  const data={vendor:$('#field-vendor').value,date:$('#field-date').value,amount:$('#field-amount').value,currency:$('#field-currency').value,category:$('#field-category').value,description:$('#field-description').value,client_name:$('#field-client').value,is_deductible:$('#field-deductible').checked,source_name:receiptName,keep_receipt:Boolean(receiptImage&&$('#keep-receipt').checked),receipt_image:receiptImage};
  if(!data.vendor.trim()||!data.date||Number(data.amount)<=0){toast('Add a merchant, date, and positive amount.');return;}
  const button=$('#save-expense'); button.disabled=true; button.textContent='Saving…';
  try {
    const wasEditing=Boolean(editingExpenseId);
    const url=wasEditing?`/api/expenses/${editingExpenseId}`:'/api/expenses';
    const item=await request(url,{method:wasEditing?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    if(wasEditing)expenses=expenses.map(row=>row.id===item.id?item:row);else expenses.unshift(item);
    expenses.sort((a,b)=>String(b.spent_on).localeCompare(String(a.spent_on))||b.id-a.id); refresh(); $('#expense-dialog').close(); toast(wasEditing?'Expense details updated.':'Expense saved to your local ledger.');
    if(wasEditing)setTimeout(()=>openExpenseDetails(item.id),180);
  } catch(error) { toast(error.message); }
  finally {button.disabled=false;button.innerHTML='Save expense <span>↗</span>';}
}
function detailField(label,value) { return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value||'—')}</dd></div>`; }
async function openExpenseDetails(expenseId) {
  const dialog=$('#detail-dialog');
  $('#detail-title').textContent='Expense details'; $('#detail-subtitle').textContent='Loading saved details…';
  $('#detail-receipt').innerHTML='<div class="detail-empty">Loading receipt…</div>'; $('#detail-fields').innerHTML='';
  dialog.showModal();
  try {
    const item=await request(`/api/expenses/${expenseId}`);
    currentDetailItem=item;
    $('#detail-title').textContent=item.vendor||'Expense details';
    $('#detail-subtitle').textContent=`${displayDate(item.spent_on)} · ${money(Number(item.amount),item.currency||'USD')}`;
    $('#detail-receipt').innerHTML=item.receipt_file
      ? `<figure class="saved-receipt"><img src="/api/expenses/${Number(item.id)}/receipt" alt="Receipt for ${escapeHtml(item.vendor)}"><figcaption>Receipt image saved on this device</figcaption></figure>`
      : '<div class="detail-empty"><span>▧</span><strong>No receipt image saved</strong><small>This expense still has its saved details. Keep the image when adding a receipt to reopen it here.</small></div>';
    $('#detail-fields').innerHTML=`${item.needs_review?'<p class="needs-review-banner">Some details were unclear. Use “Edit these details” to check and correct this draft.</p>':''}<div class="detail-total">${escapeHtml(money(Number(item.amount),item.currency||'USD'))}<small>${escapeHtml(item.currency||'USD')} · ${escapeHtml(item.category||'Other')}</small></div><dl class="detail-list">${detailField('Merchant',item.vendor)}${detailField('Date',displayDate(item.spent_on))}${detailField('Category',item.category)}${detailField('Client / project',item.client_name)}${detailField('Note',item.description)}${detailField('Business deductible',item.is_deductible?'Yes':'No')}${detailField('Receipt file',item.source_name)}</dl><p class="detail-private">◆ Stored privately on this device</p>`;
  } catch(error) {
    $('#detail-subtitle').textContent='Could not load this expense';
    $('#detail-receipt').innerHTML=`<div class="detail-empty">${escapeHtml(error.message)}</div>`;
  }
}
function editCurrentExpense(){
  const item=currentDetailItem;if(!item)return;
  $('#detail-dialog').close();clearForm();editingExpenseId=item.id;
  $('#dialog-title').textContent='Edit expense details';$('#review-chip').textContent='EDITING SAVED EXPENSE';
  $('#field-vendor').value=item.vendor||'';$('#field-date').value=item.spent_on||'';$('#field-amount').value=item.amount||'';
  $('#field-currency').value=[...$('#field-currency').options].some(option=>option.value===item.currency)?item.currency:'USD';
  $('#field-category').value=[...$('#field-category').options].some(option=>option.value===item.category)?item.category:'Other';
  $('#field-description').value=item.description||'';$('#field-client').value=item.client_name||'';$('#field-deductible').checked=Boolean(item.is_deductible);
  $('#upload-zone strong').textContent=item.source_name||'Receipt already saved';
  $('#upload-zone small').textContent='This saved image stays attached while you update its details.';
  $('#save-expense').innerHTML='Update expense <span>↗</span>';
  $('#expense-dialog').showModal();
}
$('#open-modal').addEventListener('click',openDialog);
$('#import-receipt').addEventListener('click',openDialog);
$('#empty-add').addEventListener('click',openDialog);
$('.close-dialog').addEventListener('click',event=>{event.preventDefault();$('#expense-dialog').close();});
$('#expense-dialog').addEventListener('close',clearForm);
$('#expense-dialog').addEventListener('cancel',event=>{if(scanInProgress)event.preventDefault();});
$('.close-detail').addEventListener('click',()=>$('#detail-dialog').close());
$('#receipt-file').addEventListener('change',event=>showImage(event.target.files[0]));
$('#remove-image').addEventListener('click',()=>{receiptImage='';receiptName='';$('#receipt-file').value='';$('#receipt-image').removeAttribute('src');$('#receipt-preview').classList.remove('visible');$('#keep-receipt').checked=true;$('#upload-zone strong').textContent='Drop a receipt here';$('#upload-zone small').textContent='Choosing an image starts local analysis and saves a draft automatically.';});
$('#upload-zone').addEventListener('dragover',event=>{event.preventDefault();$('#upload-zone').classList.add('dragging');});
$('#upload-zone').addEventListener('dragleave',()=>$('#upload-zone').classList.remove('dragging'));
$('#upload-zone').addEventListener('drop',event=>{event.preventDefault();$('#upload-zone').classList.remove('dragging');showImage(event.dataTransfer.files[0]);});
$('#extract-button').addEventListener('click',()=>extractReceipt());
$('#save-expense').addEventListener('click',saveExpense);
$('#edit-expense').addEventListener('click',editCurrentExpense);
$('#search').addEventListener('input',renderExpenses);
$('#expense-rows').addEventListener('click',async event=>{
  const button=event.target.closest('[data-delete]');
  if(button){
    if(!window.confirm('Remove this expense from your local ledger?'))return;
    try{await request(`/api/expenses/${button.dataset.delete}`,{method:'DELETE'});expenses=expenses.filter(item=>item.id!==Number(button.dataset.delete));refresh();toast('Expense removed.');}catch(error){toast(error.message);}
    return;
  }
  const row=event.target.closest('[data-expense-id]');
  if(row)openExpenseDetails(Number(row.dataset.expenseId));
});
$('#export-link').addEventListener('click',event=>{if(!expenses.length){event.preventDefault();toast('Your ledger is empty. Add an expense before exporting.');}});
$('#help-chat-form').addEventListener('submit',event=>{event.preventDefault();askPocketLedgerHelp($('#help-chat-input').value);});
document.querySelectorAll('[data-help-question]').forEach(button=>button.addEventListener('click',()=>askPocketLedgerHelp(button.dataset.helpQuestion)));
$('#invoice-file').addEventListener('change',event=>chooseInvoiceFile(event.target.files[0]));
$('#invoice-clear-file').addEventListener('click',()=>{selectedInvoiceFile=null;invoiceColumnHeaders=[];$('#invoice-file').value='';$('#invoice-file-preview').hidden=true;$('#invoice-column-mapping').hidden=true;$('#invoice-column-mapping').innerHTML='';$('#invoice-upload-button').disabled=true;$('#invoice-upload-button').innerHTML='Analyze and save invoices <span>↗</span>';$('#invoice-dropzone').classList.remove('has-file');$('#invoice-upload-message').textContent='Invoice details are saved in your local database; invoice images are kept there too.';});
$('#invoice-upload-button').addEventListener('click',uploadInvoices);
$('#invoice-dropzone').addEventListener('dragover',event=>{event.preventDefault();$('#invoice-dropzone').classList.add('dragging');});
$('#invoice-dropzone').addEventListener('dragleave',()=>$('#invoice-dropzone').classList.remove('dragging'));
$('#invoice-dropzone').addEventListener('drop',event=>{event.preventDefault();$('#invoice-dropzone').classList.remove('dragging');chooseInvoiceFile(event.dataTransfer.files[0]);});
$('#invoice-rows').addEventListener('click',async event=>{
  const remove=event.target.closest('[data-invoice-delete]');
  if(remove){event.stopPropagation();if(!window.confirm('Delete this invoice from your local database?'))return;try{await request(`/api/invoices/${remove.dataset.invoiceDelete}`,{method:'DELETE'});await loadInvoices();toast('Invoice deleted.');}catch(error){toast(error.message);}return;}
  const row=event.target.closest('[data-invoice-id]');if(row)openInvoiceDetails(Number(row.dataset.invoiceId));
});
$('#invoice-rows').addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('[data-invoice-id]')){event.preventDefault();openInvoiceDetails(Number(event.target.dataset.invoiceId));}});
$('#invoice-detail-close').addEventListener('click',()=>$('#invoice-detail-dialog').close());
$('#invoice-detail-body').addEventListener('click',event=>{
  if(event.target.closest('#invoice-edit-trigger')){const item=invoices.find(row=>row.id===Number($('#invoice-detail-dialog').dataset.invoiceId));if(item)startInvoiceEdit(item);}
  if(event.target.closest('#invoice-edit-cancel'))openInvoiceDetails(Number($('#invoice-detail-dialog').dataset.invoiceId));
});
$('#invoice-detail-body').addEventListener('submit',event=>{if(event.target.id==='invoice-edit-form')saveInvoiceEdit(event);});

function setAuthMode(mode){
  authMode=mode;
  const signingUp=mode==='signup';
  $('#auth-login-tab').setAttribute('aria-selected',String(!signingUp));
  $('#auth-signup-tab').setAttribute('aria-selected',String(signingUp));
  $('#auth-kicker').textContent=signingUp?'CREATE YOUR ACCOUNT':'WELCOME BACK';
  $('#auth-title').innerHTML=signingUp?'Start your private <em>ledger.</em>':'Your private workspace is <em>ready.</em>';
  $('#auth-copy').textContent=signingUp?'Create an account to keep your receipts and expenses together in PostgreSQL on this computer.':'Sign in to open the expenses saved for your account on this device.';
  $('#username-label').textContent=signingUp?'Choose a username or email':'Email or username';
  $('#auth-username').placeholder=signingUp?'e.g. alex@example.com':'Enter your username or email';
  $('#auth-password').autocomplete=signingUp?'new-password':'current-password';
  $('#auth-password').placeholder=signingUp?'At least 10 characters':'Enter your password';
  $('#password-hint').hidden=!signingUp;
  $('#confirm-password-field').hidden=!signingUp;
  $('#auth-password-confirm').required=signingUp;
  if(!signingUp)$('#auth-password-confirm').value='';
  $('#auth-submit').innerHTML=signingUp?'Create my account <span>↗</span>':'Sign in to PocketLedger <span>↗</span>';
  $('#sample-login').hidden=signingUp||$('#sample-login').dataset.available!=='true';
  $('#auth-error').textContent='';
}
function showAuth(setupRequired,sampleLogin=false){
  authSetupRequired=Boolean(setupRequired);
  $('#app-shell').hidden=true;$('#auth-gate').hidden=false;
  $('#sample-login').dataset.available=String(Boolean(sampleLogin));
  setAuthMode(authSetupRequired?'signup':'login');
}
async function bootstrap(){
  if(location.protocol==='file:'||location.port==='5500'){
    showAuth(true);
    $('#server-notice').hidden=false;
    $('#auth-mode-switch').hidden=true;
    $('#auth-form').hidden=true;
    $('#sample-login').hidden=true;
    return;
  }
  try{
    const status=await request('/api/auth/status');
    if(!status.authenticated){showAuth(status.setup_required,status.sample_login);return;}
    $('#auth-gate').hidden=true;$('#app-shell').hidden=false;
    $('#user-avatar').textContent=initials(status.username);
    $('#user-avatar').title=status.username;
    await Promise.all([loadExpenses(),loadInvoices(),updateHealth()]);
  }catch(error){showAuth(true);$('#auth-error').textContent=error.message;}
}
$('#auth-form').addEventListener('submit',async event=>{
  event.preventDefault();const signingUp=authMode==='signup';
  if(signingUp&&$('#auth-password').value!==$('#auth-password-confirm').value){$('#auth-error').textContent='Those passwords do not match. Please check them and try again.';$('#auth-password-confirm').focus();return;}
  const button=$('#auth-submit');button.disabled=true;$('#auth-login-tab').disabled=true;$('#auth-signup-tab').disabled=true;button.textContent=signingUp?'Creating account…':'Signing in…';$('#auth-error').textContent='';
  try{await request(signingUp?'/api/auth/register':'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('#auth-username').value,password:$('#auth-password').value})});$('#auth-password').value='';$('#auth-password-confirm').value='';await bootstrap();}
  catch(error){$('#auth-error').textContent=error.message;}
  finally{button.disabled=false;$('#auth-login-tab').disabled=false;$('#auth-signup-tab').disabled=false;button.innerHTML=authMode==='signup'?'Create my account <span>↗</span>':'Sign in to PocketLedger <span>↗</span>';}
});
document.querySelectorAll('[data-auth-mode]').forEach(button=>button.addEventListener('click',()=>setAuthMode(button.dataset.authMode)));
$('#use-sample-login').addEventListener('click',()=>{$('#auth-username').value='demo@pocketledger.local';$('#auth-password').value='PocketLedger2026!';$('#auth-password').focus();});
$('#logout-button').addEventListener('click',async()=>{try{await request('/api/auth/logout',{method:'POST'});}finally{showAuth(false);}});
bootstrap();
setInterval(()=>{if(!$('#app-shell').hidden)updateHealth();},30000);
