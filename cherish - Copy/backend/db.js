const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    db.serialize(() => {
      // Create Users table
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      )`);

      // Create Books table
      db.run(`CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        category TEXT NOT NULL,
        price REAL NOT NULL,
        description TEXT,
        image_url TEXT
      )`);

      // Create Orders table
      db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        customer_name TEXT NOT NULL,
        email TEXT NOT NULL,
        address TEXT NOT NULL,
        total_amount REAL NOT NULL,
        items TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`);

      // Seed books if empty
      db.get('SELECT COUNT(*) as count FROM books', (err, row) => {
        if (row && row.count === 0) {
          console.log('Seeding initial book data...');
          const insertStmt = db.prepare(`INSERT INTO books (title, author, category, price, description, image_url) VALUES (?, ?, ?, ?, ?, ?)`);
          
          const initialBooks = [
            {
              title: "The Alchemist",
              author: "Paulo Coelho",
              category: "Fiction",
              price: 12.99,
              description: "A philosophical novel about a young Andalusian shepherd named Santiago in his journey to Egypt, after having a recurring dream of finding a treasure there.",
              image_url: "https://images-na.ssl-images-amazon.com/images/I/71aFt4+OTOL.jpg"
            },
            {
              title: "Clean Code",
              author: "Robert C. Martin",
              category: "Tech",
              price: 34.99,
              description: "A handbook of agile software craftsmanship. Even bad code can function. But if code isn't clean, it can bring a development organization to its knees.",
              image_url: "/images/clean-code.jpg"
            },
            {
              title: "Atomic Habits",
              author: "James Clear",
              category: "Self-Help",
              price: 16.20,
              description: "An easy and proven way to build good habits and break bad ones. The book explains how tiny daily improvements can lead to massive life-altering results.",
              image_url: "/images/atomic-habits.jpg"
            },
            {
              title: "A Brief History of Time",
              author: "Stephen Hawking",
              category: "Science",
              price: 14.50,
              description: "A landmark volume in science writing by one of the great minds of our time, exploring the mysteries of the universe, black holes, and the nature of time.",
              image_url: "/images/a-brief-history-of-time.jpg"
            },
            {
              title: "Steve Jobs",
              author: "Walter Isaacson",
              category: "Biography",
              price: 18.99,
              description: "The exclusive biography of Apple co-founder Steve Jobs, based on more than forty interviews with Jobs conducted over two years.",
              image_url: "/images/steve-jobs.jpg"
            },
            {
              title: "To Kill a Mockingbird",
              author: "Harper Lee",
              category: "Fiction",
              price: 8.99,
              description: "The unforgettable novel of a childhood in a sleepy Southern town and the crisis of conscience that rocked it, dealing with serious themes of racial injustice.",
              image_url: "/images/to-kill-a-mockingbird.jpg"
            },
            {
              title: "Introduction to Algorithms",
              author: "Thomas H. Cormen",
              category: "Tech",
              price: 85.50,
              description: "A comprehensive guide to the design and analysis of computer algorithms.",
              image_url: "/images/introduction-to-algorithms.jpg"
            }
          ];

          initialBooks.forEach(book => {
            insertStmt.run(book.title, book.author, book.category, book.price, book.description, book.image_url);
          });
          insertStmt.finalize();
          console.log('Seeding completed successfully.');
        }
      });
    });
  }
});

module.exports = db;
