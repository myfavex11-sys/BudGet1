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

// serve static public folder
app.use(express.static(path.join(__dirname, 'public')));

function authRequired(req, res, next) {
    if (req.session && req.session.authenticated) return next();
    res.redirect('/login.html');
}

// root redirect
app.get('/', (req, res) => {
    if (req.session && req.session.authenticated) res.redirect('/index.html');
    else res.redirect('/login.html');
});

// login route
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === '1234') {
        req.session.authenticated = true;
        req.session.user = 'admin';
        res.redirect('/index.html');
    } else {
        res.redirect('/login.html?error=1');
    }
});

// logout
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login.html');
    });
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
