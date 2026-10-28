// Keeps the password typed on the sign-up form in memory only, so the
// verification screen can send it with the code without asking again. It is
// never written to localStorage, the URL or browser history, and is gone
// after a page reload (the screen then asks for the password).
let pending = null;

export function rememberSignup(email, password) {
  pending = { email, password };
}

export function signupPasswordFor(email) {
  return pending && pending.email === email ? pending.password : '';
}

export function forgetSignup() {
  pending = null;
}
