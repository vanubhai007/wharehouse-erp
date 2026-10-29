import { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx';
import useReducedMotion from '../../hooks/useReducedMotion.js';
import { scrollToSection } from '../../utils/scrollTo.js';
import styles from './Navbar.module.css';

const SECTION_IDS = ['home', 'about', 'skills', 'projects', 'experience', 'services', 'contact'];

export default function Navbar() {
  const { lang, t, toggleLang } = useLanguage();
  const reducedMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const handleNavClick = (id) => (event) => {
    event.preventDefault();
    setMenuOpen(false);
    scrollToSection(id, { reducedMotion });
  };

  return (
    <header className={`${styles.navbar} ${scrolled ? styles.scrolled : ''}`}>
      <nav className={styles.inner} aria-label="Primary">
        <a href="#home" onClick={handleNavClick('home')} className={styles.brand}>
          Vanraj<span className={styles.brandDot}>.dev</span>
        </a>

        <ul className={styles.links} role="list">
          {SECTION_IDS.map((id) => (
            <li key={id}>
              <a href={`#${id}`} onClick={handleNavClick(id)}>
                {t.nav[id]}
              </a>
            </li>
          ))}
        </ul>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.langToggle}
            onClick={toggleLang}
            aria-label={t.nav.langToggleLabel}
          >
            {lang === 'en' ? 'EN' : 'ગુ'} <span aria-hidden="true">⇄</span>
          </button>

          <button
            type="button"
            className={`${styles.menuBtn} ${menuOpen ? styles.menuBtnOpen : ''}`}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      <div
        id="mobile-menu"
        className={`${styles.mobileMenu} ${menuOpen ? styles.mobileMenuOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
        hidden={!menuOpen}
      >
        <ul role="list">
          {SECTION_IDS.map((id) => (
            <li key={id}>
              <a href={`#${id}`} onClick={handleNavClick(id)}>
                {t.nav[id]}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
