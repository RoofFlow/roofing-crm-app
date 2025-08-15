// app.js – main logic for the dashboard

document.addEventListener('DOMContentLoaded', () => {
  // Ensure user is authenticated
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) {
      window.location.href = 'index.html';
    }
  });

  const stages = ['new', 'inspection', 'estimate', 'insurance', 'job', 'complete'];
  const stageTitles = {
    new: 'New Lead',
    inspection: 'Inspection',
    estimate: 'Estimate',
    insurance: 'Insurance',
    job: 'Job',
    complete: 'Complete'
  };

  const board = document.getElementById('pipeline-board');
  const leadForm = document.getElementById('lead-form');
  const modal = document.getElementById('lead-modal');
  const signOutBtn = document.getElementById('sign-out');

  // Build columns
  function buildColumns() {
    board.innerHTML = '';
    stages.forEach(stage => {
      const col = document.createElement('div');
      col.className = 'col stage';
      col.dataset.stage = stage;
      const heading = document.createElement('h3');
      heading.textContent = stageTitles[stage];
      col.appendChild(heading);
      const list = document.createElement('div');
      list.id = `${stage}-list`;
      col.appendChild(list);
      board.appendChild(col);
    });
  }

  // Fetch leads from Supabase
  async function fetchLeads() {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error fetching leads', error);
      return [];
    }
    return data;
  }

  // Render all leads
  function renderLeads(leads) {
    // Clear existing lists
    stages.forEach(stage => {
      const listEl = document.getElementById(`${stage}-list`);
      if (listEl) listEl.innerHTML = '';
    });
    // Append leads
    leads.forEach(lead => {
      const listEl = document.getElementById(`${lead.stage}-list`);
      if (!listEl) return;
      const card = document.createElement('div');
      card.className = 'lead';
      card.dataset.id = lead.id;
      card.textContent = `${lead.name} (${lead.phone})`;
      card.addEventListener('click', () => openLeadModal(lead));
      listEl.appendChild(card);
    });
  }

  // Add new lead
  leadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('lead-name').value.trim();
    const phone = document.getElementById('lead-phone').value.trim();
    const email = document.getElementById('lead-email').value.trim();
    const address = document.getElementById('lead-address').value.trim();
    if (!name || !phone) {
      alert('Name and phone are required');
      return;
    }
    const { error } = await supabase
      .from('leads')
      .insert({
        name,
        phone,
        email,
        address,
        stage: 'new',
        roofType: '',
        roofPitch: '',
        squares: '',
        claimNumber: '',
        carrier: '',
        deductible: '',
        rcv: '',
        acv: '',
        depreciation: '',
        supplement: ''
      });
    if (error) {
      alert('Error adding lead: ' + error.message);
    } else {
      leadForm.reset();
      loadAndRender();
    }
  });

  // Open modal with lead details
  function openLeadModal(lead) {
    modal.classList.add('show');
    // Fill fields
    document.getElementById('edit-id').value = lead.id;
    document.getElementById('edit-name').value = lead.name;
    document.getElementById('edit-phone').value = lead.phone;
    document.getElementById('edit-email').value = lead.email || '';
    document.getElementById('edit-address').value = lead.address || '';
    document.getElementById('edit-roofType').value = lead.roofType || '';
    document.getElementById('edit-roofPitch').value = lead.roofPitch || '';
    document.getElementById('edit-squares').value = lead.squares || '';
    document.getElementById('edit-claimNumber').value = lead.claimNumber || '';
    document.getElementById('edit-carrier').value = lead.carrier || '';
    document.getElementById('edit-deductible').value = lead.deductible || '';
    document.getElementById('edit-rcv').value = lead.rcv || '';
    document.getElementById('edit-acv').value = lead.acv || '';
    document.getElementById('edit-depreciation').value = lead.depreciation || '';
    document.getElementById('edit-supplement').value = lead.supplement || '';
    // Save current stage index for advancement
    modal.dataset.stage = lead.stage;
  }

  // Hide modal
  function closeModal() {
    modal.classList.remove('show');
  }
  document.getElementById('cancel-lead').addEventListener('click', closeModal);

  // Save lead edits
  document.getElementById('save-lead').addEventListener('click', async () => {
    const id = document.getElementById('edit-id').value;
    const updated = {
      name: document.getElementById('edit-name').value.trim(),
      phone: document.getElementById('edit-phone').value.trim(),
      email: document.getElementById('edit-email').value.trim(),
      address: document.getElementById('edit-address').value.trim(),
      roofType: document.getElementById('edit-roofType').value.trim(),
      roofPitch: document.getElementById('edit-roofPitch').value.trim(),
      squares: document.getElementById('edit-squares').value.trim(),
      claimNumber: document.getElementById('edit-claimNumber').value.trim(),
      carrier: document.getElementById('edit-carrier').value.trim(),
      deductible: document.getElementById('edit-deductible').value.trim(),
      rcv: document.getElementById('edit-rcv').value.trim(),
      acv: document.getElementById('edit-acv').value.trim(),
      depreciation: document.getElementById('edit-depreciation').value.trim(),
      supplement: document.getElementById('edit-supplement').value.trim()
    };
    const { error } = await supabase
      .from('leads')
      .update(updated)
      .eq('id', id);
    if (error) {
      alert('Error saving lead: ' + error.message);
    } else {
      closeModal();
      loadAndRender();
    }
  });

  // Advance lead to next stage
  document.getElementById('advance-lead').addEventListener('click', async () => {
    const id = document.getElementById('edit-id').value;
    // Determine current stage
    const stageVal = modal.dataset.stage;
    const currentIndex = stages.indexOf(stageVal);
    if (currentIndex < stages.length - 1) {
      const nextStage = stages[currentIndex + 1];
      const { error } = await supabase
        .from('leads')
        .update({ stage: nextStage })
        .eq('id', id);
      if (error) {
        alert('Error advancing lead: ' + error.message);
      } else {
        closeModal();
        loadAndRender();
      }
    } else {
      closeModal();
    }
  });

  // Delete lead
  document.getElementById('delete-lead').addEventListener('click', async () => {
    const id = document.getElementById('edit-id').value;
    if (!confirm('Delete this lead?')) return;
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) {
      alert('Error deleting lead: ' + error.message);
    } else {
      closeModal();
      loadAndRender();
    }
  });

  // Export CSV
  document.getElementById('export-csv').addEventListener('click', async () => {
    const leads = await fetchLeads();
    if (!leads.length) {
      alert('No leads to export.');
      return;
    }
    const headers = ['id','name','phone','email','address','stage','roofType','roofPitch','squares','claimNumber','carrier','deductible','rcv','acv','depreciation','supplement'];
    const rows = leads.map(l => headers.map(h => (l[h] ? String(l[h]).replace(/,/g, ' ') : '')).join(','));
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'leads.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  // Sign out
  signOutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
  });

  // Load leads and render board
  async function loadAndRender() {
    const leads = await fetchLeads();
    renderLeads(leads);
  }

  // Initialize
  buildColumns();
  loadAndRender();
});
