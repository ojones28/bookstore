-- price in order item at time of order
-- composite primary key or no
-- enum?
-- pools
-- users could have timestamps for created/updated
-- not sure on indexes and how they affect performance
-- auto set total price
-- better communication

DROP DATABASE IF EXISTS bookstore;
CREATE DATABASE bookstore;

CREATE TABLE bookstore.users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL DEFAULT ""
);

CREATE TABLE bookstore.authors (
    author_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL
);

CREATE TABLE bookstore.books (
    book_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author_id INT NOT NULL,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    stock_quantity INT NOT NULL CHECK (stock_quantity >= 0),
    FOREIGN KEY (author_id) REFERENCES authors(author_id) ON DELETE CASCADE
);

CREATE TABLE bookstore.genres (
    genre_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE bookstore.book_genres (
    book_id INT NOT NULL,
    genre_id INT NOT NULL,
    PRIMARY KEY (book_id, genre_id)
);

CREATE TABLE bookstore.reviews (
    review_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    book_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT,
    posted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, book_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE
);


CREATE TABLE bookstore.orders (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_price DECIMAL(10,2) NOT NULL CHECK (total_price >= 0) DEFAULT 0,
    status ENUM('pending', 'completed', 'canceled') NOT NULL DEFAULT 'pending',
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE bookstore.order_items (
    order_id INT NOT NULL,
    book_id INT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(book_id),
    PRIMARY KEY (order_id, book_id)
);

DELIMITER $$

CREATE TRIGGER bookstore.order_items_after_insert
AFTER INSERT ON bookstore.order_items
FOR EACH ROW
BEGIN
  UPDATE bookstore.orders
  SET total_price = (
    SELECT IFNULL(SUM(price * quantity), 0)
    FROM bookstore.order_items
    WHERE order_id = NEW.order_id
  )
  WHERE order_id = NEW.order_id;
END$$

CREATE TRIGGER bookstore.order_items_after_update
AFTER UPDATE ON bookstore.order_items
FOR EACH ROW
BEGIN
  UPDATE bookstore.orders
  SET total_price = (
    SELECT IFNULL(SUM(price * quantity), 0)
    FROM bookstore.order_items
    WHERE order_id = NEW.order_id
  )
  WHERE order_id = NEW.order_id;
END$$

CREATE TRIGGER bookstore.order_items_after_delete
AFTER DELETE ON bookstore.order_items
FOR EACH ROW
BEGIN
  UPDATE bookstore.orders
  SET total_price = (
    SELECT IFNULL(SUM(price * quantity), 0)
    FROM bookstore.order_items
    WHERE order_id = OLD.order_id
  )
  WHERE order_id = OLD.order_id;
END$$

CREATE TRIGGER bookstore.order_items_before_insert
BEFORE INSERT ON bookstore.order_items
FOR EACH ROW
BEGIN
  DECLARE available INT;
  SELECT stock_quantity INTO available
    FROM bookstore.books
   WHERE book_id = NEW.book_id;
  IF NEW.quantity > available THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = "Not enough stock";
  END IF;
END$$

CREATE TRIGGER bookstore.order_items_before_update
BEFORE UPDATE ON bookstore.order_items
FOR EACH ROW
BEGIN
  DECLARE available INT;
  SELECT stock_quantity INTO available
    FROM bookstore.books
   WHERE book_id = NEW.book_id;
  IF NEW.quantity > available THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = "Not enough stock";
  END IF;
END$$

CREATE TRIGGER bookstore.order_completed_after_update
AFTER UPDATE ON bookstore.orders
FOR EACH ROW
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE bookstore.books b
    JOIN bookstore.order_items oi ON b.book_id = oi.book_id
    SET b.stock_quantity = b.stock_quantity - oi.quantity
    WHERE oi.order_id = NEW.order_id;
  END IF;
END$$

CREATE TRIGGER bookstore.order_completed_after_insert
AFTER INSERT ON bookstore.orders
FOR EACH ROW
BEGIN
  IF NEW.status = 'completed' THEN
    UPDATE bookstore.books b
    JOIN bookstore.order_items oi ON b.book_id = oi.book_id
    SET b.stock_quantity = b.stock_quantity - oi.quantity
    WHERE oi.order_id = NEW.order_id;
  END IF;
END$$

DELIMITER ;


-- AI
-- 1) Users
INSERT INTO bookstore.users (first_name, last_name, email, password_hash) VALUES
  ('Alice',   'Smith',   'alice@example.com',   'hash1'),
  ('Bob',     'Johnson', 'bob@example.com',     'hash2'),
  ('Carol',   'Lee',     'carol@example.com',   'hash3');

-- 2) Authors
INSERT INTO bookstore.authors (first_name, last_name) VALUES
  ('J.R.R.',    'Tolkien'),
  ('George',    'Orwell'),
  ('Dan',       'Brown'),
  ('Patrick',   'Rothfuss'),
  ('Frank',     'Herbert'),
  ('Yuval Noah','Harari');

-- 3) Genres
INSERT INTO bookstore.genres (name) VALUES
  ('Fantasy'),
  ('Science Fiction'),
  ('Mystery'),
  ('Non-Fiction'),
  ('Historical');

-- 4) Books
INSERT INTO bookstore.books (title, author_id, price, stock_quantity) VALUES
  ('The Hobbit',            1, 10.99,  15),
  ('1984',                  2,  8.99,  20),
  ('The Da Vinci Code',     3, 12.50,  10),
  ('The Name of the Wind',  4, 14.00,   5),
  ('Dune',                  5, 11.25,  12),
  ('Sapiens',               6, 16.00,   8);

-- 5) Book–Genre mappings (many‑to‑many)
INSERT INTO bookstore.book_genres (book_id, genre_id) VALUES
  -- The Hobbit: Fantasy
  (1, 1),
  -- 1984: Science Fiction, Historical
  (2, 2),
  (2, 5),
  -- The Da Vinci Code: Mystery, Historical
  (3, 3),
  (3, 5),
  -- Name of the Wind: Fantasy
  (4, 1),
  -- Dune: Science Fiction, Fantasy
  (5, 2),
  (5, 1),
  -- Sapiens: Non-Fiction, Historical
  (6, 4),
  (6, 5);

-- 6) Reviews
INSERT INTO bookstore.reviews (user_id, book_id, rating, review_text) VALUES
  (1, 1, 5, 'A timeless classic—loved every page!'),
  (1, 5, 4, 'Great worldbuilding, but pacing was slow at times.'),
  (2, 2, 4, 'Chilling and thought-provoking.'),
  (3, 6, 5, 'An essential read for understanding humanity.');

-- 7) Orders
INSERT INTO bookstore.orders (user_id, order_date, total_price) VALUES
  -- Order 1 by Alice, two items
  (1, '2025-06-30 14:22:00', 10.99*1 + 11.25*2),
  -- Order 2 by Bob, three items
  (2, '2025-07-01 09:10:00', 8.99*1 + 12.50*1 + 16.00*1);

-- 8) Order items
INSERT INTO bookstore.order_items (order_id, book_id, quantity, price) VALUES
  -- Items for order 1
  (1, 1, 1, 10.99),  -- The Hobbit x1
  (1, 5, 2, 11.25),  -- Dune x2
  -- Items for order 2
  (2, 2, 1,  8.99),  -- 1984 x1
  (2, 3, 1, 12.50),  -- The Da Vinci Code x1
  (2, 6, 1, 16.00);  -- Sapiens x1