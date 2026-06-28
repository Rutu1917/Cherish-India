import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:5000/api';

function App() {
  // Navigation & Theme State
  const [currentPage, setCurrentPage] = useState('catalog'); // 'catalog', 'cart', 'checkout', 'login', 'register', 'success'
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  
  // Auth State
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  
  // Catalog State
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [selectedBook, setSelectedBook] = useState(null); // For detail view modal
  
  // Cart State (Persisted locally)
  const [cart, setCart] = useState(JSON.parse(localStorage.getItem('cart')) || []);
  
  // Order State
  const [orderForm, setOrderForm] = useState({ customerName: '', email: '', address: '' });
  const [placedOrderId, setPlacedOrderId] = useState(null);
  
  // Notifications / UI State
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Admin State
  const [adminBookForm, setAdminBookForm] = useState({ title: '', author: '', category: 'Fiction', price: '', description: '', image_url: '' });
  const [editingBookId, setEditingBookId] = useState(null);
  const [adminShowForm, setAdminShowForm] = useState(false);

  // Set Theme Class on Document Element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Persist Cart to LocalStorage
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  // Fetch Books Catalog
  const fetchBooks = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/books`;
      const queryParams = [];
      if (search) queryParams.push(`search=${encodeURIComponent(search)}`);
      if (category) queryParams.push(`category=${encodeURIComponent(category)}`);
      
      if (queryParams.length > 0) {
        url += `?${queryParams.join('&')}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setBooks(data);
      } else {
        showToast(data.message || 'Failed to fetch books', 'error');
      }
    } catch (err) {
      showToast('Backend server connection error', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch books on load, or when filters change
  useEffect(() => {
    fetchBooks();
  }, [search, category]);

  // Sync order form when user logs in/out
  useEffect(() => {
    if (user) {
      setOrderForm({
        customerName: user.name || '',
        email: user.email || '',
        address: ''
      });
    } else {
      setOrderForm({ customerName: '', email: '', address: '' });
    }
  }, [user]);

  // Toast Helper
  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  // Auth Operations
  const handleAuthSubmit = async (e, mode) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = mode === 'register' ? '/auth/register' : '/auth/login';
      const bodyData = mode === 'register' 
        ? { name: authForm.name, email: authForm.email, password: authForm.password }
        : { email: authForm.email, password: authForm.password };

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      const data = await res.json();

      if (res.ok) {
        if (mode === 'register') {
          showToast('Registration successful! Please login.', 'success');
          setCurrentPage('login');
        } else {
          setUser(data.user);
          setToken(data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          localStorage.setItem('token', data.token);
          showToast(`Welcome back, ${data.user.name}!`, 'success');
          setCurrentPage('catalog');
        }
        setAuthForm({ name: '', email: '', password: '' });
      } else {
        showToast(data.message || 'Auth action failed', 'error');
      }
    } catch (err) {
      showToast('Network error, try again later', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setToken('');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    showToast('Logged out successfully', 'success');
    setCurrentPage('catalog');
  };

  // Cart Operations
  const addToCart = (book) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === book.id);
      if (existing) {
        showToast(`Increased quantity of ${book.title}`, 'success');
        return prevCart.map((item) =>
          item.id === book.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      showToast(`${book.title} added to cart`, 'success');
      return [...prevCart, { ...book, quantity: 1 }];
    });
  };

  const updateQuantity = (id, amount) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.id === id) {
            const nextQty = item.quantity + amount;
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (id, title) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
    showToast(`${title} removed from cart`, 'success');
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0).toFixed(2);
  };

  // Place Order Action
  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      showToast('Your cart is empty', 'error');
      return;
    }

    setLoading(true);
    try {
      const orderData = {
        userId: user ? user.id : null,
        customerName: orderForm.customerName,
        email: orderForm.email,
        address: orderForm.address,
        totalAmount: parseFloat(getCartTotal()),
        items: cart.map((item) => ({
          bookId: item.id,
          title: item.title,
          price: item.price,
          quantity: item.quantity
        }))
      };

      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      const data = await res.json();

      if (res.ok) {
        setPlacedOrderId(data.orderId);
        setCart([]);
        showToast('Order placed successfully!', 'success');
        setCurrentPage('success');
      } else {
        showToast(data.message || 'Failed to place order', 'error');
      }
    } catch (err) {
      showToast('Network error while placing order', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Admin Actions
  const handleAdminBookSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = editingBookId ? `${API_BASE}/books/${editingBookId}` : `${API_BASE}/books`;
      const method = editingBookId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...adminBookForm, price: parseFloat(adminBookForm.price) })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(editingBookId ? 'Book updated successfully' : 'Book added successfully');
        setAdminBookForm({ title: '', author: '', category: 'Fiction', price: '', description: '', image_url: '' });
        setEditingBookId(null);
        setAdminShowForm(false);
        fetchBooks();
      } else {
        showToast(data.message || 'Action failed', 'error');
      }
    } catch (err) {
      showToast('Error saving book details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (book) => {
    setEditingBookId(book.id);
    setAdminBookForm({
      title: book.title,
      author: book.author,
      category: book.category,
      price: book.price.toString(),
      description: book.description || '',
      image_url: book.image_url || ''
    });
    setAdminShowForm(true);
  };

  const handleDeleteBook = async (id) => {
    if (!window.confirm('Are you sure you want to delete this book?')) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/books/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Book deleted successfully');
        fetchBooks();
      } else {
        showToast('Failed to delete book', 'error');
      }
    } catch (err) {
      showToast('Error deleting book', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* Toast Notification Popups */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Navigation Header */}
      <header className="navbar">
        <div className="nav-brand" onClick={() => setCurrentPage('catalog')} style={{ cursor: 'pointer' }}>
          📚 <span>Cherish Books</span>
        </div>
        <div className="nav-links">
          <span 
            className={`nav-link ${currentPage === 'catalog' ? 'active' : ''}`} 
            onClick={() => setCurrentPage('catalog')}
          >
            Catalog
          </span>
          {user && user.email === 'admin@cherish.com' && (
            <span 
              className={`nav-link ${currentPage === 'admin' ? 'active' : ''}`} 
              onClick={() => { setCurrentPage('admin'); setAdminShowForm(false); }}
            >
              Admin Panel
            </span>
          )}
          <span 
            className={`nav-link cart-badge-container ${currentPage === 'cart' ? 'active' : ''}`} 
            onClick={() => setCurrentPage('cart')}
          >
            Cart
            {cart.length > 0 && <span className="cart-badge">{cart.reduce((s, i) => s + i.quantity, 0)}</span>}
          </span>
          {user ? (
            <>
              <span className="nav-link" style={{ fontWeight: '600' }}>
                👤 {user.name}
              </span>
              <button className="btn btn-secondary" onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => setCurrentPage('login')}>
              Login
            </button>
          )}
          <button 
            className="btn-theme" 
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      {/* Main Screen Content */}
      <main className="main-content">
        {loading && <div style={{ textAlign: 'center', margin: '2rem', fontSize: '1.2rem' }}>Loading application...</div>}

        {/* ADMIN PANEL PAGE */}
        {currentPage === 'admin' && user && user.email === 'admin@cherish.com' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div>
                <h2>Admin Inventory Control</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Manage bookstore products directly in the database</p>
              </div>
              {!adminShowForm && (
                <button className="btn btn-primary" onClick={() => {
                  setEditingBookId(null);
                  setAdminBookForm({ title: '', author: '', category: 'Fiction', price: '', description: '', image_url: '' });
                  setAdminShowForm(true);
                }}>
                  + Add New Book
                </button>
              )}
            </div>

            {adminShowForm ? (
              <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: 'var(--bg-secondary)', padding: '2rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>{editingBookId ? 'Edit Book Details' : 'Add New Product'}</h3>
                <form onSubmit={handleAdminBookSubmit}>
                  <div className="form-group">
                    <label className="form-label">Book Title</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      required
                      value={adminBookForm.title}
                      onChange={(e) => setAdminBookForm({ ...adminBookForm, title: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Author Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      required
                      value={adminBookForm.author}
                      onChange={(e) => setAdminBookForm({ ...adminBookForm, author: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select 
                      className="form-input"
                      value={adminBookForm.category}
                      onChange={(e) => setAdminBookForm({ ...adminBookForm, category: e.target.value })}
                    >
                      <option value="Fiction">Fiction</option>
                      <option value="Tech">Tech</option>
                      <option value="Self-Help">Self-Help</option>
                      <option value="Science">Science</option>
                      <option value="Biography">Biography</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Price ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-input" 
                      required
                      value={adminBookForm.price}
                      onChange={(e) => setAdminBookForm({ ...adminBookForm, price: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea 
                      className="form-input" 
                      rows="4"
                      value={adminBookForm.description}
                      onChange={(e) => setAdminBookForm({ ...adminBookForm, description: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Image URL</label>
                    <input 
                      type="url" 
                      className="form-input" 
                      value={adminBookForm.image_url}
                      onChange={(e) => setAdminBookForm({ ...adminBookForm, image_url: e.target.value })}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                      {editingBookId ? 'Save Changes' : 'Add Book'}
                    </button>
                    <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setAdminShowForm(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '1rem' }}>Book</th>
                      <th style={{ padding: '1rem' }}>Author</th>
                      <th style={{ padding: '1rem' }}>Category</th>
                      <th style={{ padding: '1rem' }}>Price</th>
                      <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {books.map((book) => (
                      <tr key={book.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <img src={book.image_url} alt={book.title} style={{ width: '40px', height: '50px', objectFit: 'contain' }} />
                          <span style={{ fontWeight: '600' }}>{book.title}</span>
                        </td>
                        <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{book.author}</td>
                        <td style={{ padding: '1rem' }}><span className="book-category" style={{ margin: 0 }}>{book.category}</span></td>
                        <td style={{ padding: '1rem', fontWeight: '700' }}>${book.price.toFixed(2)}</td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', marginRight: '0.5rem', fontSize: '0.85rem' }} onClick={() => handleEditClick(book)}>
                            Edit
                          </button>
                          <button className="btn btn-danger" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => handleDeleteBook(book.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 1. CATALOG PAGE */}
        {currentPage === 'catalog' && (
          <div>
            <div className="catalog-header">
              <div>
                <h2>Discover Your Next Read</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Browse our curated collection of books</p>
              </div>
              <div className="search-filters">
                <input 
                  type="text" 
                  className="search-input" 
                  placeholder="Search by title or author..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select 
                  className="category-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">All Categories</option>
                  <option value="Fiction">Fiction</option>
                  <option value="Tech">Tech</option>
                  <option value="Self-Help">Self-Help</option>
                  <option value="Science">Science</option>
                  <option value="Biography">Biography</option>
                </select>
              </div>
            </div>

            <div className="books-grid">
              {books.map((book) => (
                <div key={book.id} className="book-card">
                  <div className="book-image-container" onClick={() => setSelectedBook(book)} style={{ cursor: 'pointer' }}>
                    <img src={book.image_url} alt={book.title} className="book-image" />
                  </div>
                  <div className="book-info">
                    <span className="book-category">{book.category}</span>
                    <h3 className="book-title" onClick={() => setSelectedBook(book)} style={{ cursor: 'pointer' }}>{book.title}</h3>
                    <p className="book-author">by {book.author}</p>
                    <div className="book-footer">
                      <span className="book-price">${book.price.toFixed(2)}</span>
                      <button className="btn btn-primary" onClick={() => addToCart(book)}>Add to Cart</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. SHOPPING CART PAGE */}
        {currentPage === 'cart' && (
          <div>
            <h2 style={{ marginBottom: '1.5rem' }}>Shopping Cart</h2>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Your shopping cart is currently empty.</p>
                <button className="btn btn-primary" onClick={() => setCurrentPage('catalog')}>Back to Catalog</button>
              </div>
            ) : (
              <div className="cart-grid">
                <div className="cart-items">
                  {cart.map((item) => (
                    <div key={item.id} className="cart-item">
                      <img src={item.image_url} alt={item.title} className="cart-item-image" />
                      <div className="cart-item-info">
                        <h3 className="book-title">{item.title}</h3>
                        <p className="book-author" style={{ marginBottom: '0.5rem' }}>by {item.author}</p>
                        <div className="cart-item-qty">
                          <button className="qty-btn" onClick={() => updateQuantity(item.id, -1)}>-</button>
                          <span style={{ fontWeight: '600' }}>{item.quantity}</span>
                          <button className="qty-btn" onClick={() => updateQuantity(item.id, 1)}>+</button>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontWeight: '700', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                        <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => removeFromCart(item.id, item.title)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="cart-summary">
                  <h3 style={{ marginBottom: '1rem' }}>Order Summary</h3>
                  <div className="summary-row">
                    <span>Items Total:</span>
                    <span>${getCartTotal()}</span>
                  </div>
                  <div className="summary-row">
                    <span>Shipping:</span>
                    <span style={{ color: 'var(--success)', fontWeight: '600' }}>FREE</span>
                  </div>
                  <div className="summary-row total">
                    <span>Total Amount:</span>
                    <span>${getCartTotal()}</span>
                  </div>
                  <button 
                    className="btn btn-primary" 
                    style={{ width: '100%', marginTop: '1rem' }}
                    onClick={() => setCurrentPage('checkout')}
                  >
                    Proceed to Checkout
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. CHECKOUT PAGE */}
        {currentPage === 'checkout' && (
          <div className="checkout-container">
            <h2 style={{ marginBottom: '1.5rem' }}>Checkout</h2>
            <div className="checkout-grid">
              <div>
                <h3 style={{ marginBottom: '1rem' }}>Shipping Details</h3>
                <form onSubmit={handlePlaceOrder}>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      required
                      value={orderForm.customerName}
                      onChange={(e) => setOrderForm({ ...orderForm, customerName: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      required
                      value={orderForm.email}
                      onChange={(e) => setOrderForm({ ...orderForm, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Shipping Address</label>
                    <textarea 
                      className="form-input" 
                      rows="4" 
                      required
                      value={orderForm.address}
                      onChange={(e) => setOrderForm({ ...orderForm, address: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                    Place Order (${getCartTotal()})
                  </button>
                </form>
              </div>

              <div>
                <h3 style={{ marginBottom: '1rem' }}>Items List</h3>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  {cart.map((item) => (
                    <div key={item.id} style={{ display: 'flex', justifyURI: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                      <div>
                        <p style={{ fontWeight: '600' }}>{item.title}</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Qty: {item.quantity} @ ${item.price.toFixed(2)}</p>
                      </div>
                      <p style={{ fontWeight: '700' }}>${(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  ))}
                  <div className="summary-row total" style={{ marginTop: '1rem' }}>
                    <span>Total:</span>
                    <span>${getCartTotal()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. AUTH LOGIN & REGISTER PAGES */}
        {(currentPage === 'login' || currentPage === 'register') && (
          <div className="auth-container">
            <h2 className="auth-title">{currentPage === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
            <form onSubmit={(e) => handleAuthSubmit(e, currentPage)}>
              {currentPage === 'register' && (
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required
                    value={authForm.name}
                    onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                  />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-input" 
                  required
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  required
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                {currentPage === 'login' ? 'Login' : 'Register'}
              </button>
            </form>
            <div className="auth-switch">
              {currentPage === 'login' ? (
                <>Don't have an account? <span onClick={() => setCurrentPage('register')}>Register Here</span></>
              ) : (
                <>Already have an account? <span onClick={() => setCurrentPage('login')}>Login Here</span></>
              )}
            </div>
            {currentPage === 'login' && (
              <div style={{ marginTop: '1.5rem', padding: '0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', border: '1px dashed var(--border-color)' }}>
                💡 <strong>Admin Demo Note</strong>: Register and login with <strong>admin@cherish.com</strong> to unlock the Admin Panel and manage inventory.
              </div>
            )}
          </div>
        )}

        {/* 5. SUCCESS PAGE */}
        {currentPage === 'success' && (
          <div style={{ textAlign: 'center', padding: '4rem 0', maxWidth: '500px', margin: '0 auto' }}>
            <span style={{ fontSize: '4rem' }}>🎉</span>
            <h2 style={{ margin: '1rem 0' }}>Thank You for Your Order!</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Your order has been placed successfully. Order ID: <strong>#{placedOrderId}</strong>.
            </p>
            <button className="btn btn-primary" onClick={() => setCurrentPage('catalog')}>Back to Bookstore</button>
          </div>
        )}
      </main>

      {/* Book Detail Modal */}
      {selectedBook && (
        <div className="modal-overlay" onClick={() => setSelectedBook(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedBook(null)}>&times;</button>
            <div className="book-detail-grid">
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-tertiary)', padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
                <img src={selectedBook.image_url} alt={selectedBook.title} style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span className="book-category">{selectedBook.category}</span>
                <h2 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.5rem' }}>{selectedBook.title}</h2>
                <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>by {selectedBook.author}</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                  {selectedBook.description}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: '700' }}>${selectedBook.price.toFixed(2)}</span>
                  <button className="btn btn-primary" onClick={() => { addToCart(selectedBook); setSelectedBook(null); }}>
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <p>&copy; 2026 Cherish Books. Self Goodness : Better World</p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Shrirampur, Maharashtra - 413709 | info@cherishindia.org</p>
      </footer>
    </div>
  );
}

export default App;
