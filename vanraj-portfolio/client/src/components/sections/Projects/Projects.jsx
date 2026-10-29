import { useLanguage } from '../../../context/LanguageContext.jsx';
import { projects } from '../../../data/projects.js';
import Reveal from '../../common/Reveal.jsx';
import SectionHeading from '../../common/SectionHeading.jsx';
import styles from './Projects.module.css';

function ProjectCard({ project, index, t }) {
  return (
    <Reveal as="article" delay={index * 0.08} className={styles.card}>
      <div className={styles.thumb} aria-hidden="true">
        <span>{project.title.charAt(0)}</span>
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>{project.title}</h3>
        <p className={styles.description}>{project.description}</p>

        <ul className={styles.tech} role="list" aria-label={`Technologies used in ${project.title}`}>
          {project.tech.map((tech) => (
            <li key={tech}>{tech}</li>
          ))}
        </ul>

        <div className={styles.links}>
          {project.githubUrl ? (
            <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
              {t.projects.sourceCode}
            </a>
          ) : (
            <span className={styles.pending} aria-disabled="true">
              {t.projects.sourceCode}: {t.projects.linkPending}
            </span>
          )}

          {project.liveUrl ? (
            <a href={project.liveUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              {t.projects.liveDemo}
            </a>
          ) : (
            <span className={styles.pending} aria-disabled="true">
              {t.projects.liveDemo}: {t.projects.linkPending}
            </span>
          )}
        </div>
      </div>
    </Reveal>
  );
}

export default function Projects() {
  const { t } = useLanguage();

  return (
    <section id="projects" className="section" aria-labelledby="projects-heading">
      <div className="container">
        <h2 id="projects-heading" className="visually-hidden">
          {t.projects.title}
        </h2>
        <SectionHeading eyebrow={t.projects.eyebrow} title={t.projects.title} subtitle={t.projects.subtitle} />

        <div className={styles.grid}>
          {projects.map((project, i) => (
            <ProjectCard key={project.id} project={project} index={i} t={t} />
          ))}
        </div>
      </div>
    </section>
  );
}
