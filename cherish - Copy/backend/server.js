const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'your-very-secret-key-change-this-in-production';

// Middleware
app.use(cors());
app.use(express.json());

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// --- AUTHENTICATION ROUTES ---

// Register User
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'All fields (name, email, password) are required' });
  }

  // Hash Password
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      return res.status(500).json({ message: 'Error hashing password' });
    }

    const query = `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`;
    db.run(query, [name, email, hashedPassword], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ message: 'Email address already registered' });
        }
        return res.status(500).json({ message: 'Database error registering user' });
      }

      res.status(201).json({
        message: 'User registered successfully',
        userId: this.lastID
      });
    });
  });
});

// Login User
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Database error during login' });
    }

    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Compare passwords
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        return res.status(500).json({ message: 'Error verifying password' });
      }

      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid email or password' });
      }

      // Generate JWT Token
      const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      });
    });
  });
});

// Get Current User Profile
app.get('/api/auth/profile', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// --- BOOK CATALOG ROUTES ---

// Get all books with optional search & filter
app.get('/api/books', (req, res) => {
  const { search, category } = req.query;
  let query = 'SELECT * FROM books';
  const params = [];

  const conditions = [];
  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }
  if (search) {
    conditions.push('(title LIKE ? OR author LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error fetching books' });
    }
    res.json(rows);
  });
});

// Get a single book by ID
app.get('/api/books/:id', (req, res) => {
  const bookId = req.params.id;
  db.get('SELECT * FROM books WHERE id = ?', [bookId], (err, row) => {
    if (err) {
      return res.status(500).json({ message: 'Database error fetching book details' });
    }
    if (!row) {
      return res.status(404).json({ message: 'Book not found' });
    }
    res.json(row);
  });
});

// Add a book (Admin)
app.post('/api/books', (req, res) => {
  const { title, author, category, price, description, image_url } = req.body;
  if (!title || !author || !category || !price) {
    return res.status(400).json({ message: 'Title, author, category, and price are required' });
  }

  const query = `INSERT INTO books (title, author, category, price, description, image_url) VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(query, [title, author, category, parseFloat(price), description || '', image_url || ''], function(err) {
    if (err) {
      return res.status(500).json({ message: 'Database error adding book' });
    }
    res.status(201).json({ message: 'Book added successfully', bookId: this.lastID });
  });
});

// Update a book (Admin)
app.put('/api/books/:id', (req, res) => {
  const { title, author, category, price, description, image_url } = req.body;
  const bookId = req.params.id;

  if (!title || !author || !category || !price) {
    return res.status(400).json({ message: 'Title, author, category, and price are required' });
  }

  const query = `UPDATE books SET title = ?, author = ?, category = ?, price = ?, description = ?, image_url = ? WHERE id = ?`;
  db.run(query, [title, author, category, parseFloat(price), description || '', image_url || '', bookId], function(err) {
    if (err) {
      return res.status(500).json({ message: 'Database error updating book' });
    }
    res.json({ message: 'Book updated successfully' });
  });
});

// Delete a book (Admin)
app.delete('/api/books/:id', (req, res) => {
  const bookId = req.params.id;
  db.run('DELETE FROM books WHERE id = ?', [bookId], function(err) {
    if (err) {
      return res.status(500).json({ message: 'Database error deleting book' });
    }
    res.json({ message: 'Book deleted successfully' });
  });
});

// --- ORDERS ROUTES ---

// Place an Order
app.post('/api/orders', (req, res) => {
  const { userId, customerName, email, address, totalAmount, items } = req.body;

  if (!customerName || !email || !address || !totalAmount || !items) {
    return res.status(400).json({ message: 'Incomplete order details' });
  }

  const query = `INSERT INTO orders (user_id, customer_name, email, address, total_amount, items) VALUES (?, ?, ?, ?, ?, ?)`;
  const itemsString = typeof items === 'string' ? items : JSON.stringify(items);

  db.run(query, [userId || null, customerName, email, address, totalAmount, itemsString], function(err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Database error placing order' });
    }

    res.status(201).json({
      message: 'Order placed successfully',
      orderId: this.lastID
    });
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
