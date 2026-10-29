import { useLanguage } from '../../context/LanguageContext.jsx';
import styles from './LoadingScreen.module.css';

export default function LoadingScreen({ visible }) {
  const { t } = useLanguage();

  return (
    <div
      className={`${styles.screen} ${visible ? '' : styles.hidden}`}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
    >
      <div className={styles.mark} aria-hidden="true">
        <span>V</span>
      </div>
      <p className={styles.label}>{t.loading.label}</p>
    </div>
  );
}
