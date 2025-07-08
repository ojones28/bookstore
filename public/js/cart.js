document.addEventListener('DOMContentLoaded', () => {
  const cartItemsEl = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');
  const orderBtn = document.getElementById('place-order-btn');
  const cart = JSON.parse(localStorage.getItem('cart') || '[]');

  function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
  }

  function renderCart() {
    cartItemsEl.innerHTML = '';
    let total = 0;

    if (cart.length === 0) {
      cartItemsEl.innerHTML = '<li>Your cart is empty.</li>';
    } else {
      cart.forEach((item, idx) => {
        const li = document.createElement('li');
        const quantityInput = document.createElement('input');
        quantityInput.type = 'number';
        quantityInput.min = 1;
        quantityInput.value = item.quantity;
        quantityInput.onchange = () => {
          const q = parseInt(quantityInput.value, 10);
          item.quantity = q > 0 ? q : 1;
          saveCart();
          renderCart();
        };

        li.textContent = `${item.title} - $${parseFloat(item.price).toFixed(2)} x `;
        li.appendChild(quantityInput);

        total += parseFloat(item.price) * item.quantity;

        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove';
        removeBtn.onclick = () => {
          cart.splice(idx, 1);
          saveCart();
          renderCart();
        };

        li.appendChild(removeBtn);
        cartItemsEl.appendChild(li);
      });
    }

    totalEl.textContent = total.toFixed(2);
  }

  document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const title = btn.dataset.title;
      const price = parseFloat(btn.dataset.price);

      const existing = cart.find(item => item.id === id);
      if (existing) {
        existing.quantity += 1;
      } else {
        cart.push({ id, title, price, quantity: 1 });
      }
      saveCart();
      renderCart();
    });
  });

  if (orderBtn) {
    orderBtn.addEventListener('click', () => {
      if (cart.length === 0) return alert('Cart is empty.');

      fetch('/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart.map(item => ({ book_id: item.id, quantity: item.quantity })) })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          alert('Order placed!');
          cart.length = 0;
          saveCart();
          renderCart();
          window.location.reload();
        } else {
          alert('Order failed.');
        }
      });
  });
  }

  renderCart();
});