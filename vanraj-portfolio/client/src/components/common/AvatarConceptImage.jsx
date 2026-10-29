import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx';
import styles from './AvatarConceptImage.module.css';

/**
 * Optional small "concept art" thumbnail sourced from
 * client/public/images/avatar-concept.png.
 *
 * This image is NOT shipped with the repo (it's the user's personal
 * artwork). If it's missing, this renders a dashed placeholder instead
 * of failing or faking an image — see docs/3d-avatar-roadmap.md.
 */
export default function AvatarConceptImage() {
  const { t } = useLanguage();
  const [status, setStatus] = useState('loading');

  if (status === 'error') {
    return (
      <div className={styles.placeholder} role="img" aria-label="Avatar concept image not added yet">
        <span>Add client/public/images/avatar-concept.png</span>
      </div>
    );
  }

  return (
    <img
      src="/images/avatar-concept.png"
      alt={t.hero.avatarAlt}
      className={`${styles.image} ${status === 'loaded' ? styles.loaded : styles.hiddenWhileLoading}`}
      onLoad={() => setStatus('loaded')}
      onError={() => setStatus('error')}
      loading="lazy"
    />
  );
}
