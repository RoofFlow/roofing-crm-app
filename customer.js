// customer.js - display customer details on dedicated page

document.addEventListener('DOMContentLoaded', async () => {
  // Ensure user is authenticated
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  // Sign out handler
  const signOutBtn = document.getElementById('sign-out');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = 'index.html';
    });
  }

  // Parse lead ID from URL query string
  const params = new URLSearchParams(window.location.search);
  const leadId = params.get('id');
  const detailsDiv = document.getElementById('customer-details');

  if (!leadId) {
    detailsDiv.textContent = 'No customer specified.';
    return;
  }

  // Get current user and role
  let currentUser = null;
  let currentRole = 'user';
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

  // Fetch lead details
  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (error || !lead) {
    detailsDiv.textContent = 'Customer not found.';
    return;
  }

  // Build details HTML
  let html = '<div class="customer-card">';
  html += '<h3>Homeowner Information</h3>';
  const excluded = ['id', 'owner_id', 'created_at', 'updated_at'];
  for (const key in lead) {
    if (!Object.prototype.hasOwnProperty.call(lead, key)) continue;
    if (excluded.includes(key)) continue;
    const value = lead[key] ?? '';
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    html += `<p><strong>${label}:</strong> ${value}</p>`;
  }
  html += '</div>';

  // Show edit link if user has permission
  const canEdit = currentRole === 'admin' || (currentUser && lead.owner_id === currentUser.id);
  if (canEdit) {
    html += `<p><a href="app.html#${lead.id}">Edit this customer</a></p>`;
  }

  detailsDiv.innerHTML = html;
});
