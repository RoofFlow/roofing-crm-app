document.addEventListener('DOMContentLoaded', () => {
  async function getUserAndRole() {
    const { data: { user } } = await supabase.auth.getUser();
    let role = 'user';
    if (user) {
      const { data: profileData } = await supabase
        .from('profile')
        .select('role')
        .eq('user_id', user.id)
        .single();
      if (profileData && profileData.role) {
        role = profileData.role;
      }
    }
    return { user, role };
  }

  const waitInterval = setInterval(() => {
    if (typeof openLeadModal === 'function') {
      clearInterval(waitInterval);
      const originalOpenLeadModal = openLeadModal;
      window.openLeadModal = async function (lead) {
        await originalOpenLeadModal.call(this, lead);
        const { user: currentUser, role: currentRole } = await getUserAndRole();
        const canEdit = currentRole === 'admin' || (lead && lead.owner_id === currentUser?.id);
        // Disable or enable form fields in modal
        document.querySelectorAll('#lead-modal input, #lead-modal select, #lead-modal textarea').forEach((el) => {
          el.disabled = !canEdit;
        });
        // Show or hide action buttons
        ['save-lead', 'advance-lead', 'delete-lead', 'photo-upload', 'add-crew-assignment'].forEach((id) => {
          const el = document.getElementById(id);
          if (el) {
            if (canEdit) {
              el.style.display = '';
              el.disabled = false;
            } else {
              el.style.display = 'none';
            }
          }
        });
      };
    }
  }, 200);
});
