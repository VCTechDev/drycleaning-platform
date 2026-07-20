# 🧺 Dry Cleaning Marketplace

A multi-vendor Dry Cleaning Marketplace built using **Django**, **Django REST Framework**, **PostgreSQL**, and **React**.

This project allows customers to browse nearby dry cleaning shops, compare services and prices, place orders, and track their order status. Shop owners can manage their shops and services, while platform administrators oversee the entire system.

---

# 🚀 Project Status

> **Current Stage:** MVP Development

This project is being developed incrementally, following a role-based architecture.

---

# ✨ Features

## 👤 Customer

- JWT Authentication
- Browse Shops
- View Shop Details
- View Shop Services
- Place Orders
- View My Orders
- Track Orders

## 🏪 Shop Admin

- Manage Shop
- Manage Services
- Manage Orders
- Update Order Status

## 🚚 Delivery Agent

- View Assigned Tasks
- Pickup Orders
- Deliver Orders
- Update Delivery Status

## 🛠 Platform Admin

- Approve Shops
- Manage Users
- View All Orders
- Manage Platform

---

# 🛠 Tech Stack

## Backend

- Python
- Django
- Django REST Framework
- PostgreSQL

## Frontend

- React
- Axios

## Tools

- Git
- GitHub
- Postman

---

# 📁 Project Structure

```
drycleaning-platform/

├── backend/
│   ├── accounts/
│   ├── orders/
│   ├── shops/
│   ├── logistics/
│   └── ...
│
├── frontend/
│
└── README.md
```

---

# 🏗 Architecture

This project follows a **role-based API architecture**.

```
Customer APIs
/api/shops/
/api/orders/
/api/profile/

Shop Admin APIs
/api/shop/
/api/shop/orders/
/api/shop/services/

Delivery APIs
/api/delivery/tasks/

Platform Admin APIs
/api/admin/orders/
/api/admin/shops/
/api/admin/users/
```

Each app is organized by role.

Example:

```
shops/

├── serializers/
│   ├── customer.py
│   ├── shop_admin.py
│   └── platform_admin.py
│
├── views/
│   ├── customer.py
│   ├── shop_admin.py
│   └── platform_admin.py
```

---

# 📋 MVP Progress

## 👤 Customer Module

- [x] JWT Authentication
- [x] Shop List API
- [x] Shop Detail API
- [x] Shop Services API
- [ ] Create Order API
- [ ] My Orders API
- [ ] Order Detail API
- [ ] Profile API
- [ ] Order Tracking API

---

## 🏪 Shop Admin Module

- [ ] Dashboard
- [ ] Shop Management
- [ ] Service Management
- [ ] Order Management

---

## 🚚 Delivery Module

- [ ] Delivery Tasks
- [ ] Pickup
- [ ] Delivery

---

## 🛠 Platform Admin Module

- [ ] Shop Approval
- [ ] User Management
- [ ] Order Management

---

# 📌 Development Principles

- Role-based API design
- RESTful API structure
- One serializer per responsibility
- Least-privilege ViewSets
- Backend-controlled business logic
- Clean and maintainable architecture

---

# 🚀 Getting Started

Clone the repository

```bash
git clone <repository-url>
```

Move into the backend

```bash
cd backend
```

Create virtual environment

```bash
python -m venv env
```

Activate environment

Windows

```bash
env\Scripts\activate
```

Install dependencies

```bash
pip install -r requirements.txt
```

Run migrations

```bash
python manage.py migrate
```

Start server

```bash
python manage.py runserver
```

---

# 📅 Roadmap

- Complete Customer Module
- Complete Shop Admin Module
- Complete Delivery Module
- Complete Platform Admin Module
- React Frontend
- Deployment

---

# 👨‍💻 Author

**Vyshak**

Python Backend Developer | Django | Django REST Framework

---