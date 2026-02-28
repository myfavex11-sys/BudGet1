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
let budgets = { father: 0, mother: 0, child: 0 };

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
    
    // Calculate total balance (income - expense from all family members)
    const totalBalance = income - expense;
    
    document.getElementById('total-income').textContent = formatMoney(income);
    document.getElementById('total-expense').textContent = formatMoney(expense);
    document.getElementById('total-balance').textContent = formatMoney(totalBalance);
    
    // Display budget amounts and spending for each member
    ['father','mother','child'].forEach(id=>{
        const spent = transactions.filter(t=>t.member===id && t.type==='expense').reduce((s,t)=>s+t.amount,0);
        const goal = budgets[id]||0;
        
        // Display budget amount
        const budgetEl = document.getElementById(id+'-budget');
        if(budgetEl) {
            budgetEl.textContent = formatMoney(goal);
        }
        
        // Display spending amount (only expenses for this member)
        const spendingEl = document.getElementById(id+'-total');
        if(spendingEl) {
            spendingEl.textContent = 'ใช้: ' + formatMoney(spent);
        }
        
        // Progress bar based on spending vs budget
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
        const nameSpan = document.createElement('strong');
        nameSpan.textContent = m.name;
        
        const select = document.createElement('select');
        ['admin','user'].forEach(r=>{
            const o = document.createElement('option'); 
            o.value=r; 
            o.textContent=r==='admin'?'👤 ผู้ดูแล':'✏️ บันทึกรายการ';
            if(m.role===r) o.selected=true;
            select.appendChild(o);
        });
        select.onchange = ()=>{ m.role=select.value; };
        
        li.appendChild(nameSpan);
        li.appendChild(select);
        ul.appendChild(li);
    });
}

function renderDashboardUserList(){
    const ul = document.getElementById('dashboard-user-list');
    if(!ul) return;
    ul.innerHTML = '';
    members.forEach(m=>{
        const li = document.createElement('li');
        const nameSpan = document.createElement('strong');
        nameSpan.textContent = m.name;
        
        const select = document.createElement('select');
        ['admin','user'].forEach(r=>{
            const o = document.createElement('option'); 
            o.value=r; 
            o.textContent=r==='admin'?'👤 ผู้ดูแล':'✏️ บันทึกรายการ';
            if(m.role===r) o.selected=true;
            select.appendChild(o);
        });
        select.onchange = ()=>{ m.role=select.value; };
        
        li.appendChild(nameSpan);
        li.appendChild(select);
        ul.appendChild(li);
    });
}

function renderCategoryList(){
    const parentUl = document.getElementById('parent-category-list');
    if(!parentUl) return;
    parentUl.innerHTML = '';
    
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
    
    categories.forEach(cat=>{
        const li = document.createElement('li');
        li.style.cursor = 'pointer';
        
        // Create emoji + text container
        const mainContainer = document.createElement('div');
        mainContainer.style.display = 'flex';
        mainContainer.style.alignItems = 'center';
        mainContainer.style.gap = '0.5rem';
        
        // Category emoji
        const emoji = document.createElement('span');
        emoji.textContent = categoryEmojis[cat.id] || '📌';
        emoji.style.fontSize = '1.2rem';
        
        // Create main category text
        const catText = document.createElement('span');
        catText.textContent = cat.name;
        mainContainer.appendChild(emoji);
        mainContainer.appendChild(catText);
        
        // Create help text
        const helpText = document.createElement('span');
        helpText.style.fontSize = '0.8rem';
        helpText.style.color = '#999';
        helpText.style.display = 'none';
        helpText.textContent = '✏️ คลิกเพื่อเพิ่มหมวดย่อย';
        
        li.appendChild(mainContainer);
        li.appendChild(helpText);
        
        // Show/hide help text
        li.addEventListener('mouseenter', () => {
            helpText.style.display = 'inline';
            catText.style.opacity = '0.7';
        });
        li.addEventListener('mouseleave', () => {
            helpText.style.display = 'none';
            catText.style.opacity = '1';
        });
        
        // Click handler
        li.addEventListener('click', ()=>{
            const sub = prompt('ชื่อหมวดย่อยสำหรับ "'+cat.name+'"');
            if(sub){
                cat.subs.push(sub);
                renderCategoryList();
                populateCategorySelects();
            }
        });
        
        if(cat.subs.length){
            const subUl = document.createElement('ul');
            cat.subs.forEach(sub=>{ 
                const sli=document.createElement('li'); 
                sli.textContent='  ↳ ' + sub;
                // Add delete functionality for subcategories
                sli.style.position = 'relative';
                sli.addEventListener('mouseenter', function() {
                    if (!this.hasDeleteBtn) {
                        const deleteBtn = document.createElement('span');
                        deleteBtn.textContent = ' ✕';
                        deleteBtn.style.cursor = 'pointer';
                        deleteBtn.style.color = '#ff6b6b';
                        deleteBtn.style.marginLeft = '0.5rem';
                        deleteBtn.style.fontWeight = 'bold';
                        deleteBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            if(confirm('ลบ "' + sub + '" ?')) {
                                cat.subs = cat.subs.filter(s => s !== sub);
                                renderCategoryList();
                            }
                        });
                        this.appendChild(deleteBtn);
                        this.hasDeleteBtn = true;
                    }
                });
                subUl.appendChild(sli);
            });
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
        
        // Create emoji element
        const emoji = document.createElement('div');
        emoji.style.fontSize = '2.2rem';
        emoji.textContent = categoryEmojis[cat.id] || '📌';
        
        // Create text element
        const text = document.createElement('div');
        text.className = 'category-icon-text';
        text.textContent = cat.name;
        
        div.appendChild(emoji);
        div.appendChild(text);
        div.title = cat.name;
        
        // Attach click handler directly
        div.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            document.querySelectorAll('.category-icon').forEach(b => b.classList.remove('active'));
            div.classList.add('active');
            document.getElementById('tx-category').value = cat.id;
        });
        
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

// Helper function to initialize form with default or prefilled values
function initializeTransactionForm(prefillMember, prefillType, prefillCategory) {
    showForm(); 
    // Reset form for new entry
    document.getElementById('transaction-form').reset();
    document.getElementById('amount-display').textContent = '0';
    document.getElementById('tx-amount').value = '0';
    
    const member = prefillMember || 'father';
    const type = prefillType || 'expense';
    const category = prefillCategory || '';
    
    document.getElementById('tx-member').value = member;
    document.getElementById('tx-type').value = type;
    document.getElementById('tx-category').value = category;
    
    // Reset button active states
    document.querySelectorAll('.member-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.category-icon').forEach(btn => btn.classList.remove('active'));
    
    // Set active buttons for member and type
    document.querySelector(`.member-btn[data-member="${member}"]`)?.classList.add('active');
    document.querySelector(`.type-btn[data-type="${type}"]`)?.classList.add('active');
    
    // Set active category if provided
    if(category) {
        document.querySelector(`.category-icon[data-category="${category}"]`)?.classList.add('active');
    }
    
    // Update member display with spending
    const spent = transactions.filter(t=>t.member===member && t.type==='expense').reduce((s,t)=>s+t.amount,0);
    const memberEmojis = {
        'father': '👨 พ่อ',
        'mother': '👩 แม่',
        'child': '👧 ลูก'
    };
    const displayEl = document.getElementById('selected-member-display');
    if(displayEl) {
        const memberName = memberEmojis[member] || member;
        displayEl.innerHTML = `✓ เลือก: ${memberName} | <strong>ใช้ไป: ${formatMoney(spent)}</strong>`;
    }
}

function attachHandlers() {
    document.getElementById('add-transaction')?.addEventListener('click', ()=>{ 
        initializeTransactionForm();
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
    const memberEmojis = {
        'father': '👨 พ่อ',
        'mother': '👩 แม่',
        'child': '👧 ลูก'
    };
    
    document.querySelectorAll('.member-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            document.querySelectorAll('.member-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const memberId = btn.dataset.member;
            document.getElementById('tx-member').value = memberId;
            
            // Calculate spending for selected member
            const spent = transactions.filter(t=>t.member===memberId && t.type==='expense').reduce((s,t)=>s+t.amount,0);
            
            // Update member display with name and spending
            const displayEl = document.getElementById('selected-member-display');
            if(displayEl) {
                const memberName = memberEmojis[memberId] || memberId;
                displayEl.innerHTML = `✓ เลือก: ${memberName} | <strong>ใช้ไป: ${formatMoney(spent)}</strong>`;
            }
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
    
    // Quick add category button
    document.getElementById('quick-add-category')?.addEventListener('click', (e)=>{
        e.preventDefault();
        const name = prompt('ชื่อกลุ่มหมวดหมู่ใหม่');
        if(name){
            const id = name.toLowerCase().replace(/\s+/g,'_');
            categories.push({id, name, subs:[]});
            populateCategoryIcons();
            populateCategorySelects();
            renderCategoryList();
            notify('✅ เพิ่ม "' + name + '" เรียบร้อยแล้ว');
        }
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
    // add new member
    document.getElementById('add-user')?.addEventListener('click', ()=>{
        const name = prompt('ชื่อสมาชิกใหม่ (เช่น ป้า ลุง น้อย)');
        if(name && name.trim()){
            const newMember = {
                id: name.toLowerCase().replace(/\s+/g, '_'),
                name: name.trim(),
                role: 'user'
            };
            // Check if member already exists
            if(!members.find(m => m.id === newMember.id)){
                members.push(newMember);
                renderUserList();
                notify('✅ เพิ่มสมาชิก "' + name + '" เรียบร้อยแล้ว');
            } else {
                alert('สมาชิกนี้มีอยู่แล้ว');
            }
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
        const txType = formData.get('type');
        const memberName = members.find(m=>m.id===member).name;
        
        // Show member transaction notification
        notify(`${memberName} บันทึกรายการ ${formatMoney(amt)}`);
        
        // high expense warning
        const bud = budgets[member]||0;
        if(txType==='expense' && bud>0 && amt/bud>0.8){
            notify('⚠️ ค่าใช้จ่ายสูงผิดปกติ!');
        }
        
        await refreshData();
        
        // Show success message with animated modal
        const successModal = document.createElement('div');
        successModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 3000;
            animation: fadeIn 0.3s ease;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: linear-gradient(135deg, #fff, #f9f9ff);
            padding: 3rem 2rem;
            border-radius: 20px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            animation: slideUp 0.5s ease;
        `;
        
        // Add animation styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { transform: translateY(50px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            @keyframes scaleIn {
                from { transform: scale(0.5); }
                to { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
        
        const checkmark = document.createElement('div');
        checkmark.style.cssText = `
            font-size: 4rem;
            margin-bottom: 1rem;
            animation: scaleIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        `;
        checkmark.textContent = '✅';
        
        const message = document.createElement('p');
        message.style.cssText = `
            font-size: 1.8rem;
            font-weight: 700;
            color: #333;
            margin: 0;
            animation: slideUp 0.5s ease 0.2s backwards;
        `;
        message.textContent = 'บันทึกเรียบร้อย';
        
        const subtitle = document.createElement('p');
        subtitle.style.cssText = `
            font-size: 1rem;
            color: #999;
            margin: 0.5rem 0 0 0;
            animation: slideUp 0.5s ease 0.4s backwards;
        `;
        subtitle.textContent = 'กำลังไปยังประวัติการทำธุรกรรม...';
        
        modalContent.appendChild(checkmark);
        modalContent.appendChild(message);
        modalContent.appendChild(subtitle);
        successModal.appendChild(modalContent);
        document.body.appendChild(successModal);
        
        // Redirect to history page after 2 seconds
        setTimeout(() => {
            window.location.href = '/history.html';
        }, 2000);
        
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
    // budget inputs - SAVE AND REDIRECT
    document.getElementById('save-budgets')?.addEventListener('click', async ()=>{
        const fatherInput = document.getElementById('budget-father');
        const motherInput = document.getElementById('budget-mother');
        const childInput = document.getElementById('budget-child');
        
        if (fatherInput && motherInput && childInput) {
            budgets.father = parseFloat(fatherInput.value) || 0;
            budgets.mother = parseFloat(motherInput.value) || 0;
            budgets.child = parseFloat(childInput.value) || 0;
            
            try {
                await saveBudgets();
                
                // Show alert that we're redirecting
                const alertDiv = document.createElement('div');
                alertDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:2rem;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.2);z-index:2000;text-align:center;';
                alertDiv.innerHTML = '<p style="font-size:1.1rem;color:#333;margin:0;font-weight:600;">✅ บันทึกงบประมาณเรียบร้อยแล้ว</p><p style="color:#999;margin-top:0.5rem;">กำลังไปยังแดชบอร์ด...</p>';
                document.body.appendChild(alertDiv);
                
                // Redirect to dashboard after 1.5 seconds
                setTimeout(() => {
                    window.location.href = '/index.html';
                }, 1500);
            } catch (error) {
                console.error('Error saving budgets:', error);
                alert('เกิดข้อผิดพลาด: ' + error.message);
            }
        }
    });
    
    // DASHBOARD DELETE BUTTONS - Delete all transactions by type
    document.getElementById('delete-balance')?.addEventListener('click', async ()=>{
        if(confirm('ต้องการล้างยอดคงเหลือ (ลบธุรกรรมทั้งหมด) ใช่หรือไม่?')){
            try {
                // Delete all transactions
                for(let tx of transactions) {
                    await deleteTransaction(tx.id);
                }
                await refreshData();
                notify('✅ ล้างยอดคงเหลือเรียบร้อยแล้ว');
            } catch(e) {
                console.error('Error deleting balance:', e);
                alert('เกิดข้อผิดพลาด: ' + e.message);
            }
        }
    });
    
    document.getElementById('delete-income')?.addEventListener('click', async ()=>{
        if(confirm('ต้องการล้างรายรับทั้งหมด ใช่หรือไม่?')){
            try {
                // Delete only income transactions
                const incomeTxs = transactions.filter(t => t.type === 'income');
                for(let tx of incomeTxs) {
                    await deleteTransaction(tx.id);
                }
                await refreshData();
                notify('✅ ล้างรายรับเรียบร้อยแล้ว');
            } catch(e) {
                console.error('Error deleting income:', e);
                alert('เกิดข้อผิดพลาด: ' + e.message);
            }
        }
    });
    
    document.getElementById('delete-expense')?.addEventListener('click', async ()=>{
        if(confirm('ต้องการล้างรายจ่ายทั้งหมด ใช่หรือไม่?')){
            try {
                // Delete only expense transactions
                const expenseTxs = transactions.filter(t => t.type === 'expense');
                for(let tx of expenseTxs) {
                    await deleteTransaction(tx.id);
                }
                await refreshData();
                notify('✅ ล้างรายจ่ายเรียบร้อยแล้ว');
            } catch(e) {
                console.error('Error deleting expense:', e);
                alert('เกิดข้อผิดพลาด: ' + e.message);
            }
        }
    });
    
    // DASHBOARD BUDGET MANAGEMENT
    document.getElementById('save-budgets')?.addEventListener('click', async ()=>{
        const fatherInput = document.getElementById('budget-father');
        const motherInput = document.getElementById('budget-mother');
        const childInput = document.getElementById('budget-child');
        
        if (fatherInput && motherInput && childInput) {
            budgets.father = parseFloat(fatherInput.value) || 0;
            budgets.mother = parseFloat(motherInput.value) || 0;
            budgets.child = parseFloat(childInput.value) || 0;
            
            try {
                await saveBudgets();
                
                // Show alert that we're redirecting
                const alertDiv = document.createElement('div');
                alertDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:2rem;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.2);z-index:2000;text-align:center;';
                alertDiv.innerHTML = '<p style="font-size:1.1rem;color:#333;margin:0;font-weight:600;">✅ บันทึกงบประมาณเรียบร้อยแล้ว</p><p style="color:#999;margin-top:0.5rem;">กำลังไปยังแดชบอร์ด...</p>';
                document.body.appendChild(alertDiv);
                
                // Redirect to dashboard after 1.5 seconds
                setTimeout(() => {
                    window.location.href = '/index.html';
                }, 1500);
            } catch (error) {
                console.error('Error saving budgets:', error);
                alert('เกิดข้อผิดพลาด: ' + error.message);
            }
        }
    });
    
    // SETTINGS MEMBER MANAGEMENT
    
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
    
    // Initialize member display with father's spending on page load
    const fatherSpent = transactions.filter(t=>t.member==='father' && t.type==='expense').reduce((s,t)=>s+t.amount,0);
    const displayEl = document.getElementById('selected-member-display');
    if(displayEl) {
        displayEl.innerHTML = `✓ เลือก: 👨 พ่อ | <strong>ใช้ไป: ${formatMoney(fatherSpent)}</strong>`;
    }
    
    // show flash from server if any
    if(window.location.search.includes('flash=')){
        const msg = decodeURIComponent(window.location.search.split('flash=')[1]);
        showFlash(msg);
    }
    // set budget inputs (only on settings page)
    const budgetFather = document.getElementById('budget-father');
    const budgetMother = document.getElementById('budget-mother');
    const budgetChild = document.getElementById('budget-child');
    
    if (budgetFather && budgetMother && budgetChild) {
        budgetFather.value = budgets.father || '';
        budgetMother.value = budgets.mother || '';
        budgetChild.value = budgets.child || '';
    }
});
