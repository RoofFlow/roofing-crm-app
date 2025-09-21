// search.js – search and results page logic

// Wait until DOM and Supabase auth are ready

document.addEventListener('DOMContentLoaded', async () => {
  // Ensure user is authenticated; redirect to sign‑in page if not
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  // Fetch current user and role from profile table
  let currentUser = null;
  let currentRole = 'user';
  async function getUserAndRole() {
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;
    if (user) {
      const { data: profileData } = await supabase
        .from('profile')
        .select('role')
        .eq('user_id', user.id)
        .single();
      if (profileData && profileData.role) {
        currentRole = profileData.role;
      }
    }
  }
  await getUserAndRole();

  // Sign‑out button
  const signOutBtn = document.getElementById('sign-out');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = 'index.html';
    });
  }

  // Search leads from Supabase
  async function searchLeads(query) {
    let queryBuilder = supabase.from('leads').select('id, name, phone, email, owner_id');
    if (query) {
      queryBuilder = queryBuilder.or(
        `name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`
      );
    }
    const { data, error } = await queryBuilder;
    if (error) {
      console.error('Search error:', error.message);
      return [];
    }
    return data || [];
  }

  // Render search results in a table with an Open link
  function renderResults(leads) {
    const container = document.getElementById('search-results');
    container.innerHTML = '';
    if (!leads || leads.length === 0) {
      container.innerHTML = '<p>No customers found.</p>';
      return;
    }
    const table = document.createElement('table');
    table.className = 'search-table';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Name</th><th>Phone</th><th>Email</th><th>Owner ID</th><th>Action</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    leads.forEach((lead) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${lead.name || ''}</td>
        <td>${lead.phone || ''}</td>
        <td>${lead.email || ''}</td>
        <td>${lead.owner_id || ''}</td>
        <td><a href="customer.html?id=${lead.id}">Open</a></td>
      `;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  }

  // Debounce input handler
  const searchInput = document.getElementById('search-input');
  let debounceTimer;
  async function handleInput() {
    const term = searchInput.value.trim();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const leads = await searchLeads(term);
      renderResults(leads);
    }, 300);
  }
  searchInput.addEventListener('input', handleInput);

  // Initial load: show all leads
  const initialLeads = await searchLeads('');
  renderResults(initialLeads);
});
