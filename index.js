const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Set up SQLite database
const dbPath = path.resolve(__dirname, './library.db');
const db = new sqlite3.Database(dbPath);

// Create tables if they do not exist
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS authors (authorid INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS genres (genreid INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, description TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS books (bookid INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, authorid INTEGER, genreid INTEGER, pages INTEGER, publishedDate TEXT, FOREIGN KEY(authorid) REFERENCES authors(authorid), FOREIGN KEY(genreid) REFERENCES genres(genreid))');
  
  // Insert sample data if tables are empty
  db.get("SELECT COUNT(*) AS count FROM authors", [], (err, row) => {
    if (err) {
      console.error(err.message);
      return;
    }
    if (row.count === 0) {
      // Add sample authors
      db.run('INSERT INTO authors (name) VALUES (?)', ['J.K. Rowling']);
      db.run('INSERT INTO authors (name) VALUES (?)', ['George Orwell']);
      db.run('INSERT INTO authors (name) VALUES (?)', ['J.R.R. Tolkien']);
      db.run('INSERT INTO authors (name) VALUES (?)', ['Harper Lee']);
      
      // Add sample genres
      db.run('INSERT INTO genres (name, description) VALUES (?, ?)', ['Fantasy', 'A genre of speculative fiction involving magic and mythical creatures']);
      db.run('INSERT INTO genres (name, description) VALUES (?, ?)', ['Dystopian', 'A genre of speculative fiction set in a futuristic society with oppression and control']);
      db.run('INSERT INTO genres (name, description) VALUES (?, ?)', ['Fiction', 'A genre of narrative fiction based on real-life experiences']);
      
      // Add sample books
      db.run('INSERT INTO books (title, authorid, genreid, pages, publishedDate) VALUES (?, ?, ?, ?, ?)', 
             ['Harry Potter and the Sorcerer\'s Stone', 1, 1, 309, '1997-06-26']);
      db.run('INSERT INTO books (title, authorid, genreid, pages, publishedDate) VALUES (?, ?, ?, ?, ?)', 
             ['1984', 2, 2, 328, '1949-06-08']);
      db.run('INSERT INTO books (title, authorid, genreid, pages, publishedDate) VALUES (?, ?, ?, ?, ?)', 
             ['The Hobbit', 3, 1, 310, '1937-09-21']);
      db.run('INSERT INTO books (title, authorid, genreid, pages, publishedDate) VALUES (?, ?, ?, ?, ?)', 
             ['To Kill a Mockingbird', 4, 3, 324, '1960-07-11']);
    }
  });
});

// GET all books
app.get('/books', (req, res) => {
  const query = `
    SELECT b.bookid, b.title, a.name AS author, g.name AS genre, b.pages, b.publishedDate
    FROM books b
    JOIN authors a ON b.authorid = a.authorid
    JOIN genres g ON b.genreid = g.genreid
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

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
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Book not found' });
      res.json(row);
    });
  });

// POST a new book
app.post('/books', (req, res) => {
  const { title, authorid, genreid, pages, publishedDate } = req.body;
  const query = `
    INSERT INTO books (title, authorid, genreid, pages, publishedDate)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.run(query, [title, authorid, genreid, pages, publishedDate], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ bookid: this.lastID });
  });
});

// PUT update a book
app.put('/books/:id', (req, res) => {
  const { id } = req.params;
  const { title, authorid, genreid, pages, publishedDate } = req.body;
  const query = `
    UPDATE books SET title = ?, authorid = ?, genreid = ?, pages = ?, publishedDate = ?
    WHERE bookid = ?
  `;
  db.run(query, [title, authorid, genreid, pages, publishedDate, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Book not found' });
    res.json({ message: 'Book updated successfully' });
  });
});

// DELETE a book
app.delete('/books/:id', (req, res) => {
  const { id } = req.params;
  const query = `DELETE FROM books WHERE bookid = ?`;
  db.run(query, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Book not found' });
    res.json({ message: 'Book deleted successfully' });
  });
});

// Get all authors
app.get('/authors', (req, res) => {
  const query = `SELECT * FROM authors`;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get all genres
app.get('/genres', (req, res) => {
  const query = `SELECT * FROM genres`;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
