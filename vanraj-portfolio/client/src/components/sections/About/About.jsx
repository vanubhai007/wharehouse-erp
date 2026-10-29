import { useLanguage } from '../../../context/LanguageContext.jsx';
import { siteConfig, isPlaceholder } from '../../../data/siteConfig.js';
import Reveal from '../../common/Reveal.jsx';
import SectionHeading from '../../common/SectionHeading.jsx';
import styles from './About.module.css';

export default function About() {
  const { t } = useLanguage();

  return (
    <section id="about" className="section" aria-labelledby="about-heading">
      <div className="container">
        <SectionHeading eyebrow={t.about.eyebrow} title={t.about.title} />
        <h2 id="about-heading" className="visually-hidden">
          {t.about.title}
        </h2>

        <div className={styles.grid}>
          <Reveal className={styles.text}>
            <p>{t.about.body1}</p>
            <p>{t.about.body2}</p>
          </Reveal>

          <Reveal as="dl" className={styles.stats} delay={0.1}>
            <div className={styles.stat}>
              <dt>{t.about.stat1Label}</dt>
              <dd>4+</dd>
            </div>
            <div className={styles.stat}>
              <dt>{t.about.stat2Label}</dt>
              <dd className={styles.statSmall}>{t.about.stat2Value}</dd>
            </div>
            <div className={styles.stat}>
              <dt>{t.about.stat3Label}</dt>
              <dd className={`${styles.statSmall} ${isPlaceholder(siteConfig.location) ? styles.placeholderValue : ''}`}>
                {siteConfig.location}
              </dd>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
