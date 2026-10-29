import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

const PALETTE = {
  black: '#111111',
  yellow: '#EFFF00',
  purple: '#8B5CF6',
  graphite: '#242424',
};

/**
 * Lightweight PROCEDURAL placeholder avatar built from primitive geometry.
 * This is intentionally not a rigged character — see
 * docs/3d-avatar-roadmap.md for how to swap this group for a real
 * animated .glb model (e.g. loaded via @react-three/drei's useGLTF)
 * without changing the rest of the Hero/Canvas setup.
 */
export default function Avatar3D({ reducedMotion = false, lowDetail = false }) {
  const groupRef = useRef(null);
  const ringRef = useRef(null);
  const headDetail = lowDetail ? 0 : 1;
  const particleCount = lowDetail ? 10 : 24;

  const particles = useMemo(() => {
    return Array.from({ length: particleCount }, (_, i) => {
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = 1.6 + Math.random() * 0.6;
      return {
        position: [
          Math.cos(angle) * radius,
          (Math.random() - 0.5) * 1.8,
          Math.sin(angle) * radius,
        ],
        scale: 0.02 + Math.random() * 0.03,
      };
    });
  }, [particleCount]);

  useFrame((_, delta) => {
    if (reducedMotion) return;
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.35;
    }
    if (ringRef.current) {
      ringRef.current.rotation.x += delta * 0.2;
      ringRef.current.rotation.z += delta * 0.15;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Head */}
      <mesh position={[0, 0.65, 0]} castShadow>
        <icosahedronGeometry args={[0.75, headDetail]} />
        <meshStandardMaterial
          color={PALETTE.graphite}
          emissive={PALETTE.purple}
          emissiveIntensity={0.35}
          roughness={0.35}
          metalness={0.4}
          flatShading
        />
      </mesh>

      {/* Body */}
      <mesh position={[0, -0.65, 0]}>
        <coneGeometry args={[0.85, 1.5, 6]} />
        <meshStandardMaterial
          color={PALETTE.black}
          emissive={PALETTE.yellow}
          emissiveIntensity={0.08}
          roughness={0.5}
          metalness={0.3}
          flatShading
        />
      </mesh>

      {/* Orbiting accent ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[1.5, 0.015, 8, 64]} />
        <meshStandardMaterial
          color={PALETTE.yellow}
          emissive={PALETTE.yellow}
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </mesh>

      {/* Floating particles */}
      {particles.map((p, i) => (
        <mesh key={i} position={p.position}>
          <sphereGeometry args={[p.scale, 6, 6]} />
          <meshStandardMaterial
            color={PALETTE.purple}
            emissive={PALETTE.purple}
            emissiveIntensity={1}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
