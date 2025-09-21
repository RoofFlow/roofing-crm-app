document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  let currentRole = 'user';

  async function getUserAndRole() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = 'index.html';
      return;
    }
    currentUser = user;
    // fetch role from profile table
    const { data: profileData, error: profileError } = await supabase
      .from('profile')
      .select('role')
      .eq('user_id', user.id)
      .single();
    if (profileData && profileData.role) {
      currentRole = profileData.role;
    }
  }

  async function searchLeads(query) {
    let searchQuery = supabase
      .from('leads')
      .select('*')
      .or(`name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
      .order('created_at', { ascending: true });
    if (currentRole !== 'admin' && currentUser) {
      searchQuery = searchQuery.eq('owner_id', currentUser.id);
    }
    const { data, error } = await searchQuery;
    if (error) {
      console.error('Error searching leads', error);
      return [];
    }
    return data;
  }

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
    leads.forEach(lead => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${lead.name || ''}</td>
        <td>${lead.phone || ''}</td>
        <td>${lead.email || ''}</td>
        <td>${lead.owner_id || ''}</td>
        <td><a href="app.html#${lead.id}">Open</a></td>
      `;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  }

  const searchInput = document.getElementById('search-input');
  let debounceTimer;
  searchInput.addEventListener('input', () => {
    const term = searchInput.value.trim();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      if (term) {
        const leads = await searchLeads(term);
        renderResults(leads);
      } else {
        document.getElementById('search-results').innerHTML = '';
      }
    }, 300);
  });

  document.getElementById('sign-out').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
  });

  getUserAndRole();
});
