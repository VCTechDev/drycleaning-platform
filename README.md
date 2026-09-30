# VeeCleen

VeeCleen is a multi-vendor dry-cleaning marketplace that connects customers with local dry-cleaning shops.

Customers can discover nearby shops, browse the services offered by each shop, place pickup orders, track their orders, and manage their account from a single platform.

The project is being developed as a full-stack web application using Django REST Framework and React.

---

## Project Status

### Customer MVP — Completed

The complete customer-facing MVP has been implemented and merged into the `main` branch.

The remaining parts of the marketplace, including shop administration, pickup/delivery operations, and platform administration, are being developed incrementally.

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
````

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

Handles customer registration and customer profile functionality.

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

### Logistics

Contains the domain models required for pickup and delivery operations.

The broader shop, delivery, and platform administration workflows are still under development.

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

### Planned / In Development

* Shop Admin workflow
* Shop order management
* Shop service management
* Pickup and delivery workflow
* Delivery Agent workflow
* Platform Admin workflow
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

```
