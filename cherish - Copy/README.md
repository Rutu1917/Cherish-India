# Cherish Books - E-Commerce Application

A clean, modern, and responsive full-stack bookstore e-commerce web application.

## 🛠️ Tech Stack
- **Frontend**: React.js (Vite)
- **Styling**: Modern Vanilla CSS with variables, transitions, and automatic Light/Dark mode.
- **Backend**: Node.js + Express.js REST API
- **Database**: SQLite (file-based database, zero-installation setup).

## ✨ Key Features
- **User Authentication**: Secure Login & Registration using JWT and `bcryptjs` password hashing.
- **Product Catalog**: Dynamic list of books fetched from the backend, supporting search by Title/Author and category filters.
- **Book Details**: Dynamic modal view displaying book descriptions and details.
- **Shopping Cart**: Real-time quantity adjustments, items addition/removal, total price calculation, and local storage state persistence.
- **Checkout Flow**: Static order summary, guest checkout support, and database order placement.
- **Dark/Light Mode**: Smooth theme toggling using CSS variables.

## 🚀 Enhancements & Challenges
- **SQLite Database**: Replaced heavier database setups (like MongoDB/MySQL) with a self-contained SQLite file, making the application zero-setup and instantly runnable.
- **State Management**: Built navigation, modal views, and cart states using React hooks directly, keeping the codebase simple and easy for a fresher to present and explain.
