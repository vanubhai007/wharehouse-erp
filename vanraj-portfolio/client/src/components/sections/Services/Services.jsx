import { useLanguage } from '../../../context/LanguageContext.jsx';
import { services } from '../../../data/services.js';
import Reveal from '../../common/Reveal.jsx';
import SectionHeading from '../../common/SectionHeading.jsx';
import styles from './Services.module.css';

export default function Services() {
  const { t } = useLanguage();

  return (
    <section id="services" className="section" aria-labelledby="services-heading">
      <div className="container">
        <h2 id="services-heading" className="visually-hidden">
          {t.services.title}
        </h2>
        <SectionHeading eyebrow={t.services.eyebrow} title={t.services.title} />

        <div className={styles.grid}>
          {services.map((service, i) => (
            <Reveal key={service.id} delay={i * 0.08} className={styles.card}>
              <h3 className={styles.title}>{service.title}</h3>
              <p className={styles.desc}>{service.description}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
