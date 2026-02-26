// basic in-memory data structures for prototype

const members = [
    { id: 'father', name: 'พ่อ', role: 'admin' },
    { id: 'mother', name: 'แม่', role: 'admin' },
    { id: 'child', name: 'ลูก', role: 'user' }
];

const categories = [
    { id: 'food', name: 'อาหาร', subs: ['ของสด','ร้านอาหาร','ขนม'] },
    { id: 'travel', name: 'การเดินทาง', subs: ['รถยนต์','ค่าน้ำมัน'] },
    { id: 'util', name: 'ค่าสาธารณูปโภค', subs: [] }
];

let transactions = [];

// helper for API
async function fetchTransactions() {
    try {
        const res = await fetch('/api/transactions');
        if(res.ok) {
            // if redirected to login
            if(res.redirected) {
                window.location = '/login.html';
                return;
            }
            transactions = await res.json();
        } else transactions = [];
    } catch(e){ transactions=[]; }
}

async function saveTransaction(tx) {
    const res = await fetch('/api/transactions', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(tx)
    });
    return res.json();
}

async function deleteTransaction(id){
    await fetch('/api/transactions/'+id, { method:'DELETE' });
}

async function updateTransaction(id, data){
    await fetch('/api/transactions/'+id, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
}

// utility
function formatMoney(v){ return '฿' + Number(v).toLocaleString(); }

// render functions
let categoryChart, memberChart, trendChart;

function updateSummary() {
    let income = 0, expense = 0;
    let byMember = { father:0, mother:0, child:0 };
    let byCategory = {};
    transactions.forEach(tx => {
        if(tx.type === 'income') income += tx.amount;
        else expense += tx.amount;
        byMember[tx.member] += tx.amount * (tx.type==='expense'?1:-1);
        const parent = tx.category.parent;
        if(!byCategory[parent]) byCategory[parent]=0;
        byCategory[parent] += tx.amount;
    });
    document.getElementById('total-income').textContent = formatMoney(income);
    document.getElementById('total-expense').textContent = formatMoney(expense);
    document.getElementById('total-balance').textContent = formatMoney(income - expense);
    document.getElementById('father-total').textContent = formatMoney(byMember.father);
    document.getElementById('mother-total').textContent = formatMoney(byMember.mother);
    document.getElementById('child-total').textContent = formatMoney(byMember.child);
    // progress bars based on budgets
    ['father','mother','child'].forEach(id=>{
        const spent = transactions.filter(t=>t.member===id && t.type==='expense').reduce((s,t)=>s+t.amount,0);
        const goal = budgets[id]||0;
        const pct = goal?Math.round(spent/goal*100):0;
        const bar = document.getElementById(id+'-progress');
        if(bar){
            let color = 'green';
            if(pct>100) color='red';
            else if(pct>80) color='orange';
            bar.innerHTML = '<div class="progress-inner" style="width:'+Math.min(pct,100)+'%;background:'+ color +';"></div>';
        }
    });
    // update charts
    updateCharts(byCategory, byMember);
}

function renderRecent(range='all') {
    const tbody = document.getElementById('recent-items');
    if(!tbody) return;
    tbody.innerHTML = '';
    let list = [...transactions];
    const now = new Date();
    if(range==='today'){
        list=list.filter(t=>new Date(t.date).toDateString()===now.toDateString());
    } else if(range==='week'){
        const weekAgo=new Date(now); weekAgo.setDate(now.getDate()-7);
        list=list.filter(t=>new Date(t.date)>=weekAgo);
    } else if(range==='month'){
        list=list.filter(t=>new Date(t.date).getMonth()===now.getMonth() && new Date(t.date).getFullYear()===now.getFullYear());
    }
    if(list.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="6">ไม่มีรายการ</td>';
        tbody.appendChild(tr);
        return;
    }
    list.slice(-50).reverse().forEach(tx => {
        const tr = document.createElement('tr');
        const receiptCell = tx.receipt ? `<td><span class=\"receipt-icon\" data-file=\"${tx.receipt}\" style=\"cursor:pointer\">📎</span></td>` : '<td></td>';
        tr.innerHTML = `<td>${tx.note||''}</td><td>${formatMoney(tx.amount)}</td><td>${members.find(m=>m.id===tx.member).name}</td><td>${tx.category.parent}${tx.category.sub?'/'+tx.category.sub:''}</td><td>${tx.date}</td>${receiptCell}`;
        tbody.appendChild(tr);
    });
    // attach receipt handlers
    tbody.querySelectorAll('.receipt-icon').forEach(el=>{
        el.addEventListener('click', ()=>{
            const file = el.dataset.file;
            const img = document.getElementById('receipt-img');
            img.src = '/uploads/' + file;
            document.getElementById('receipt-modal').style.display='flex';
        });
    });
}

function computeTrendData(){
    const now = new Date();
    const months = [];
    for(let i=5;i>=0;i--){
        const d=new Date(now.getFullYear(), now.getMonth()-i,1);
        months.push(d);
    }
    const labels = months.map(d=>`${d.getFullYear()}/${d.getMonth()+1}`);
    const datasets = ['father','mother','child'].map((m, idx)=>{
        return {
            label: members.find(x=>x.id===m).name,
            backgroundColor: ['#4a90e2','#50e3c2','#f5a623'][idx],
            data: months.map(d=>{
                const next=new Date(d.getFullYear(),d.getMonth()+1,1);
                return transactions.filter(t=>t.member===m && t.type==='expense' && new Date(t.date)>=d && new Date(t.date)<next)
                    .reduce((s,t)=>s+t.amount,0);
            })
        };
    });
    return { labels,datasets };
}

function updateCharts(byCategory, byMember){
    const catCtx = document.getElementById('category-chart');
    const memCtx = document.getElementById('member-chart');
    const trendCtx = document.getElementById('trend-chart');
    if(catCtx){
        const labels = Object.keys(byCategory);
        const data = labels.map(l=>byCategory[l]);
        if(!categoryChart){
            categoryChart = new Chart(catCtx, {
                type:'doughnut',
                data:{ labels, datasets:[{ data, backgroundColor:['#4a90e2','#50e3c2','#f5a623','#9013fe','#d0021b'] }] },
                options:{ responsive:true, maintainAspectRatio:false }
            });
        } else {
            categoryChart.data.labels = labels;
            categoryChart.data.datasets[0].data = data;
            categoryChart.update();
        }
    }
    if(memCtx){
        const labels = ['พ่อ','แม่','ลูก'];
        const data = [byMember.father, byMember.mother, byMember.child];
        if(!memberChart){
            memberChart = new Chart(memCtx, {
                type:'doughnut',
                data:{ labels, datasets:[{ data, backgroundColor:['#4a90e2','#50e3c2','#f5a623'] }] },
                options:{ responsive:true, maintainAspectRatio:false }
            });
        } else {
            memberChart.data.datasets[0].data = data;
            memberChart.update();
        }
    }
    if(trendCtx){
        const trendData = computeTrendData();
        if(!trendChart){
            trendChart = new Chart(trendCtx, {
                type:'bar',
                data:trendData,
                options:{ responsive:true, maintainAspectRatio:false, scales:{x:{stacked:true}, y:{stacked:true}} }
            });
        } else {
            trendChart.data = trendData;
            trendChart.update();
        }
    }
}

function renderRecent() {
    const tbody = document.getElementById('recent-items');
    if(!tbody) return;
    tbody.innerHTML = '';
    if(transactions.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="5">ไม่มีรายการ</td>';
        tbody.appendChild(tr);
        return;
    }
    transactions.slice(-5).reverse().forEach(tx => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${tx.note||''}</td><td>${formatMoney(tx.amount)}</td><td>${members.find(m=>m.id===tx.member).name}</td><td>${tx.category.parent}${tx.category.sub?'/'+tx.category.sub:''}</td><td>${tx.date}</td>`;
        tbody.appendChild(tr);
    });
}

function populateCategorySelects() {
    const parent = document.getElementById('tx-parent-category');
    const sub = document.getElementById('tx-sub-category');
    if(!parent) return;
    parent.innerHTML = '';
    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        parent.appendChild(opt);
    });
    parent.onchange = ()=>{
        const chosen = categories.find(c=>c.id===parent.value);
        sub.innerHTML = '';
        if(chosen && chosen.subs.length){
            chosen.subs.forEach(s=>{
                const opt=document.createElement('option'); opt.value=s; opt.textContent=s; sub.appendChild(opt);
            });
        }
    };
}

function renderUserList(){
    const ul = document.getElementById('user-list');
    if(!ul) return;
    ul.innerHTML = '';
    members.forEach(m=>{
        const li = document.createElement('li');
        const select = document.createElement('select');
        ['admin','user'].forEach(r=>{
            const o = document.createElement('option'); o.value=r; o.textContent=r==='admin'?'ผู้ดูแล':'บันทึก';
            if(m.role===r) o.selected=true;
            select.appendChild(o);
        });
        select.onchange = ()=>{ m.role=select.value; };
        li.textContent = m.name + ' ';
        li.appendChild(select);
        ul.appendChild(li);
    });
}

function renderCategoryList(){
    const parentUl = document.getElementById('parent-category-list');
    if(!parentUl) return;
    parentUl.innerHTML = '';
    categories.forEach(cat=>{
        const li = document.createElement('li');
        li.textContent = cat.name;
        li.style.cursor = 'pointer';
        li.title = 'คลิกเพื่อเพิ่มหมวดย่อย';
        li.onclick = ()=>{
            const sub = prompt('ชื่อหมวดย่อยสำหรับ "'+cat.name+'"');
            if(sub){
                cat.subs.push(sub);
                renderCategoryList();
                populateCategorySelects();
            }
        };
        if(cat.subs.length){
            const subUl = document.createElement('ul');
            cat.subs.forEach(sub=>{ const sli=document.createElement('li'); sli.textContent=sub; subUl.appendChild(sli); });
            li.appendChild(subUl);
        }
        parentUl.appendChild(li);
    });
}

function populateCategoryIcons() {
    const container = document.getElementById('category-icons');
    if(!container) return;
    container.innerHTML = '';
    const categoryEmojis = {
        'food': '🍔',
        'travel': '🚗',
        'util': '⚡',
        'entertainment': '🎬',
        'health': '🏥',
        'shopping': '🛍️',
        'education': '📚',
        'investment': '💼'
    };
    categories.forEach(cat => {
        const div = document.createElement('div');
        div.className = 'category-icon';
        div.dataset.category = cat.id;
        div.textContent = categoryEmojis[cat.id] || '📌';
        div.title = cat.name;
        container.appendChild(div);
    });
}

function showForm() {
    populateCategoryIcons();
    const section = document.getElementById('transaction-section');
    if(section) section.style.display = 'block';
    const form = document.getElementById('transaction-form');
    if(form) form.style.display = 'flex';
    // Scroll to form
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function hideForm(){ 
    const section = document.getElementById('transaction-section');
    if(section) section.style.display = 'none';
    const form = document.getElementById('transaction-form'); 
    if(form) form.style.display = 'none'; 
}

function attachHandlers() {
    document.getElementById('add-transaction')?.addEventListener('click', ()=>{ 
        showForm(); 
        // Reset form for new entry
        document.getElementById('transaction-form').reset();
        document.getElementById('amount-display').textContent = '0';
        document.getElementById('tx-amount').value = '0';
        document.getElementById('tx-member').value = 'father';
        document.getElementById('tx-type').value = 'expense';
        document.getElementById('tx-category').value = '';
        // Reset button active states
        document.querySelectorAll('.member-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.category-icon').forEach(btn => btn.classList.remove('active'));
        document.querySelector('.member-btn[data-member="father"]').classList.add('active');
        document.querySelector('.type-btn[data-type="expense"]').classList.add('active');
    });
    
    document.getElementById('tx-cancel')?.addEventListener('click', e=>{ 
        e.preventDefault(); 
        hideForm(); 
    });
    
    // Number pad handlers
    document.querySelectorAll('.pad-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            const display = document.getElementById('amount-display');
            const input = document.getElementById('tx-amount');
            let current = display.textContent;
            
            if(btn.classList.contains('pad-backspace')) {
                // Handle backspace
                if(current.length > 1) {
                    current = current.slice(0, -1);
                } else {
                    current = '0';
                }
            } else if(btn.classList.contains('pad-dot')) {
                // Handle decimal point
                if(!current.includes('.')) {
                    current += '.';
                }
            } else {
                // Handle digits
                const digit = btn.textContent.trim();
                if(current === '0') {
                    current = digit;
                } else {
                    current += digit;
                }
            }
            
            display.textContent = current;
            input.value = parseFloat(current) || 0;
        });
    });
    
    // Member button handlers
    document.querySelectorAll('.member-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            document.querySelectorAll('.member-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tx-member').value = btn.dataset.member;
        });
    });
    
    // Transaction type button handlers
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tx-type').value = btn.dataset.type;
        });
    });
    
    // Category icon handlers
    document.querySelectorAll('.category-icon').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            document.querySelectorAll('.category-icon').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tx-category').value = btn.dataset.category;
        });
    });
    
    document.getElementById('add-parent-category')?.addEventListener('click', ()=>{
        const name = prompt('ชื่อกลุ่มใหญ่ใหม่');
        if(name){
            const id = name.toLowerCase().replace(/\s+/g,'_');
            categories.push({id,name,subs:[]});
            renderCategoryList();
            populateCategorySelects();
        }
    });
    // simple user addition placeholder
    document.getElementById('add-user')?.addEventListener('click', ()=>{
        const name = prompt('ชื่อสมาชิก');
        if(name){
            members.push({id:name.toLowerCase(), name, role:'user'});
            renderUserList();
        }
    });
    document.getElementById('transaction-form')?.addEventListener('submit', async e=>{
        e.preventDefault();
        const formData = new FormData(e.target);
        
        // Ensure category is set
        if(!formData.get('category')) {
            alert('กรุณาเลือกหมวดหมู่');
            return;
        }
        
        // Convert category ID to object with parent property
        const categoryId = formData.get('category');
        const cat = categories.find(c => c.id === categoryId);
        if(cat) {
            formData.set('category', JSON.stringify({parent: cat.id, sub: ''}));
        }
        
        const res = await fetch('/api/transactions',{method:'POST',body:formData});
        const data = await res.json();
        if(data.flash) showFlash(data.flash);
        // notification
        const amt = parseFloat(formData.get('amount'))||0;
        const member = formData.get('member');
        notify(`${members.find(m=>m.id===member).name} บันทึกรายการ ${formatMoney(amt)}`);
        // high expense warning
        const bud = budgets[member]||0;
        if(formData.get('type')==='expense' && bud>0 && amt/bud>0.8){
            notify('ค่าใช้จ่ายสูงผิดปกติ!');
        }
        await refreshData();
        hideForm();
        e.target.reset();
    });
    // filters
    document.querySelectorAll('.filter').forEach(btn=>{
        btn.addEventListener('click', e=>{
            document.querySelectorAll('.filter').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            renderRecent(btn.dataset.range);
        });
    });
    // budget inputs
    document.getElementById('save-budgets')?.addEventListener('click', async ()=>{
        budgets.father = parseFloat(document.getElementById('budget-father').value)||0;
        budgets.mother = parseFloat(document.getElementById('budget-mother').value)||0;
        budgets.child = parseFloat(document.getElementById('budget-child').value)||0;
        await saveBudgets();
        updateSummary();
    });
    // receipt modal
    document.getElementById('receipt-modal')?.addEventListener('click', ()=>{
        document.getElementById('receipt-modal').style.display='none';
    });
    // export link append
    const adminExportCsv = document.querySelector('#export-csv');
    const adminExportXlsx = document.querySelector('#export-xlsx');
    const adminExportPdf = document.querySelector('#export-pdf');
    if(adminExportCsv) adminExportCsv.href='/admin/export?format=csv';
    if(adminExportXlsx) adminExportXlsx.href='/admin/export?format=xlsx';
    if(adminExportPdf) adminExportPdf.href='/admin/export?format=pdf';
}

// helper to refresh data from server
async function refreshData(){
    await fetchTransactions();
    await fetchBudgets();
    updateSummary();
    renderRecent();
}

// budgets
async function fetchBudgets(){
    try{ const res=await fetch('/api/budgets'); if(res.ok) budgets=await res.json(); }
    catch{} }
async function saveBudgets(){
    await fetch('/api/budgets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(budgets)});
}

// flash
function showFlash(msg){
    const el=document.getElementById('flash-message');
    el.textContent=msg;
    el.style.display='block';
    setTimeout(()=>el.style.display='none',3000);
}

// notifications
function notify(msg){
    const area=document.getElementById('notification-area');
    if(!area) return;
    const div=document.createElement('div');
    div.className='notification';
    div.textContent=msg;
    area.appendChild(div);
    setTimeout(()=>{div.style.opacity='0'; setTimeout(()=>area.removeChild(div),500);},4000);
}

// initialize
window.addEventListener('DOMContentLoaded', async ()=>{
    console.log('app.js loaded');
    populateCategorySelects();
    renderUserList();
    renderCategoryList();
    attachHandlers();
    await refreshData();
    // show flash from server if any
    if(window.location.search.includes('flash=')){
        const msg = decodeURIComponent(window.location.search.split('flash=')[1]);
        showFlash(msg);
    }
    // set budget inputs
    document.getElementById('budget-father').value = budgets.father || '';
    document.getElementById('budget-mother').value = budgets.mother || '';
    document.getElementById('budget-child').value = budgets.child || '';
});
