import { lazy, Suspense } from 'react';
import useWebGLSupport from '../../hooks/useWebGLSupport.js';
import useReducedMotion from '../../hooks/useReducedMotion.js';
import CanvasErrorBoundary from '../common/CanvasErrorBoundary.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import styles from './HeroAvatar.module.css';

const AvatarScene = lazy(() => import('./AvatarScene.jsx'));

function FallbackAvatar() {
  const { t } = useLanguage();
  return (
    <div className={styles.fallback} role="img" aria-label="Vanraj avatar illustration">
      <div className={styles.glowRing} aria-hidden="true" />
      <div className={styles.core} aria-hidden="true" />
      <p className={styles.fallbackNote}>{t.webgl.unavailable}</p>
    </div>
  );
}

export default function HeroAvatar() {
  const webglSupported = useWebGLSupport();
  const reducedMotion = useReducedMotion();

  if (webglSupported === null) {
    return <div className={styles.wrapper} aria-hidden="true" />;
  }

  if (webglSupported === false) {
    return (
      <div className={styles.wrapper}>
        <FallbackAvatar />
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <CanvasErrorBoundary fallback={<FallbackAvatar />}>
        <Suspense fallback={<div className={styles.loadingPulse} aria-hidden="true" />}>
          <AvatarScene reducedMotion={reducedMotion} />
        </Suspense>
      </CanvasErrorBoundary>
    </div>
  );
}
