import { useEffect, useState } from 'react';

function detectWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    return Boolean(gl);
  } catch {
    return false;
  }
}

/**
 * Returns `null` while detection is pending (avoids a flash of the wrong
 * fallback during SSR/hydration-less first paint), then `true`/`false`.
 */
export default function useWebGLSupport() {
  const [supported, setSupported] = useState(null);

  useEffect(() => {
    setSupported(detectWebGL());
  }, []);

  return supported;
}
