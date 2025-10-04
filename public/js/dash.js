
  const API = '/api/products';

  // Fetch total products count from DB
  async function fetchTotalProducts() {
    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error('Failed to fetch products');
      const products = await res.json();
      document.getElementById('totalProducts').textContent = products.length || 0;
    } catch (err) {
      console.error('Error fetching total products:', err);
      document.getElementById('totalProducts').textContent = '0';
    }
  }

  // Call on page load
  document.addEventListener('DOMContentLoaded', fetchTotalProducts);

  