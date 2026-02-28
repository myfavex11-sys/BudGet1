const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { stringify } = require('csv-stringify/sync');

const app = express();
const port = process.env.PORT || 3000;

// simple in-memory storage
let transactions = [];
let budgets = { father:0, mother:0, child:0 };
let users = [
    { id: 1, family_name: 'Demo Family', username: 'demo', password: '1234' }
];

// upload config
const upload = multer({ dest: path.join(__dirname,'public','uploads') });

// middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({
    secret: 'budget-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 }
}));

// flash middleware
app.use((req,res,next)=>{
    res.locals.flash = req.session.flash;
    delete req.session.flash;
    next();
});

function authRequired(req, res, next) {
    if (req.session && req.session.authenticated) return next();
    res.status(401).json({ success: false, error: 'Not authenticated' });
}

function pageAuthRequired(req, res, next) {
    if (req.session && req.session.authenticated) return next();
    res.redirect('/login.html');
}

// root redirect to home
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Protected page routes (MUST be before static middleware)
app.get('/index.html', pageAuthRequired, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/settings.html', pageAuthRequired, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

app.get('/admin.html', pageAuthRequired, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// serve static public folder (for CSS, JS, images, and public pages like home.html, login.html, register.html)
app.use(express.static(path.join(__dirname, 'public')));

// root redirect to home
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// registration route
app.post('/register', (req, res) => {
    const { family_name, username, password } = req.body;
    
    // Validation
    if (!family_name || !username || !password) {
        return res.status(400).json({ success: false, error: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }
    
    if (username.length < 4) {
        return res.status(400).json({ success: false, error: 'ชื่อผู้ใช้ต้องมีอย่างน้อย 4 ตัวอักษร' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ success: false, error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
    }
    
    // Check if username already exists
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ success: false, error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' });
    }
    
    // Create new user
    const newUser = {
        id: users.length + 1,
        family_name,
        username,
        password
    };
    
    users.push(newUser);
    res.json({ success: true, message: 'สมัครสมาชิกสำเร็จ' });
});

// login route
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    // Find user
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        req.session.authenticated = true;
        req.session.user = user;
        res.json({ success: true, message: 'เข้าสู่ระบบสำเร็จ' });
    } else {
        res.status(401).json({ success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }
});

// logout
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/home.html');
    });
});

// get current user info
app.get('/api/user', authRequired, (req, res) => {
    if (req.session && req.session.user) {
        res.json({ success: true, user: { family_name: req.session.user.family_name, username: req.session.user.username } });
    } else {
        res.status(401).json({ success: false, error: 'Not authenticated' });
    }
});

// admin page, protected
app.get('/admin', authRequired, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// budgets API
app.get('/api/budgets', authRequired, (req,res)=>{
    res.json(budgets);
});
app.post('/api/budgets', authRequired, (req,res)=>{
    Object.assign(budgets, req.body);
    res.json({ success:true });
});

// export CSV/XLSX/PDF
app.get('/admin/export', authRequired, (req,res)=>{
    const fmt = req.query.format || 'csv';
    const header = ['id','note','amount','type','member','category','date','receipt'];
    const records = transactions.map(t=>[
        t.id, t.note||'', t.amount, t.type, t.member, t.category.parent+(t.category.sub?'/'+t.category.sub:''), t.date, t.receipt||''
    ]);
    const csv = stringify(records,{ header:true, columns:header });
    if(fmt==='xlsx'){
        res.setHeader('Content-disposition','attachment; filename=transactions.xlsx');
        res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        return res.send(csv);
    }
    if(fmt==='pdf'){
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({margin:30});
        res.setHeader('Content-disposition','attachment; filename=transactions.pdf');
        res.set('Content-Type','application/pdf');
        doc.pipe(res);
        doc.fontSize(16).text('Transactions Report', {align:'center'});
        doc.moveDown();
        records.forEach(r=>{
            doc.fontSize(10).text(r.join(' | '));
        });
        doc.end();
        return;
    }
    // default csv
    res.setHeader('Content-disposition','attachment; filename=transactions.csv');
    res.set('Content-Type','text/csv');
    res.send(csv);
});

// serve uploads
app.use('/uploads', express.static(path.join(__dirname,'public','uploads')));

// api for transactions
app.get('/api/transactions', authRequired, (req, res) => {
    res.json(transactions);
});

app.post('/api/transactions', authRequired, upload.single('receipt'), (req, res) => {
    const tx = req.body;
    tx.id = Date.now();
    if(req.file){ tx.receipt=req.file.filename; }
    transactions.push(tx);
    // flash-related message
    let flashMsg = null;
    let balance = transactions.reduce((sum,t)=> sum + (t.type==='income'?t.amount:-t.amount),0);
    if(balance<0){ 
        flashMsg = 'ยอดคงเหลือติดลบ!';
    }
    res.json({ success: true, tx, flash: flashMsg });
});

app.put('/api/transactions/:id', authRequired, (req, res) => {
    const id = parseInt(req.params.id, 10);
    const idx = transactions.findIndex(t => t.id === id);
    if (idx !== -1) {
        transactions[idx] = { ...transactions[idx], ...req.body };
        res.json({ success: true, tx: transactions[idx] });
    } else res.status(404).json({ error: 'not found' });
});

app.delete('/api/transactions/:id', authRequired, (req, res) => {
    const id = parseInt(req.params.id, 10);
    transactions = transactions.filter(t => t.id !== id);
    res.json({ success: true });
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
