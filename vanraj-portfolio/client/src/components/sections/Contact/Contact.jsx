import { useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext.jsx';
import { siteConfig, isPlaceholder } from '../../../data/siteConfig.js';
import { submitContactMessage } from '../../../utils/api.js';
import Reveal from '../../common/Reveal.jsx';
import SectionHeading from '../../common/SectionHeading.jsx';
import styles from './Contact.module.css';

const INITIAL_FORM = { name: '', email: '', message: '' };

function DirectLink({ label, value, href, placeholderNotice }) {
  const placeholder = isPlaceholder(value);

  return (
    <div className={styles.directItem}>
      <span className={styles.directLabel}>{label}</span>
      {placeholder ? (
        <span className={styles.directPlaceholder} title={placeholderNotice}>
          {value ?? 'Not provided yet'}
        </span>
      ) : (
        <a href={href} className={styles.directValue} target={href?.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
          {value}
        </a>
      )}
    </div>
  );
}

export default function Contact() {
  const { t } = useLanguage();
  const [form, setForm] = useState(INITIAL_FORM);
  const [status, setStatus] = useState('idle'); // idle | sending | success | error

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('sending');
    try {
      await submitContactMessage(form);
      setStatus('success');
      setForm(INITIAL_FORM);
    } catch {
      setStatus('error');
    }
  };

  return (
    <section id="contact" className="section" aria-labelledby="contact-heading">
      <div className="container">
        <h2 id="contact-heading" className="visually-hidden">
          {t.contact.title}
        </h2>
        <SectionHeading eyebrow={t.contact.eyebrow} title={t.contact.title} subtitle={t.contact.subtitle} />

        <div className={styles.grid}>
          <Reveal as="form" className={styles.form} onSubmit={handleSubmit} noValidate>
            <label htmlFor="contact-name">{t.contact.formName}</label>
            <input
              id="contact-name"
              name="name"
              type="text"
              required
              value={form.name}
              onChange={handleChange}
              autoComplete="name"
            />

            <label htmlFor="contact-email">{t.contact.formEmail}</label>
            <input
              id="contact-email"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
            />

            <label htmlFor="contact-message">{t.contact.formMessage}</label>
            <textarea
              id="contact-message"
              name="message"
              rows={5}
              required
              value={form.message}
              onChange={handleChange}
            />

            <button type="submit" className="btn btn-primary" disabled={status === 'sending'}>
              {status === 'sending' ? t.contact.formSending : t.contact.formSubmit}
            </button>

            <div role="status" aria-live="polite" className={styles.formStatus}>
              {status === 'success' && <p className={styles.success}>{t.contact.formSuccess}</p>}
              {status === 'error' && <p className={styles.error}>{t.contact.formError}</p>}
            </div>
          </Reveal>

          <Reveal className={styles.direct} delay={0.1}>
            <DirectLink
              label={t.contact.directEmail}
              value={siteConfig.email}
              href={isPlaceholder(siteConfig.email) ? undefined : `mailto:${siteConfig.email}`}
              placeholderNotice={t.contact.placeholderNotice}
            />
            <DirectLink
              label={t.contact.directPhone}
              value={siteConfig.phone}
              href={isPlaceholder(siteConfig.phone) ? undefined : `tel:${siteConfig.phone}`}
              placeholderNotice={t.contact.placeholderNotice}
            />
            <DirectLink
              label={t.contact.directLinkedIn}
              value={siteConfig.linkedin ?? 'EDIT_ME — add LinkedIn URL'}
              href={siteConfig.linkedin ?? undefined}
              placeholderNotice={t.contact.placeholderNotice}
            />
            <DirectLink
              label={t.contact.directResume}
              value={siteConfig.resumeUrl ? 'resume.pdf' : 'EDIT_ME — add resume file'}
              href={siteConfig.resumeUrl ?? undefined}
              placeholderNotice={t.contact.placeholderNotice}
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
