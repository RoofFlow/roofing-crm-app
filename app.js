// app.js – main logic for the dashboard

document.addEventListener('DOMContentLoaded', () => {
  // Ensure user is authenticated
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) {
      window.location.href = 'index.html';
    }
  });

  // Track current user and role for data filtering
  let currentUser = null;
  let currentRole = 'user';

  // Fetch the current user and profile role from Supabase
  async function getUserAndRole() {
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;
    currentRole = 'user';
    if (user) {
      const { data: profileData } = await supabase
        .from('profile')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profileData && profileData.role) {
        currentRole = profileData.role;
      }
    }
  }

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
    let query = supabase.from('leads').select('*').order('created_at', { ascending: true });
    // Restrict leads to the current user unless admin
    if (currentRole !== 'admin' && currentUser) {
      query = query.eq('owner_id', currentUser.id);
    }
    const { data, error } = await query;
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
        owner_id: currentUser ? currentUser.id : null,
        // Use lower‑case column names to match the Supabase schema
        rooftype: '',
        roofpitch: '',
        // Use null for numeric fields so Postgres numeric columns accept the value
        squares: null,
        claimnumber: '',
        carrier: '',
        deductible: null,
        rcv: null,
        acv: null,
        depreciation: null,
        supplement: null,
        claim_status: 'Not Filed',
        payment_status: 'Unpaid',
        doc_url: '',
        photo_report_url: ''
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
    // Use lower‑case properties from Supabase for roof and claim fields
    document.getElementById('edit-roofType').value = lead.rooftype || '';
    document.getElementById('edit-roofPitch').value = lead.roofpitch || '';
    document.getElementById('edit-squares').value = lead.squares || '';
    document.getElementById('edit-claimNumber').value = lead.claimnumber || '';
    document.getElementById('edit-carrier').value = lead.carrier || '';
    document.getElementById('edit-deductible').value = lead.deductible || '';
    document.getElementById('edit-rcv').value = lead.rcv || '';
    document.getElementById('edit-acv').value = lead.acv || '';
    document.getElementById('edit-depreciation').value = lead.depreciation || '';
    document.getElementById('edit-supplement').value = lead.supplement || '';
    // Set claim and payment statuses
    const claimStatusSelect = document.getElementById('edit-claimStatus');
    if (claimStatusSelect) claimStatusSelect.value = lead.claim_status || 'Not Filed';
    const paymentStatusSelect = document.getElementById('edit-paymentStatus');
    if (paymentStatusSelect) paymentStatusSelect.value = lead.payment_status || 'Unpaid';

    // Show existing contract link if available
    const contractLink = document.getElementById('download-contract-link');
    if (contractLink) {
      if (lead.doc_url) {
        const pub = supabase.storage.from('documents').getPublicUrl(lead.doc_url);
        if (pub.data && pub.data.publicUrl) {
          contractLink.href = pub.data.publicUrl;
          contractLink.style.display = 'inline';
        } else {
          contractLink.style.display = 'none';
        }
      } else {
        contractLink.style.display = 'none';
      }
    }

    // Load photos and crew assignments
    loadPhotos(lead.id);
    loadCrewAssignments(lead.id);
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
      // Use lower‑case property names to match Supabase columns
      rooftype: document.getElementById('edit-roofType').value.trim(),
      roofpitch: document.getElementById('edit-roofPitch').value.trim(),
      squares: (() => {
        const val = document.getElementById('edit-squares').value.trim();
        return val === '' ? null : parseFloat(val);
      })(),
      claimnumber: document.getElementById('edit-claimNumber').value.trim(),
      carrier: document.getElementById('edit-carrier').value.trim(),
      deductible: (() => {
        const val = document.getElementById('edit-deductible').value.trim();
        return val === '' ? null : parseFloat(val);
      })(),
      rcv: (() => {
        const val = document.getElementById('edit-rcv').value.trim();
        return val === '' ? null : parseFloat(val);
      })(),
      acv: (() => {
        const val = document.getElementById('edit-acv').value.trim();
        return val === '' ? null : parseFloat(val);
      })(),
      depreciation: (() => {
        const val = document.getElementById('edit-depreciation').value.trim();
        return val === '' ? null : parseFloat(val);
      })(),
      supplement: (() => {
        const val = document.getElementById('edit-supplement').value.trim();
        return val === '' ? null : parseFloat(val);
      })(),
      // save claim and payment statuses
      claim_status: document.getElementById('edit-claimStatus').value,
      payment_status: document.getElementById('edit-paymentStatus').value
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

  // Photo upload handler
  const photoUploadInput = document.getElementById('photo-upload');
  if (photoUploadInput) {
    photoUploadInput.addEventListener('change', async (e) => {
      const leadId = document.getElementById('edit-id').value;
      const files = Array.from(e.target.files);
      for (const file of files) {
        // store photo under user/uid/leads/leadId/
        const basePathPhoto = currentUser ? `user/${currentUser.id}/leads/${leadId}/` : `${leadId}/`;
        const filePath = `${basePathPhoto}${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from('Photos').upload(filePath, file, { upsert: true });
        if (!uploadError) {
          await supabase.from('photos').insert({ lead_id: leadId, owner_id: currentUser ? currentUser.id : null, name: file.name, url: filePath });
        } else {
          alert('Error uploading photo: ' + uploadError.message);
        }
      }
      // refresh list
      loadPhotos(leadId);
      // reset file input
      e.target.value = '';
    });
  }

  // Generate photo report
  const generatePhotoReportBtn = document.getElementById('generate-photo-report');
  if (generatePhotoReportBtn) {
    generatePhotoReportBtn.addEventListener('click', async () => {
      const leadId = document.getElementById('edit-id').value;
      // Get photos for lead
      const { data: photos, error: photoErr } = await supabase.from('photos').select('*').eq('lead_id', leadId);
      if (photoErr || !photos || photos.length === 0) {
        alert('No photos to include in the report.');
        return;
      }
      try {
        const pdfDoc = await PDFLib.PDFDocument.create();
        for (const photo of photos) {
          const { data: pub } = supabase.storage.from('Photos').getPublicUrl(photo.url);
          if (pub && pub.publicUrl) {
            const response = await fetch(pub.publicUrl);
            const arrayBuffer = await response.arrayBuffer();
            const imageBytes = new Uint8Array(arrayBuffer);
            let image;
            let dims;
            if (photo.url.toLowerCase().endsWith('.png')) {
              image = await pdfDoc.embedPng(imageBytes);
              dims = image.scale(0.5);
            } else {
              image = await pdfDoc.embedJpg(imageBytes);
              dims = image.scale(0.5);
            }
            const page = pdfDoc.addPage([612, 792]);
            const { width, height } = dims;
            // Center image on page
            const x = (612 - width) / 2;
            const y = (792 - height) / 2;
            page.drawImage(image, { x, y, width, height });
          }
        }
        const pdfBytes = await pdfDoc.save();
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        // Store photo report under user/uid/leads/leadId/ path
        const basePath2 = currentUser ? `user/${currentUser.id}/leads/${leadId}/` : `${leadId}/`;
        const reportPath = `${basePath2}${Date.now()}-photo_report.pdf`;
        const { error: uploadErr } = await supabase.storage.from('documents').upload(reportPath, pdfBlob, { upsert: true });
        if (uploadErr) {
          alert('Error uploading photo report: ' + uploadErr.message);
          return;
        }
        await supabase.from('leads').update({ photo_report_url: reportPath }).eq('id', leadId);
        // Insert a document entry for the photo report
        await supabase.from('documents').insert({
          lead_id: leadId,
          owner_id: currentUser ? currentUser.id : null,
          name: 'Photo Report',
          url: reportPath
        });
        alert('Photo report generated.');
      } catch (err) {
        alert('Error generating photo report: ' + err.message);
      }
    });
  }

  // Generate contract
  const generateContractBtn = document.getElementById('generate-contract');
  if (generateContractBtn) {
    generateContractBtn.addEventListener('click', async () => {
      const leadId = document.getElementById('edit-id').value;
      // Collect current values from modal
      const leadData = {
        name: document.getElementById('edit-name').value.trim(),
        phone: document.getElementById('edit-phone').value.trim(),
        email: document.getElementById('edit-email').value.trim(),
        address: document.getElementById('edit-address').value.trim(),
        rooftype: document.getElementById('edit-roofType').value.trim(),
        roofpitch: document.getElementById('edit-roofPitch').value.trim(),
        squares: document.getElementById('edit-squares').value.trim(),
        claimnumber: document.getElementById('edit-claimNumber').value.trim(),
        carrier: document.getElementById('edit-carrier').value.trim(),
        deductible: document.getElementById('edit-deductible').value.trim(),
        rcv: document.getElementById('edit-rcv').value.trim(),
        acv: document.getElementById('edit-acv').value.trim(),
        depreciation: document.getElementById('edit-depreciation').value.trim(),
        supplement: document.getElementById('edit-supplement').value.trim()
      };
      try {
        const pdfDoc = await PDFLib.PDFDocument.create();
        const page = pdfDoc.addPage([612, 792]);
        const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
        let y = 760;
        const fontSize = 12;
        const lines = [
          'Roofing Contract',
          '',
          `Homeowner: ${leadData.name}`,
          `Phone: ${leadData.phone}`,
          `Email: ${leadData.email}`,
          `Address: ${leadData.address}`,
          '',
          `Roof Type: ${leadData.rooftype}`,
          `Roof Pitch: ${leadData.roofpitch}`,
          `Squares: ${leadData.squares}`,
          '',
          `Claim Number: ${leadData.claimnumber}`,
          `Carrier: ${leadData.carrier}`,
          `Deductible: ${leadData.deductible}`,
          `RCV: ${leadData.rcv}`,
          `ACV: ${leadData.acv}`,
          `Depreciation: ${leadData.depreciation}`,
          `Supplement: ${leadData.supplement}`,
          '',
          'Thank you for choosing our roofing services.'
        ];
        lines.forEach(text => {
          page.drawText(text, { x: 50, y, size: fontSize, font });
          y -= fontSize + 4;
        });
        const pdfBytes = await pdfDoc.save();
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        // Store contract under user/uid/leads/leadId/ to satisfy storage RLS policies
        const basePath = currentUser ? `user/${currentUser.id}/leads/${leadId}/` : `${leadId}/`;
        const docPath = `${basePath}${Date.now()}-contract.pdf`;
        const { error: uploadErr } = await supabase.storage.from('documents').upload(docPath, pdfBlob, { upsert: true });
        if (uploadErr) {
          alert('Error uploading contract: ' + uploadErr.message);
          return;
        }
        // Update leads table with doc URL
        await supabase.from('leads').update({ doc_url: docPath }).eq('id', leadId);
        // Insert document row
        await supabase.from('documents').insert({
          lead_id: leadId,
          owner_id: currentUser ? currentUser.id : null,
          name: 'Contract',
          url: docPath
        });
        // Update link in modal
        const { data: pub } = supabase.storage.from('documents').getPublicUrl(docPath);
        const contractLink = document.getElementById('download-contract-link');
        if (contractLink && pub && pub.publicUrl) {
          contractLink.href = pub.publicUrl;
          contractLink.style.display = 'inline';
        }
        alert('Contract generated.');
      } catch (err) {
        alert('Error generating contract: ' + err.message);
      }
    });
  }

  // Crew assignment
  const assignCrewBtn = document.getElementById('assign-crew');
  if (assignCrewBtn) {
    assignCrewBtn.addEventListener('click', async () => {
      const leadId = document.getElementById('edit-id').value;
      const crewName = document.getElementById('crew-name').value.trim();
      const crewDate = document.getElementById('crew-date').value;
      const crewNotes = document.getElementById('crew-notes').value.trim();
      if (!crewName) {
        alert('Crew name is required.');
        return;
      }
      const { error: assignErr } = await supabase.from('crew_assignments').insert({
        lead_id: leadId,
        crew_name: crewName,
        // Use scheduled_date to match the column name in the database
        scheduled_date: crewDate || null,
        notes: crewNotes
      });
      if (assignErr) {
        alert('Error assigning crew: ' + assignErr.message);
        return;
      }
      // Clear inputs
      document.getElementById('crew-name').value = '';
      document.getElementById('crew-date').value = '';
      document.getElementById('crew-notes').value = '';
      loadCrewAssignments(leadId);
    });
  }

  // Load photos for a lead
  async function loadPhotos(leadId) {
    const photoList = document.getElementById('photo-list');
    if (!photoList) return;
    photoList.innerHTML = '';
    const { data: photos, error } = await supabase.from('photos').select('*').eq('lead_id', leadId);
    if (error || !photos) return;
    for (const photo of photos) {
      const { data: pub } = supabase.storage.from('Photos').getPublicUrl(photo.url);
      if (pub && pub.publicUrl) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = pub.publicUrl;
        a.textContent = photo.url.split('/').pop();
        a.target = '_blank';
        li.appendChild(a);
        photoList.appendChild(li);
      }
    }
  }

  // Load crew assignments for a lead
  async function loadCrewAssignments(leadId) {
    const crewList = document.getElementById('crew-list');
    if (!crewList) return;
    crewList.innerHTML = '';
    const { data: assignments, error } = await supabase.from('crew_assignments')
      .select('*')
      .eq('lead_id', leadId)
      // Order by scheduled_date to match the field name
      .order('scheduled_date', { ascending: true });
    if (error || !assignments) return;
    assignments.forEach(a => {
      const li = document.createElement('li');
      // Use scheduled_date when displaying the date
      const dateVal = a.scheduled_date || a.date || null;
      const dateStr = dateVal ? dateVal.toString().substring(0, 10) : '';
      li.textContent = `${a.crew_name} - ${dateStr} ${a.notes ? '- ' + a.notes : ''}`;
      crewList.appendChild(li);
    });
  }

  // Export CSV
  document.getElementById('export-csv').addEventListener('click', async () => {
    const leads = await fetchLeads();
    if (!leads.length) {
      alert('No leads to export.');
      return;
    }
    // Use lower‑case header names to match Supabase columns
    const headers = ['id','name','phone','email','address','stage','rooftype','roofpitch','squares','claimnumber','carrier','deductible','rcv','acv','depreciation','supplement'];
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

  // Initialize: fetch user & role then build board
  getUserAndRole().then(() => {
    buildColumns();
    loadAndRender();
  });
});
