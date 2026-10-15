const $ = (selector) => document.querySelector(selector);
const CATEGORY_COLORS = {Meals:'#7ea88b',Software:'#789bb0',Travel:'#d1a44d',Supplies:'#bd8276',Marketing:'#9c8ab4',Utilities:'#7ea7a2',Other:'#bbc1b5'};
const CURRENCY_LOCALE = {USD:'en-US',INR:'en-IN',EUR:'de-DE',GBP:'en-GB',CAD:'en-CA',AUD:'en-AU',JPY:'ja-JP'};
let expenses = [];
let receiptImage = '';
let toastTimer;

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
  if (!response.ok) throw new Error(result?.error || 'Something went wrong. Please try again.');
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
  $('#expense-rows').innerHTML = rows.slice(0,12).map(item=>`<tr class="expense-row"><td><div class="merchant"><span class="merchant-mark">${escapeHtml(initials(item.vendor))}</span><span class="merchant-meta">${escapeHtml(item.vendor)}<small>${escapeHtml(item.client_name || item.source_name || 'Receipt')}</small></span></div></td><td>${escapeHtml(displayDate(item.spent_on))}</td><td><span class="category-tag">${escapeHtml(item.category)}</span></td><td class="note-cell">${escapeHtml(item.description || '—')}${item.is_deductible?'<span class="deductible-mark" title="Marked business deductible">◆ deductible</span>':''}</td><td class="amount-cell">${escapeHtml(money(Number(item.amount),item.currency||'USD'))}</td><td><button class="row-delete" data-delete="${Number(item.id)}" title="Delete expense" aria-label="Delete ${escapeHtml(item.vendor)} expense">×</button></td></tr>`).join('');
  if (expenses.length && query && rows.length===0) $('#expense-rows').innerHTML = '<tr><td colspan="6" class="no-results">No expenses match that search.</td></tr>';
}
function refresh() { renderStats(); renderExpenses(); }
async function loadExpenses() {
  try { expenses = await request('/api/expenses'); refresh(); }
  catch(error) { toast(error.message); }
}
async function updateHealth() {
  try {
    const status=await request('/api/health');
    const chip=$('.local-chip');
    if(status.model_ready){$('#local-status').textContent=`${status.model} · ready`;chip.classList.remove('offline');}
    else if(status.ollama){$('#local-status').textContent='Local AI · model needed';chip.classList.add('offline');}
    else{$('#local-status').textContent='Local AI · offline';chip.classList.add('offline');}
  } catch { $('#local-status').textContent='Local AI · unavailable'; $('.local-chip').classList.add('offline'); }
}
function clearForm() {
  receiptImage=''; $('#receipt-file').value=''; $('#receipt-image').removeAttribute('src'); $('#receipt-preview').classList.remove('visible'); $('#receipt-text').value='';
  $('#field-vendor').value=''; $('#field-date').value=localDateString(); $('#field-amount').value=''; $('#field-currency').value='USD'; $('#field-category').value='Meals'; $('#field-description').value=''; $('#field-client').value=''; $('#field-deductible').checked=false;
  $('#review-chip').textContent='MANUAL ENTRY'; $('#review-chip').className='review-chip'; $('#extract-note').className='extract-note'; $('#extract-note').innerHTML='<span>✧</span> AI suggests. You stay in control.';
}
function openDialog() { clearForm(); $('#expense-dialog').showModal(); }
function showImage(file) {
  if (!file) return;
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { toast('Choose a JPG, PNG or WEBP receipt image.'); return; }
  if (file.size > 8*1024*1024) { toast('Please choose an image smaller than 8 MB.'); return; }
  const reader = new FileReader();
  reader.onload = () => { receiptImage=String(reader.result); $('#receipt-image').src=receiptImage; $('#receipt-preview').classList.add('visible'); $('#upload-zone strong').textContent=file.name; $('#upload-zone small').textContent='Ready to process on this device.'; };
  reader.readAsDataURL(file);
}
async function extractReceipt() {
  const button=$('#extract-button'); button.disabled=true; button.innerHTML='<span class="ai-star">✳</span> Reading locally…';
  $('#extract-note').className='extract-note'; $('#extract-note').textContent='Your receipt is being read on this device.';
  try {
    const fields=await request('/api/extract',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:$('#receipt-text').value,image:receiptImage})});
    $('#field-vendor').value=fields.vendor||'';
    $('#field-date').value=/^\d{4}-\d\d-\d\d$/.test(fields.date||'')?fields.date:'';
    $('#field-amount').value=fields.amount||''; $('#field-currency').value=[...$('#field-currency').options].some(option=>option.value===fields.currency)?fields.currency:'USD';
    $('#field-category').value=[...$('#field-category').options].some(option=>option.value===fields.category)?fields.category:'Other';
    $('#field-description').value=fields.description||'';
    $('#review-chip').textContent=fields.needs_review?'PLEASE REVIEW':'AI DRAFT'; $('#review-chip').className=`review-chip ${fields.needs_review?'check':'ready'}`;
    $('#extract-note').className=`extract-note ${fields.needs_review?'warning':''}`; $('#extract-note').innerHTML=fields.needs_review?'<span>↗</span> A detail may be unclear. Please check each field.':'<span>✧</span> Draft ready. Check it before saving.';
    $('#field-vendor').focus();
  } catch(error) {
    $('#extract-note').className='extract-note warning'; $('#extract-note').textContent=error.message;
  } finally { button.disabled=false; button.innerHTML='<span class="ai-star">✳</span> Read with local AI'; }
}
async function saveExpense() {
  const data={vendor:$('#field-vendor').value,date:$('#field-date').value,amount:$('#field-amount').value,currency:$('#field-currency').value,category:$('#field-category').value,description:$('#field-description').value,client_name:$('#field-client').value,is_deductible:$('#field-deductible').checked,source_name:$('#receipt-file').files[0]?.name||''};
  if(!data.vendor.trim()||!data.date||Number(data.amount)<=0){toast('Add a merchant, date, and positive amount.');return;}
  const button=$('#save-expense'); button.disabled=true; button.textContent='Saving…';
  try {
    const item=await request('/api/expenses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    expenses.unshift(item); expenses.sort((a,b)=>String(b.spent_on).localeCompare(String(a.spent_on))||b.id-a.id); refresh(); $('#expense-dialog').close(); toast('Expense saved to your local ledger.');
  } catch(error) { toast(error.message); }
  finally {button.disabled=false;button.innerHTML='Save expense <span>↗</span>';}
}
$('#open-modal').addEventListener('click',openDialog);
$('#import-receipt').addEventListener('click',openDialog);
$('#empty-add').addEventListener('click',openDialog);
$('.close-dialog').addEventListener('click',event=>{event.preventDefault();$('#expense-dialog').close();});
$('#expense-dialog').addEventListener('close',clearForm);
$('#receipt-file').addEventListener('change',event=>showImage(event.target.files[0]));
$('#remove-image').addEventListener('click',()=>{receiptImage='';$('#receipt-file').value='';$('#receipt-image').removeAttribute('src');$('#receipt-preview').classList.remove('visible');$('#upload-zone strong').textContent='Drop a receipt here';$('#upload-zone small').textContent='Image is processed locally and discarded after extraction.';});
$('#upload-zone').addEventListener('dragover',event=>{event.preventDefault();$('#upload-zone').classList.add('dragging');});
$('#upload-zone').addEventListener('dragleave',()=>$('#upload-zone').classList.remove('dragging'));
$('#upload-zone').addEventListener('drop',event=>{event.preventDefault();$('#upload-zone').classList.remove('dragging');showImage(event.dataTransfer.files[0]);});
$('#extract-button').addEventListener('click',extractReceipt);
$('#save-expense').addEventListener('click',saveExpense);
$('#search').addEventListener('input',renderExpenses);
$('#expense-rows').addEventListener('click',async event=>{
  const button=event.target.closest('[data-delete]');if(!button)return;
  if(!window.confirm('Remove this expense from your local ledger?'))return;
  try{await request(`/api/expenses/${button.dataset.delete}`,{method:'DELETE'});expenses=expenses.filter(item=>item.id!==Number(button.dataset.delete));refresh();toast('Expense removed.');}catch(error){toast(error.message);}
});
$('#export-link').addEventListener('click',event=>{if(!expenses.length){event.preventDefault();toast('Your ledger is empty. Add an expense before exporting.');}});
loadExpenses(); updateHealth();
setInterval(updateHealth, 30000);
