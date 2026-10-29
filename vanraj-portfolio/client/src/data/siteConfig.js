// Central place for editable contact details and links.
// Everything marked EDIT_ME is a placeholder — update before going live.
// Do not ship with these values claiming they are real/working.

export const siteConfig = {
  brand: 'Vanraj.dev',
  role: 'Full Stack Developer',
  location: 'EDIT_ME — e.g. Gujarat, India',

  email: 'EDIT_ME@example.com',
  phone: 'EDIT_ME — +91 00000 00000',
  linkedin: null, // e.g. 'https://www.linkedin.com/in/your-handle'
  github: null, // e.g. 'https://github.com/your-handle'
  resumeUrl: null, // path to a PDF placed in client/public, e.g. '/resume.pdf'
};

export const isPlaceholder = (value) =>
  value === null || (typeof value === 'string' && value.startsWith('EDIT_ME'));
