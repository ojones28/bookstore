document.addEventListener('DOMContentLoaded', () => {
	const searchInput = document.getElementById('search');
	const ratingMin = document.getElementById('rating-min');
	const ratingMax = document.getElementById('rating-max');
	const priceMin = document.getElementById('price-min');
	const priceMax = document.getElementById('price-max');
	const genresSelect = document.getElementById('genres');

	[searchInput, ratingMin, ratingMax, priceMin, priceMax].forEach(el =>
		el.addEventListener('input', filterBooks)
	);
	genresSelect.addEventListener('change', filterBooks);
	document.getElementById('clear-genres').addEventListener('click', () => {
		Array.from(genresSelect.options).forEach(opt => opt.selected = false);
		filterBooks();
	});
	filterBooks();
});

function filterBooks() {
	const search = document.getElementById('search').value.trim().toLowerCase();
	const rMin = Number(document.getElementById('rating-min').value);
	const rMax = Number(document.getElementById('rating-max').value);
	const pMin = Number(document.getElementById('price-min').value);
	const pMax = Number(document.getElementById('price-max').value);

	const selected = Array.from(
		document.getElementById('genres').selectedOptions
	).map(opt => opt.value);
	const selGenres = selected.length > 0 ? selected : null;

	document.querySelectorAll('#books-table tbody tr').forEach(row => {
		const title = row.dataset.title.toLowerCase();
		const author = row.dataset.author.toLowerCase();
		const rating = Number(row.dataset.rating);
		const price = Number(row.dataset.price);
		const genres = row.dataset.genres
			.split(',')
			.map(g => g.trim().toLowerCase());

		const matchSearch = !search || title.includes(search) || author.includes(search);
		const matchRating = rating >= rMin && rating <= rMax;
		const matchPrice = price >= pMin && price <= pMax;
		const matchGenres =
			!selGenres || selGenres.every(g => genres.includes(g.toLowerCase()));

		row.style.display =
			matchSearch && matchRating && matchPrice && matchGenres
				? '' : 'none';
	});
}