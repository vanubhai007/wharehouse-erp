import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import Avatar3D from './Avatar3D.jsx';
import useMediaQuery from '../../hooks/useMediaQuery.js';

export default function AvatarScene({ reducedMotion = false }) {
  const isMobile = useMediaQuery('(max-width: 640px)');

  return (
    <Canvas
      dpr={isMobile ? [1, 1.25] : [1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      camera={{ position: [0, 0, 5], fov: 45 }}
      style={{ width: '100%', height: '100%' }}
      frameloop={reducedMotion ? 'demand' : 'always'}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 3, 4]} intensity={1.1} color="#EFFF00" />
      <pointLight position={[-3, -2, -3]} intensity={0.8} color="#8B5CF6" />

      <Suspense fallback={null}>
        <Avatar3D reducedMotion={reducedMotion} lowDetail={isMobile} />
      </Suspense>
    </Canvas>
  );
}
