# BudgetNgai

This repository contains a simple static website prototype for a
family income-expense tracker app with a calm, minimalist UI/UX. It is
intended as a front-end demonstration; there is no backend logic.

## Viewing the Site

You can open `public/index.html` directly in a browser, or run a local
HTTP server (or start the Node server below):

```bash
# static server:
cd public
python -m http.server 8000
# or run the express app (requires node modules)
npm install
npm start
```

Then browse to `http://localhost:8000` (or `http://localhost:3000` for the Node
server).

The Node/Express backend provides simple authentication and transaction
APIs plus additional features:

- Budget goals per member with progress bars (green/orange/red after 80%/100%)  
- Trend bar chart showing expense by member over past 6 months  
- Receipt upload support; files stored under `public/uploads`  
- In‑app notifications when any member adds a transaction or a high expense occurs  
- Flash messages notify when balance goes negative  
- Filtering transactions by today/week/month  
- CSV/Excel/PDF export options for admins via `/admin/export` (use `?format=xlsx` or `?format=pdf`)

Login with **admin / 1234** at `/login.html` and access `/admin` for
tables. Sessions are used to keep the admin logged in.

## Structure

- `public/index.html` - main dashboard page with summary cards, donut charts, bar-chart trends, transaction list and form; supports receipt icons, filters, budget progress with alerts, and notifications
- `public/login.html` - login form styled with glassmorphism
- `public/settings.html` - settings for members (roles) and hierarchical categories
- `public/css/style.css` - updated stylesheet with glassmorphism, responsive layout
- `public/js/app.js` - script managing members, categories, budgets, transactions, storage via API, filters, and UI interactions including receipt modal

Feel free to extend UI components or plug in a backend.