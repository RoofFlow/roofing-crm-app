// auth.js – handles user sign-in and sign-up

document.addEventListener('DOMContentLoaded', () => {
  // Redirect to app if already signed in
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      window.location.href = 'app.html';
    }
  });

  const signinForm = document.getElementById('signin-form');
  const signupForm = document.getElementById('signup-form');
  const signupCard = document.getElementById('signup-card');
  const showSignup = document.getElementById('show-signup');
  const showSignin = document.getElementById('show-signin');

  // Toggle forms
  showSignup.addEventListener('click', (e) => {
    e.preventDefault();
    signupCard.classList.remove('hidden');
    signinForm.parentElement.classList.add('hidden');
  });
  showSignin.addEventListener('click', (e) => {
    e.preventDefault();
    signupCard.classList.add('hidden');
    signinForm.parentElement.classList.remove('hidden');
  });

  // Sign in
  signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.href = 'app.html';
    } catch (err) {
      alert(err.message || 'Sign in failed');
    }
  });

  // Sign up
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      alert('Account created. Please check your email to confirm.');
      // After sign up, sign in automatically
      await supabase.auth.signInWithPassword({ email, password });
      window.location.href = 'app.html';
    } catch (err) {
      alert(err.message || 'Sign up failed');
    }
  });
});
