require('dotenv').config();
const express = require('express');
const exphbs = require("express-handlebars");
const cookieParser = require('cookie-parser');
const mysql = require('mysql2');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const saltRounds = 10;

const app = express();

app.use(express.json());

app.use(express.urlencoded({
	extended: true
}));

app.use(cookieParser());
app.use(express.static('public'));
app.engine("handlebars", exphbs.engine({ defaultLayout: "main" }));
app.set("view engine", "handlebars");
app.use(async (req, res, next) => {
	try {
		const token = req.cookies.auth;
		if (token) {
			const user = await getUserByToken(token);
			if (user) {
				const { user_id, first_name, last_name, email } = user;
				res.locals.user = { user_id, first_name, last_name, email };
			} else {
				res.clearCookie('auth');
			}
		}
	} catch (err) {
		console.error('Auth error:', err);
		res.clearCookie('auth');
	} finally {
		next();
	}
});

const con = mysql.createConnection({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASS,
	database: 'bookstore'
});

con.connect(err => {
	if (err) throw err;
	console.log('Connected to DB');
});

async function getAllGenres() {
	return new Promise((resolve, reject) => {
		con.query("SELECT * FROM genres ORDER BY name", (err, result) => {
			if (err) return reject(err);
			resolve(result);
		});
	});
}

async function getAllBooks() {
	return new Promise((resolve, reject) => {
		con.query(`SELECT b.book_id, b.title, CONCAT(a.first_name, ' ', a.last_name) AS author,
			b.price, IFNULL(AVG(r.rating), 0) AS avg_rating
			FROM books b
			LEFT JOIN reviews r ON b.book_id = r.book_id
			LEFT JOIN authors a ON b.author_id = a.author_id
			GROUP BY b.book_id`,
			(err, result) => {
				if (err) return reject(err);
				resolve(result);
			});
	});
}

async function getBookGenres() {
	return new Promise((resolve, reject) => {
		con.query(`SELECT bg.book_id, g.name
			FROM book_genres bg
			JOIN genres g ON bg.genre_id = g.genre_id`,
			(err, result) => {
				if (err) return reject(err);
				resolve(result);
			});
	});
}

async function getOrderedItemsFor(user_id) {
	return new Promise((resolve, reject) => {
		con.query(`SELECT DISTINCT oi.book_id
			FROM orders o
			JOIN order_items oi ON o.order_id = oi.order_id
			WHERE o.user_id = ? AND o.status = 'completed'`, [user_id], (err, result) => {
			if (err) return reject(err);
			resolve(result);
		});
	});
}

async function registerUser(first_name, last_name, email, password_hash, token) {
	return new Promise((resolve, reject) => {
		con.query(
			"INSERT INTO users (first_name, last_name, email, password_hash, token) VALUES (?, ?, ?, ?, ?)",
			[first_name, last_name, email, password_hash, token],
			function (err, result) {
				if (err) {
					return reject(err);
				}
				resolve(result);
			}
		);
	});
}

async function getUserByEmail(email) {
	return new Promise((resolve, reject) => {
		con.query("SELECT * FROM users WHERE email = ?", [email], function (err, result) {
			if (err) return reject(err);
			if (result.length > 0) resolve(result[0]);
			else resolve(undefined);
		});
	});
}

async function getUserByToken(token) {
	return new Promise((resolve, reject) => {
		con.query("SELECT * FROM users WHERE token = ?", [token], function (err, result) {
			if (err) return reject(err);
			if (result.length > 0) resolve(result[0]);
			else resolve(undefined);
		});
	});
}

async function regenToken(user_id) {
	return new Promise((resolve, reject) => {
		const token = crypto.randomBytes(64).toString('hex');
		con.query("UPDATE users SET token = ? WHERE user_id = ?", [token, user_id], function (err, result) {
			if (err) return reject(err);
			else resolve(token);
		});
	});
}

async function clearToken(user_id) {
	con.query('UPDATE users SET token = "" WHERE user_id = ?', [user_id], function (err, result) {
		if (err) throw err;
	});
}

async function getBookById(bookId) {
	return new Promise((resolve, reject) => {
		con.query(`SELECT b.book_id, b.title, CONCAT(a.first_name, ' ', a.last_name) AS author
			FROM books b
			JOIN authors a ON b.author_id = a.author_id
			WHERE b.book_id = ?`, bookId,
			(err, result) => {
				if (err) return reject(err);
				if (result.length > 0) resolve(result[0]);
				else resolve(undefined);
			});
	});
}

async function getReviews(bookId) {
	return new Promise((resolve, reject) => {
		con.query(`SELECT r.rating, r.review_text, r.posted_at,
			CONCAT(u.first_name, ' ', u.last_name) AS reviewer
			FROM reviews r
			JOIN users u ON r.user_id = u.user_id
			WHERE r.book_id = ?
			ORDER BY r.posted_at DESC`, bookId,
			(err, result) => {
				if (err) return reject(err);
				resolve(result);
			});
	});
}

async function insertReview(book_id, user_id, rating, review_text) {
  return new Promise((resolve, reject) => {
    con.query(`INSERT INTO reviews (book_id, user_id, rating, review_text, posted_at)
      VALUES (?, ?, ?, ?, NOW())`,
      [book_id, user_id, rating, review_text], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
  });
}

app.get('/', async (req, res) => {
	try {
		const genreRows = await getAllGenres();
		const bookRows = await getAllBooks();
		const bgRows = await getBookGenres();

		const genresMap = {};
		bgRows.forEach(row => {
			genresMap[row.book_id] = genresMap[row.book_id] || [];
			genresMap[row.book_id].push(row.name);
		});

		let orderedSet = new Set();
		if (res.locals.user) {
			const uid = res.locals.user.user_id;
			const orderedRows = await getOrderedItemsFor(uid);
			orderedSet = new Set(orderedRows.map(r => r.book_id));
		}

		const books = bookRows.map(b => {
			const rawRating = parseFloat(b.avg_rating) || 0;
			const avg_rating = Math.round(rawRating * 10) / 10;
			return {
				...b,
				avg_rating,
				genres: genresMap[b.book_id] || [],
				has_ordered: orderedSet.has(b.book_id)
			};
		});

		res.render('home', { books, genres: genreRows });
	} catch (err) {
		console.error('Error loading home:', err);
		res.status(500).send('Server error');
	}
});

app.get('/register', (req, res) => {
	res.render('register');
});

app.post('/register', async (req, res) => {
	const { first_name, last_name, email, password } = req.body;
	if (!first_name || !last_name || !email || !password) {
		return res.render('register', { error: 'All fields are required.' });
	}
	try {
		const password_hash = await bcrypt.hash(password, saltRounds);
		const token = crypto.randomBytes(64).toString('hex');
		await registerUser(first_name, last_name, email, password_hash, token);
		res.cookie('auth', token, { httpOnly: true, maxAge: 7 * 24e6 });
		res.redirect('/');
	} catch (err) {
		if (err.code === 'ER_DUP_ENTRY') {
			return res.render('register', { error: 'Email already registered.' });
		}
		console.error(err);
		res.render('register', { error: 'Server error.' });
	}
});

app.get('/login', (req, res) => {
	res.render('login');
});

app.post('/login', async (req, res) => {
	const { email, password } = req.body;
	if (!email || !password) {
		return res.render('login', { error: 'Email & password required.' });
	}
	try {
		const user = await getUserByEmail(email);
		if (!user) {
			return res.render('login', { error: 'Invalid email or password.' });
		}
		const match = await bcrypt.compare(password, user.password_hash);
		if (!match) {
			return res.render('login', { error: 'Invalid email or password.' });
		}
		const token = await regenToken(user.user_id);
		res.cookie('auth', token, { httpOnly: true, maxAge: 7 * 24e6 });
		res.redirect('/');
	} catch (err) {
		console.error(err);
		res.render('login', { error: 'Server error.' });
	}
});

app.post('/logout', async (req, res) => {
	if (res.locals.user) {
		await clearToken(res.locals.user.user_id);
	}
	res.clearCookie('auth');
	res.redirect('/');
});

app.post('/order', async (req, res) => {
	if (!res.locals.user) return res.status(401).json({ success: false, error: 'Not logged in' });

	const items = req.body.items;
	if (!Array.isArray(items) || items.length === 0) {
		return res.status(400).json({ success: false, error: 'No books provided' });
	}

	const user_id = res.locals.user.user_id;

	try {
		const placeholders = items.map(() => '?').join(',');
		const bookIds = items.map(i => i.book_id);
		const [rows] = await con.promise().query(
			`SELECT book_id, price FROM books WHERE book_id IN (${placeholders})`,
			bookIds
		);

		const priceMap = new Map(rows.map(r => [r.book_id, parseFloat(r.price)]));
		let totalPrice = 0;
		const orderItems = items.map(i => {
			const price = priceMap.get(parseInt(i.book_id));
			const quantity = parseInt(i.quantity);
			totalPrice += price * quantity;
			return [undefined, i.book_id, quantity, price];
		});

		const [orderResult] = await con.promise().query(
			'INSERT INTO orders (user_id, total_price, status) VALUES (?, ?, ?)',
			[user_id, totalPrice.toFixed(2), 'completed']
		);
		const order_id = orderResult.insertId;

		const itemsData = orderItems.map(i => [order_id, i[1], i[2], i[3]]);
		await con.promise().query(
			'INSERT INTO order_items (order_id, book_id, quantity, price) VALUES ?',
			[itemsData]
		);

		res.json({ success: true });
	} catch (err) {
		console.error(err);
		if (err.sqlState === '45000') {
			return res.render('home', { error: err.message });
		}
		res.status(500).json({ success: false, error: 'Server error' });
	}
});

app.get('/books/:id/reviews', async (req, res) => {
	const bookId = req.params.id;
	try {
		const book = await getBookById(bookId);
		if (!book) return res.status(404).send('Book not found');
		const reviews = await getReviews(bookId);
		res.render('reviews', { book, reviews });
	} catch (err) {
		console.error('Error loading reviews:', err);
		res.status(500).send('Server error');
	}
});

async function countUserCompletedOrdersForBook(user_id, book_id) {
  return new Promise((resolve, reject) => {
    con.query(`SELECT COUNT(*) AS count
      FROM orders o
      JOIN order_items oi ON o.order_id = oi.order_id
      WHERE o.user_id = ? AND o.status = 'completed' AND oi.book_id = ?`,
      [user_id, book_id], (err, results) => {
        if (err) return reject(err);
        resolve(results[0].count);
      }
    );
  });
}

app.get('/books/:id/review/new', async (req, res) => {
  const bookId = req.params.id;

  if (!res.locals.user) return res.redirect('/login');

  try {
    const book = await getBookById(bookId);
    if (!book) return res.status(404).send('Book not found');

    const count = await countUserCompletedOrdersForBook(res.locals.user.user_id, bookId);
    if (count === 0) {
      return res.status(403).send('You must purchase this book before reviewing.');
    }

    res.render('reviewform', { book });
  } catch (err) {
    console.error('Error loading review form:', err);
    res.status(500).send('Server error');
  }
});

async function hasUserReviewedBook(user_id, book_id) {
	return new Promise((resolve, reject) => {
		con.query(
			'SELECT 1 FROM reviews WHERE user_id = ? AND book_id = ? LIMIT 1',
			[user_id, book_id],
			(err, results) => {
				if (err) return reject(err);
				resolve(results.length > 0);
			}
		);
	});
}

app.post('/books/:id/review', async (req, res) => {
	const bookId = req.params.id;
	const { rating, review_text } = req.body;

	if (!res.locals.user) return res.redirect('/login');

	if (!rating || rating < 1 || rating > 5) {
		return res.render('reviewform', {
			book: await getBookById(bookId),
			error: 'Rating must be between 1 and 5.',
			review_text
		});
	}

	try {
		const alreadyReviewed = await hasUserReviewedBook(res.locals.user.user_id, bookId);
		if (alreadyReviewed) {
			return res.render('reviewform', {
				book: await getBookById(bookId),
				error: 'You have already reviewed this book.',
				review_text
			});
		}

		await insertReview(bookId, res.locals.user.user_id, rating, review_text);

		res.redirect(`/books/${bookId}/reviews`);
	} catch (err) {
		console.error('Error submitting review:', err);
		res.status(500).send('Server error');
	}
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Listening on port ${PORT}`);
});