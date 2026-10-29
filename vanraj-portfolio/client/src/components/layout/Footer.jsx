import { useLanguage } from '../../context/LanguageContext.jsx';
import styles from './Footer.module.css';

export default function Footer() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className="container">
        <p>
          Vanraj<span className={styles.dot}>.dev</span> &mdash; {t.footer.madeWith}
        </p>
        <p className={styles.rights}>
          &copy; {year} Vanraj.dev. {t.footer.rights}
        </p>
      </div>
    </footer>
  );
}
