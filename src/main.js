import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const $ = (id) => document.getElementById(id)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const supabase = createClient(supabaseUrl, supabasePublishableKey)

let mode = 'signin'
let currentUser = null
let profilePhotoUrl = ''
let toastTimer

function toast(message) {
  $('toast').textContent = message
  $('toast').classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3200)
}

function setMode(next) {
  mode = next
  const signup = mode === 'signup'
  $('signinTab').classList.toggle('active', !signup)
  $('signupTab').classList.toggle('active', signup)
  $('authTitle').textContent = signup ? 'A better way to bank.' : 'Welcome back.'
  $('authSub').textContent = signup ? 'Create your Harborline profile to get started.' : 'Sign in to your Harborline account to continue.'
  $('nameField').hidden = !signup
  $('fullName').required = signup
  $('signinMeta').hidden = signup
  $('submitBtn').textContent = signup ? 'Create account' : 'Sign in securely'
  $('password').autocomplete = signup ? 'new-password' : 'current-password'
  $('password').minLength = signup ? 8 : 1
}

function showDashboard(user) {
  currentUser = user
  const name = user.user_metadata?.full_name?.trim() || user.email?.split('@')[0] || 'Account'
  $('greeting').textContent = `Good morning, ${name.split(/[ ._-]/)[0]}`
  $('avatar').textContent = name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
  $('avatar').setAttribute('aria-label', `Open profile settings for ${name}`)
  $('authView').style.display = 'none'
  $('dashboardView').style.display = 'block'
  void loadProfilePhoto(user)
}

async function loadProfilePhoto(user) {
  const path = user.user_metadata?.avatar_path
  const name = user.user_metadata?.full_name?.trim() || user.email?.split('@')[0] || 'Account'
  if (!path) {
    $('profilePhoto').textContent = name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
    return
  }
  const { data, error } = await supabase.storage.from('profile-photos').createSignedUrl(path, 3600)
  if (error) return toast('Could not load profile picture. Check Storage setup.')
  profilePhotoUrl = data.signedUrl
  $('profilePhoto').innerHTML = `<img alt="Profile picture" src="${profilePhotoUrl}">`
  $('avatar').innerHTML = `<img alt="" src="${profilePhotoUrl}">`
}

function showSignIn() {
  currentUser = null
  $('profileBackdrop').hidden = true
  $('dashboardView').style.display = 'none'
  $('authView').style.display = 'grid'
  setMode('signin')
}

$('signinTab').addEventListener('click', () => setMode('signin'))
$('signupTab').addEventListener('click', () => setMode('signup'))

$('passwordToggle').addEventListener('click', () => {
  const reveal = $('password').type === 'password'
  $('password').type = reveal ? 'text' : 'password'
  $('passwordToggle').setAttribute('aria-label', reveal ? 'Hide password' : 'Show password')
  $('passwordToggle').setAttribute('title', reveal ? 'Hide password' : 'Show password')
  $('passwordToggle').setAttribute('aria-pressed', String(reveal))
  $('eyeIcon').innerHTML = reveal
    ? '<path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a15 15 0 0 1-3 3.8M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7c1 0 1.9-.1 2.8-.4"/>'
    : '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'
})

$('authForm').addEventListener('submit', async (event) => {
  event.preventDefault()
  if (!$('authForm').reportValidity()) return
  const email = $('email').value.trim().toLowerCase()
  const password = $('password').value

  if (mode === 'signup') {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: $('fullName').value.trim() },
        emailRedirectTo: window.location.origin,
      },
    })
    if (error) return toast(error.message)
    $('password').value = ''
    if (!data.session) {
      setMode('signin')
      $('email').value = email
      $('authSub').textContent = 'Check your email to confirm your account, then sign in.'
      return toast('Account created. Confirm your email before signing in.')
    }
    showDashboard(data.user)
    return toast('Your account is ready.')
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return toast(error.message)
  showDashboard(data.user)
})

$('forgot').addEventListener('click', async (event) => {
  event.preventDefault()
  const email = $('email').value.trim().toLowerCase()
  if (!email) return toast('Enter your email address first.')
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
  if (error) return toast(error.message)
  toast('If an account exists for that email, password reset instructions have been sent.')
})

$('helpBtn').addEventListener('click', () => toast('How can we help?'))
$('allActivity').addEventListener('click', (event) => { event.preventDefault(); toast('You’re viewing all recent activity.') })
document.querySelectorAll('.local-link').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); toast('Website policy information is not configured yet.') }))
document.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => toast(`${button.dataset.action} is not connected to a banking service yet.`)))
$('todayDate').textContent = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())

$('avatar').addEventListener('click', () => {
  if (!currentUser) return
  $('profileName').value = currentUser.user_metadata?.full_name || ''
  $('profileEmail').value = currentUser.email || ''
  $('profileBackdrop').hidden = false
})

function closeProfile() { $('profileBackdrop').hidden = true }
$('profileClose').addEventListener('click', closeProfile)
$('profileBackdrop').addEventListener('click', (event) => { if (event.target === $('profileBackdrop')) closeProfile() })
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('profileBackdrop').hidden) closeProfile() })

$('photoUpload').addEventListener('change', async (event) => {
  const file = event.target.files[0]
  if (!file) return
  if (!currentUser) return toast('Sign in before adding a profile picture.')
  const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
  if (!extensions[file.type]) return toast('Choose a JPG, PNG, or WebP image.')
  if (file.size > 5 * 1024 * 1024) return toast('Choose an image smaller than 5 MB.')
  const oldPath = currentUser.user_metadata?.avatar_path
  const path = `${currentUser.id}/avatar-${Date.now()}.${extensions[file.type]}`
  const { error: uploadError } = await supabase.storage.from('profile-photos').upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false,
  })
  if (uploadError) return toast('Could not upload picture. Check Storage setup and try again.')
  const { data, error } = await supabase.auth.updateUser({
    data: { ...currentUser.user_metadata, avatar_path: path },
  })
  if (error) {
    await supabase.storage.from('profile-photos').remove([path])
    return toast(error.message)
  }
  currentUser = data.user
  await loadProfilePhoto(currentUser)
  if (oldPath) await supabase.storage.from('profile-photos').remove([oldPath])
  event.target.value = ''
  toast('Profile picture updated.')
})

$('profileForm').addEventListener('submit', async (event) => {
  event.preventDefault()
  if (!$('profileForm').reportValidity() || !currentUser) return
  const name = $('profileName').value.trim()
  const nextEmail = $('profileEmail').value.trim().toLowerCase()
  const changes = { data: { ...currentUser.user_metadata, full_name: name } }
  if (nextEmail !== currentUser.email?.toLowerCase()) changes.email = nextEmail
  const { data, error } = await supabase.auth.updateUser(changes)
  if (error) return toast(error.message)
  currentUser = data.user
  if (!changes.email) showDashboard(currentUser)
  closeProfile()
  toast(changes.email ? 'Check your new email address to confirm the change.' : 'Profile updated.')
})

$('changePasswordForm').addEventListener('submit', async (event) => {
  event.preventDefault()
  if (!$('changePasswordForm').reportValidity() || !currentUser?.email) return
  const currentPassword = $('currentPassword').value
  const newPassword = $('newPassword').value
  if (newPassword !== $('confirmPassword').value) return toast('The new passwords do not match.')
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: currentUser.email, password: currentPassword })
  if (signInError) return toast('Current password is incorrect.')
  const { data, error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return toast(error.message)
  currentUser = data.user
  $('changePasswordForm').reset()
  toast('Password updated.')
})

$('signOutBtn').addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut()
  if (error) return toast(error.message)
  closeProfile()
  showSignIn()
})

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) showDashboard(session.user)
  else if ($('dashboardView').style.display === 'block') showSignIn()
})

const { data: { session } } = await supabase.auth.getSession()
if (session?.user) showDashboard(session.user)
