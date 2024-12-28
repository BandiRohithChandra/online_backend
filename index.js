const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
const corsOptions = {
  origin: 'http://localhost:3000', // Allow requests from your frontend
  methods: 'GET,POST,PUT,DELETE',  // Allowed HTTP methods
};

app.use(cors(corsOptions));
app.use(express.json());

// Set up SQLite database
const dbPath = path.resolve(__dirname, './library.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        db.run('PRAGMA foreign_keys = ON;'); // Enable foreign key constraints
    }
});

// Create tables if they do not exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS authors (
      authorid INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS genres (
      genreid INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS books (
      bookid INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      authorid INTEGER,
      genreid INTEGER,
      pages INTEGER,
      publishedDate TEXT,
      FOREIGN KEY (authorid) REFERENCES authors (authorid),
      FOREIGN KEY (genreid) REFERENCES genres (genreid)
    );
  `);

  // Authors
  const authors = ['J.K. Rowling', 'George Orwell', 'J.R.R. Tolkien', 'Harper Lee'];
  authors.forEach((author) => {
    db.run('INSERT OR IGNORE INTO authors (name) VALUES (?)', [author]);
  });

  // Genres
  const genres = [
    { name: 'Fantasy', description: 'A genre of speculative fiction involving magic and mythical creatures' },
    { name: 'Dystopian', description: 'A genre of speculative fiction set in a futuristic society with oppression and control' },
    { name: 'Fiction', description: 'A genre of narrative fiction based on real-life experiences' },
  ];
  genres.forEach(({ name, description }) => {
    db.run('INSERT OR IGNORE INTO genres (name, description) VALUES (?, ?)', [name, description]);
  });

  // Books
  const books = [
    { title: "Harry Potter and the Sorcerer's Stone", author: 'J.K. Rowling', genre: 'Fantasy', pages: 309, publishedDate: '1997-06-26' },
    { title: '1984', author: 'George Orwell', genre: 'Dystopian', pages: 328, publishedDate: '1949-06-08' },
    { title: 'The Hobbit', author: 'J.R.R. Tolkien', genre: 'Fantasy', pages: 310, publishedDate: '1937-09-21' },
    { title: 'To Kill a Mockingbird', author: 'Harper Lee', genre: 'Fiction', pages: 324, publishedDate: '1960-07-11' },
  ];
  books.forEach(({ title, author, genre, pages, publishedDate }) => {
    db.get(
      `SELECT a.authorid, g.genreid FROM authors a, genres g WHERE a.name = ? AND g.name = ?`,
      [author, genre],
      (err, row) => {
        if (row) {
          db.run(
            `INSERT OR IGNORE INTO books (title, authorid, genreid, pages, publishedDate) VALUES (?, ?, ?, ?, ?)`,
            [title, row.authorid, row.genreid, pages, publishedDate]
          );
        }
      }
    );
  });
});

// Utility function for error responses
const errorResponse = (res, status, message) => {
    res.status(status).json({ error: message });
};

// GET all books with pagination
app.get('/books', (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  const query = `
    SELECT DISTINCT b.bookid, b.title, a.name AS author, g.name AS genre, b.pages, b.publishedDate, b.authorid, b.genreid
    FROM books b
    JOIN authors a ON b.authorid = a.authorid
    JOIN genres g ON b.genreid = g.genreid
    LIMIT ? OFFSET ?
  `;

  db.all(query, [parseInt(limit), parseInt(offset)], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET a single book by ID
app.get('/books/:id', (req, res) => {
    const { id } = req.params;
    const query = `
        SELECT b.bookid, b.title, a.name AS author, g.name AS genre, b.pages, b.publishedDate
        FROM books b
        JOIN authors a ON b.authorid = a.authorid
        JOIN genres g ON b.genreid = g.genreid
        WHERE b.bookid = ?
    `;

    db.get(query, [id], (err, row) => {
        if (err) return errorResponse(res, 500, err.message);
        if (!row) return errorResponse(res, 404, 'Book not found');
        res.json(row);
    });
});

// POST a new book
app.post('/books', (req, res) => {
    const { title, authorid, genreid, pages, publishedDate } = req.body;

    if (!title || !authorid || !genreid || !pages || !publishedDate) {
        return errorResponse(res, 400, 'All fields are required');
    }

    const query = `
        INSERT INTO books (title, authorid, genreid, pages, publishedDate)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.run(query, [title, authorid, genreid, pages, publishedDate], function (err) {
        if (err) return errorResponse(res, 500, err.message);
        res.status(201).json({ bookid: this.lastID });
    });
});

// PUT update a book
app.put('/books/:id', (req, res) => {
    const { id } = req.params;
    const { title, authorid, genreid, pages, publishedDate } = req.body;

    if (!title || !authorid || !genreid || !pages || !publishedDate) {
        return errorResponse(res, 400, 'All fields are required');
    }

    const query = `
        UPDATE books SET title = ?, authorid = ?, genreid = ?, pages = ?, publishedDate = ?
        WHERE bookid = ?
    `;

    db.run(query, [title, authorid, genreid, pages, publishedDate, id], function (err) {
        if (err) return errorResponse(res, 500, err.message);
        if (this.changes === 0) return errorResponse(res, 404, 'Book not found');
        res.json({ message: 'Book updated successfully' });
    });
});

// DELETE a book
app.delete('/books/:id', (req, res) => {
    const { id } = req.params;

    const query = `DELETE FROM books WHERE bookid = ?`;

    db.run(query, [id], function (err) {
        if (err) return errorResponse(res, 500, err.message);
        if (this.changes === 0) return errorResponse(res, 404, 'Book not found');
        res.json({ message: 'Book deleted successfully' });
    });
});

// GET all authors
app.get('/authors', (req, res) => {
    const query = `SELECT * FROM authors`;

    db.all(query, [], (err, rows) => {
        if (err) return errorResponse(res, 500, err.message);
        res.json(rows);
    });
});

// GET all genres
app.get('/genres', (req, res) => {
    const query = `SELECT * FROM genres`;

    db.all(query, [], (err, rows) => {
        if (err) return errorResponse(res, 500, err.message);
        res.json(rows);
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
