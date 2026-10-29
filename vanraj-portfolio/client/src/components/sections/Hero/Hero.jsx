import { useLanguage } from '../../../context/LanguageContext.jsx';
import useReducedMotion from '../../../hooks/useReducedMotion.js';
import { scrollToSection } from '../../../utils/scrollTo.js';
import HeroAvatar from '../../three/HeroAvatar.jsx';
import AvatarConceptImage from '../../common/AvatarConceptImage.jsx';
import styles from './Hero.module.css';

export default function Hero() {
  const { t } = useLanguage();
  const reducedMotion = useReducedMotion();

  const goTo = (id) => (event) => {
    event.preventDefault();
    scrollToSection(id, { reducedMotion });
  };

  return (
    <section id="home" className={styles.hero} aria-label="Introduction">
      <div className={`container ${styles.inner}`}>
        <div className={styles.copy}>
          <p className={styles.greeting}>{t.hero.greeting}</p>
          <h1 className={styles.name}>
            {t.hero.name} <span className={styles.brand}>— {t.hero.brand}</span>
          </h1>
          <p className={styles.role}>{t.hero.role}</p>
          <p className={styles.tagline}>{t.hero.tagline}</p>

          <div className={styles.ctas}>
            <a href="#projects" onClick={goTo('projects')} className="btn btn-primary">
              {t.hero.ctaProjects}
            </a>
            <a href="#contact" onClick={goTo('contact')} className="btn btn-outline">
              {t.hero.ctaContact}
            </a>
          </div>
        </div>

        <div className={styles.visual}>
          <HeroAvatar />
          <div className={styles.conceptBadge}>
            <AvatarConceptImage />
          </div>
        </div>
      </div>

      <a href="#about" onClick={goTo('about')} className={styles.scrollHint}>
        <span>{t.hero.scrollHint}</span>
        <span className={styles.scrollArrow} aria-hidden="true">
          ↓
        </span>
      </a>
    </section>
  );
}
