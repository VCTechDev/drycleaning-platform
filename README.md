# VeeCleen

VeeCleen is a multi-vendor dry-cleaning marketplace that connects customers with local dry-cleaning shops.

Customers can discover nearby shops, browse the services offered by each shop, place pickup orders, track their orders, and manage their account from a single platform.

The project is being developed as a full-stack web application using Django REST Framework and React.

---

## Project Status

### Customer MVP — Completed

The complete customer-facing MVP has been implemented and merged into the `main` branch.

### Platform Admin MVP — Completed

The Platform Admin MVP has been implemented and merged into the `main` branch. It provides authenticated Platform Admin monitoring and workflow tools for the marketplace.

Shop administration, pickup/delivery operations, and production hardening remain in development.

The next major implementation area is Shop Admin; the roadmap milestone numbering is preserved below even though Platform Admin was completed first.

---

## Customer MVP

The current customer flow is:

```text
Home
  ↓
Browse Shops
  ↓
View Shop & Services
  ↓
Select Services
  ↓
Enter Pickup Details
  ↓
Place Order
  ↓
View My Orders
  ↓
View Order Details
  ↓
Track Order
  ↓
Manage Profile
```

### Customer Features

* Customer registration and login
* Browse approved dry-cleaning shops
* Search and filter shops
* Sort shops based on available options
* View shop details
* View services offered by a shop
* Select services and garment quantities
* Enter pickup address and details
* Create an order
* View customer orders
* Search and filter orders
* View complete order details
* Track order progress
* View order status history
* View historical order item information
* View and update customer profile
* Responsive mobile-first interface

---

## Order Workflow

The current order lifecycle is:

```text
Placed
  ↓
Accepted
  ↓
Pickup Scheduled
  ↓
Picked Up
  ↓
Processing
  ↓
Ready
  ↓
Delivered
```

An order can also be cancelled where permitted by the current backend workflow.

The system maintains order status history so customers can see the progress of their orders.

Order items preserve information such as:

* Garment
* Service
* Quantity
* Unit price
* Line total

This allows historical orders to remain consistent even if a shop later changes its current service information or pricing.

---

## Technology Stack

### Backend

* Python
* Django
* Django REST Framework
* Django REST Framework Simple JWT
* PostgreSQL

### Frontend

* React
* TypeScript
* Vite
* React Router
* Axios
* Tailwind CSS
* Lucide React

---

## Project Structure

```text
drycleaning-platform/
│
├── backend/
│   ├── accounts/
│   ├── config/
│   ├── logistics/
│   ├── orders/
│   ├── shops/
│   ├── users/
│   ├── manage.py
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── services/
│   │   └── lib/
│   ├── package.json
│   └── vite.config.ts
│
└── README.md
```

---

## Backend Architecture

The backend is built with Django and Django REST Framework.

The main backend domains currently include:

### Users

Handles the custom user model and application roles.

Current roles include:

* Customer
* Shop Admin
* Delivery Agent
* Platform Admin

### Accounts

Handles customer registration, customer profile functionality, Platform Admin self-profile functionality, and authentication/password flows.

### Shops

Handles:

* Shop information
* Shop services
* Garment/service information
* Approved shop discovery
* Shop filtering and search

### Orders

Handles:

* Order creation
* Order items
* Customer order listing
* Order details
* Order status
* Order status history
* Customer order tracking
* Platform Admin order monitoring and server-side analytics

### Logistics

Contains the domain models required for pickup and delivery operations.

Pickup/delivery APIs and frontend workflows are still under development.

### Platform Admin

The Platform Admin workspace includes:

* Dashboard monitoring
* Shop application review and approval workflows
* Approved shop monitoring and operational-status updates
* Platform service management
* Service request review workflows
* Read-only order monitoring and analytics
* Read-only user monitoring
* Authenticated Platform Admin profile management

---

## API

The backend API is available under:

```text
/api/
```

### Authentication

| Method | Endpoint              | Description                      |
| ------ | --------------------- | -------------------------------- |
| POST   | `/api/token/`         | Obtain access and refresh tokens |
| POST   | `/api/token/refresh/` | Refresh an access token          |
| POST   | `/api/register/`      | Register a customer              |

### Customer Profile

| Method | Endpoint        | Description                             |
| ------ | --------------- | --------------------------------------- |
| GET    | `/api/profile/` | Retrieve authenticated customer profile |
| PATCH  | `/api/profile/` | Update authenticated customer profile   |

### Shops

| Method | Endpoint                     | Description                           |
| ------ | ---------------------------- | ------------------------------------- |
| GET    | `/api/shops/`                | List approved shops                   |
| GET    | `/api/shops/{id}/`           | Retrieve shop details                 |
| GET    | `/api/shops/{id}/services/`  | Retrieve services available at a shop |
| GET    | `/api/shops/filter-options/` | Retrieve shop filter options          |

### Orders

| Method | Endpoint                     | Description                          |
| ------ | ---------------------------- | ------------------------------------ |
| POST   | `/api/orders/`               | Create a customer order              |
| GET    | `/api/orders/`               | List authenticated customer's orders |
| GET    | `/api/orders/{id}/`          | Retrieve order details               |
| GET    | `/api/orders/{id}/tracking/` | Retrieve order tracking information  |

Customer order APIs are scoped to the authenticated customer.

### Platform Admin

Platform Admin endpoints require an authenticated user with the `platform_admin` role. Platform Admin Orders and Users APIs are read-only. Other write operations below are limited to the documented workflow actions.

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/api/platform/dashboard/` | Retrieve Platform Admin dashboard metrics and trends |
| GET | `/api/platform/shop-applications/` | List non-draft shop applications |
| GET | `/api/platform/shop-applications/{public_id}/` | Retrieve a shop application |
| POST | `/api/platform/shop-applications/{public_id}/under-review/` | Move an application into review |
| POST | `/api/platform/shop-applications/{public_id}/approve/` | Approve and provision a shop application |
| POST | `/api/platform/shop-applications/{public_id}/reject/` | Reject an application with a reason |
| GET | `/api/platform/shops/` | List approved shops |
| GET | `/api/platform/shops/{id}/` | Retrieve approved shop details |
| POST | `/api/platform/shops/{id}/operational-status/` | Update whether a shop is open |
| GET | `/api/platform/services/` | List platform services |
| POST | `/api/platform/services/` | Create a platform service |
| GET | `/api/platform/services/{id}/` | Retrieve a platform service |
| PUT/PATCH | `/api/platform/services/{id}/` | Update a platform service; deletion is not supported |
| GET | `/api/platform/service-requests/` | List service requests |
| GET | `/api/platform/service-requests/{id}/` | Retrieve a service request |
| POST | `/api/platform/service-requests/{id}/under-review/` | Move a service request into review |
| POST | `/api/platform/service-requests/{id}/approve/` | Approve a service request |
| POST | `/api/platform/service-requests/{id}/reject/` | Reject a service request with a reason |
| GET | `/api/platform/orders/` | List all orders across shops |
| GET | `/api/platform/orders/{id}/` | Retrieve order details |
| GET | `/api/platform/orders/analytics/` | Retrieve server-side order summary analytics |
| GET | `/api/platform/users/` | List eligible customer, Shop Admin, and Delivery Agent accounts |
| GET | `/api/platform/users/{id}/` | Retrieve an eligible user |
| GET | `/api/platform/profile/` | Retrieve the authenticated Platform Admin profile |
| PATCH | `/api/platform/profile/` | Update the authenticated Platform Admin profile |

The Platform Admin order analytics contract defines `total_orders` to include cancelled orders and `gross_order_value` to exclude cancelled orders. No commission, platform-profit, or platform-earnings calculation is exposed. The profile endpoint is self-scoped to `request.user`; it does not accept a user ID and only updates the permitted personal profile fields.

The Platform Admin dashboard accepts an optional `days` query parameter for a 1–365 day trend range. Order filters include date presets, custom creation-date ranges, order status, payment status, and shop. User filters include search, role, and account status. Paginated list endpoints use the global page size of 10. Profile updates are limited to `first_name`, `last_name`, `email`, and `phone_number`; `username`, role, account status, permissions, and password are protected.

---

## Authentication

The application uses Django REST Framework Simple JWT for authentication.

The frontend communicates with the backend through Axios and sends authenticated requests using Bearer access tokens.

The authentication flow includes:

```text
Register
   ↓
Login
   ↓
Access Token
   ↓
Authenticated API Requests
   ↓
Refresh Token when required
```

---

## Database

PostgreSQL is used as the primary database.

The project contains database models for domains including:

* Users
* Shops
* Services
* Shop Services
* Orders
* Order Items
* Order Status History
* Delivery Agents
* Delivery Tasks

---

## Local Development

### Backend Setup

Navigate to the backend directory:

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv env
```

Activate the environment.

#### Windows

```bash
env\Scripts\activate
```

#### macOS / Linux

```bash
source env/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Configure the PostgreSQL database using your local development configuration.

The backend reads these environment variables from `backend/.env` or the process environment:

| Variable | Purpose |
| -------- | ------- |
| `DJANGO_SECRET_KEY` | Django secret key; the development fallback must not be used in real deployments |
| `DJANGO_DEBUG` | Enables Django debug mode when set to `true` |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated allowed hostnames |
| `DB_ENGINE` | Django database engine; defaults to PostgreSQL |
| `DB_NAME` | Database name |
| `DB_USER` | Database user |
| `DB_PASSWORD` | Database password |
| `DB_HOST` | Database host |
| `DB_PORT` | Database port; defaults to `5432` |
| `EMAIL_BACKEND` | Django email backend |
| `EMAIL_HOST` | SMTP host |
| `EMAIL_PORT` | SMTP port |
| `EMAIL_HOST_USER` | SMTP username |
| `EMAIL_HOST_PASSWORD` | SMTP password |
| `EMAIL_USE_TLS` | Enables SMTP TLS when set to `true` |
| `EMAIL_USE_SSL` | Enables SMTP SSL when set to `true` |
| `DEFAULT_FROM_EMAIL` | Default sender address |
| `CORS_ALLOWED_ORIGINS` | Comma-separated frontend origins allowed by CORS |

The configured Django timezone is `UTC`, and the global Django REST Framework page size is 10.

Apply migrations:

```bash
python manage.py migrate
```

Start the Django development server:

```bash
python manage.py runserver
```

The backend will normally run at:

```text
http://127.0.0.1:8000/
```

---

### Frontend Setup

Open a second terminal and navigate to the frontend:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Configure the frontend API URL in `.env`:

```env
VITE_API_URL=http://127.0.0.1:8000/api
```

Start the Vite development server:

```bash
npm run dev
```

The frontend will normally be available at the local Vite development URL shown in the terminal.

### Available Frontend Commands

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

### Backend Tests

From the `backend` directory:

```bash
python manage.py test
```

Previously observed verification results, not newly executed as part of this documentation update:

* Backend test suite: 79 tests passed for the implemented test cases.
* Frontend production build: passed.
* Frontend lint: has an existing error in `frontend/src/components/ui/button.tsx` and warnings in `frontend/src/pages/customer/PickupDetails.tsx`.

These previously observed results do not claim comprehensive endpoint, invalid-input, frontend automated-test, or security coverage.

---

## Development Workflow

Development follows a feature-branch and Pull Request workflow.

```text
main
  ↓
Create feature branch
  ↓
Develop feature
  ↓
Commit changes
  ↓
Push feature branch
  ↓
Create Pull Request
  ↓
Review and verify
  ↓
Merge into main
  ↓
Delete feature branch
```

The repository uses `main` as the primary branch.

Completed feature branches are removed after their changes have been merged.

---

## Current Progress

### Completed

* Customer authentication
* Customer home page
* Shop discovery
* Shop search and filtering
* Shop details
* Service selection
* Pickup details
* Customer order creation
* Customer order list
* Order details
* Order tracking
* Customer profile
* Customer frontend MVP
* Platform Admin dashboard
* Platform Admin shop application management
* Platform Admin shop monitoring
* Platform Admin service management
* Platform Admin service request management
* Platform Admin order monitoring and analytics
* Platform Admin user monitoring
* Platform Admin profile management

### Planned / In Development

* Shop Admin workflow
* Shop order management
* Shop service management
* Pickup and delivery workflow
* Delivery Agent workflow
* Additional testing and production hardening

---

## Screenshots

Customer-facing UI screenshots will be added to the repository as the project presentation is finalized.

---

## Project Goals

The goal of VeeCleen is to provide a centralized marketplace where customers can discover local dry-cleaning businesses and manage their cleaning orders through a single platform.

The project is also being developed as a practical full-stack application with a focus on:

* REST API design
* Role-based application architecture
* Database relationships
* Authentication and authorization
* Order lifecycle management
* Responsive frontend development
* Clean separation between frontend and backend
* Maintainable Git-based development workflow

---

## License

This project is currently maintained as a personal development and portfolio project.
