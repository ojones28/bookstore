DROP DATABASE bookstore;
CREATE DATABASE bookstore;

CREATE TABLE bookstore.user (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL
);

CREATE TABLE bookstore.book (
    book_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(100) NOT NULL,
    genre VARCHAR(50),
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    stock_quantity INT NOT NULL CHECK (stock_quantity >= 0)
);

CREATE TABLE bookstore.review (
    review_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    book_id INT NOT NULL,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT,
    posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, book_id),
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES Book(book_id) ON DELETE CASCADE,
);


CREATE TABLE bookstore.order (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_price DECIMAL(10,2) NOT NULL CHECK (total_price >= 0),
    status ENUM('pending', 'completed', 'canceled') NOT NULL DEFAULT 'pending',
    FOREIGN KEY (user_id) REFERENCES User(user_id),
);

CREATE TABLE bookstore.order_item (
    order_id INT NOT NULL,
    book_id INT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES Books(book_id),
    PRIMARY KEY (order_id, book_id)
);

-- price in order item at time of order
-- composite primary key or no
-- enum?