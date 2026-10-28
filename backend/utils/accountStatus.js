// Whether an account may sign in / use the API, beyond isActive. Public
// sign-ups must verify their email and be approved by an Admin first;
// Admin-created users and the first Admin have neither field set.
// Returns null when allowed, otherwise { code, message } for a 403.
function signInBlock(user) {
  if (user.emailVerified === false) {
    return { code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email address first. Enter the code we emailed you, or request a new one.' };
  }
  if (user.approvalStatus === 'pending') {
    return { code: 'APPROVAL_PENDING', message: 'Your email is verified. An administrator still needs to approve your account before you can sign in.' };
  }
  if (user.approvalStatus === 'rejected') {
    return { code: 'REGISTRATION_REJECTED', message: 'Your registration was not approved. Contact an administrator if you think this is a mistake.' };
  }
  return null;
}

module.exports = { signInBlock };
