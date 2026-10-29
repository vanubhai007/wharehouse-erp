import { useLanguage } from '../../../context/LanguageContext.jsx';
import { experience } from '../../../data/experience.js';
import Reveal from '../../common/Reveal.jsx';
import SectionHeading from '../../common/SectionHeading.jsx';
import styles from './Experience.module.css';

export default function Experience() {
  const { t } = useLanguage();

  return (
    <section id="experience" className="section" aria-labelledby="experience-heading" style={{ background: 'var(--color-graphite)' }}>
      <div className="container">
        <h2 id="experience-heading" className="visually-hidden">
          {t.experience.title}
        </h2>
        <SectionHeading eyebrow={t.experience.eyebrow} title={t.experience.title} />

        <ol className={styles.timeline} role="list">
          {experience.map((item, i) => (
            <Reveal as="li" key={item.id} delay={i * 0.1} className={styles.item}>
              <div className={styles.dot} aria-hidden="true" />
              <div className={styles.content}>
                <p className={styles.period}>{item.period}</p>
                <h3 className={styles.role}>{item.role}</h3>
                <p className={styles.org}>{item.organization}</p>
                <p className={styles.desc}>{item.description}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
