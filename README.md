# Smart Inventory & Sales Management

A full-stack inventory and sales management web application for small businesses, built with Node.js, Express, MongoDB, Mongoose, JWT authentication, and a responsive HTML/CSS/JavaScript frontend.

## Features

- User registration and login with hashed passwords and JWT authentication
- Protected backend routes for products, sales, dashboard, and reports
- Product CRUD with duplicate-name protection and stock validation
- Sales recording with automatic stock reduction and insufficient-stock prevention
- Dashboard metrics, low-stock alerts, and Chart.js analytics
- Daily sales report and monthly sales summary
- Toast notifications and loading states for a smoother UI

## Project Structure

```text
project/
├── frontend/
│   ├── index.html
│   ├── dashboard.html
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── api.js
│       ├── auth.js
│       └── dashboard.js
├── backend/
│   ├── server.js
│   ├── config/
│   │   └── db.js
│   ├── models/
│   ├── routes/
│   ├── controllers/
│   └── middleware/
├── .env.example
├── package.json
└── README.md
```

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Make sure MongoDB is running locally or update `MONGO_URI` in `.env`.

3. Copy `.env.example` to `.env` if needed and adjust values:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/smart_inventory_sales
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=7d
LOW_STOCK_THRESHOLD=5
```

4. Start the development server:

```bash
npm run dev
```

5. Open the app in your browser:

```text
http://localhost:5000
```

## Core API Endpoints

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`

### Products

- `GET /api/products`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`

### Sales

- `GET /api/sales`
- `POST /api/sales`

### Dashboard and Reports

- `GET /api/dashboard/summary`
- `GET /api/reports/daily?date=YYYY-MM-DD`
- `GET /api/reports/monthly?month=YYYY-MM`

## Business Rules Covered

- Product quantity never drops below zero
- Sales are blocked if stock is insufficient
- Product names are protected against duplicates per user
- Reports and metrics are scoped to the authenticated user
