SELECT
  b.book_id, b.title, b.price, b.stock_quantity,
  a.first_name, a.last_name
FROM bookstore.books AS b
JOIN bookstore.authors AS a
  ON b.author_id = a.author_id
WHERE a.last_name = ?
ORDER BY b.title;

SELECT
  r.review_id, r.rating, r.review_text, r.posted_at,
  u.first_name, u.last_name
FROM bookstore.reviews AS r
JOIN bookstore.users AS u
  ON r.user_id = u.user_id
WHERE r.book_id = ?
ORDER BY r.posted_at DESC;

SELECT
  o.order_id, o.order_date, o.total_price, o.status,
  oi.book_id, b.title, oi.quantity, oi.price AS item_price
FROM bookstore.orders AS o
JOIN bookstore.order_items AS oi
  ON o.order_id = oi.order_id
JOIN bookstore.books AS b
  ON oi.book_id = b.book_id
WHERE o.user_id = ?
ORDER BY o.order_date DESC, o.order_id;
