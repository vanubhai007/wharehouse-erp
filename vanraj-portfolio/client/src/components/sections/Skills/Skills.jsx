import { useLanguage } from '../../../context/LanguageContext.jsx';
import { skillGroups } from '../../../data/skills.js';
import Reveal from '../../common/Reveal.jsx';
import SectionHeading from '../../common/SectionHeading.jsx';
import styles from './Skills.module.css';

export default function Skills() {
  const { t } = useLanguage();

  return (
    <section id="skills" className="section" aria-labelledby="skills-heading" style={{ background: 'var(--color-graphite)' }}>
      <div className="container">
        <h2 id="skills-heading" className="visually-hidden">
          {t.skills.title}
        </h2>
        <SectionHeading eyebrow={t.skills.eyebrow} title={t.skills.title} />

        <div className={styles.grid}>
          {skillGroups.map((group, i) => (
            <Reveal key={group.key} delay={i * 0.08} className={styles.card}>
              <h3 className={styles.cardTitle}>{t.skills.categories[group.key]}</h3>
              <ul role="list" className={styles.list}>
                {group.items.map((item) => (
                  <li key={item} className={styles.chip}>
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
