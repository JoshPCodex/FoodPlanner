import { useEffect, useMemo } from 'react';
import { Billboard, Html, RoundedBox } from '@react-three/drei';
import type { GroupProps, ThreeEvent } from '@react-three/fiber';
import type { Object3D } from 'three';
import { useGltfAsset } from '../loaders/useGltfAsset';
import type { AssetRenderMode } from './RealisticFridge';

interface RealisticPantryProps extends Omit<GroupProps, 'position'> {
  angle: number;
  hovered: boolean;
  showWireframe?: boolean;
  onHandleEnter: () => void;
  onHandleLeave: () => void;
  onHandleDown: (event: ThreeEvent<PointerEvent>) => void;
  onAssetModeChange?: (mode: AssetRenderMode) => void;
}

function PantryFallback({
  angle,
  hovered,
  showWireframe,
  onHandleEnter,
  onHandleLeave,
  onHandleDown
}: Omit<RealisticPantryProps, 'position' | 'onAssetModeChange'>) {
  const wireframe = showWireframe ? { wireframe: true, transparent: true, opacity: 0.24 } : null;

  return (
    <>
      <RoundedBox args={[2.42, 4.92, 1.86]} radius={0.12} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color="#8c6548" roughness={0.84} />
      </RoundedBox>
      {wireframe ? (
        <RoundedBox args={[2.42, 4.92, 1.86]} radius={0.12} smoothness={4}>
          <meshBasicMaterial color="#111827" {...wireframe} />
        </RoundedBox>
      ) : null}
      <RoundedBox args={[2.08, 4.28, 1.34]} radius={0.04} smoothness={3} position={[0, 0.08, 0.18]} receiveShadow>
        <meshStandardMaterial color="#694a34" roughness={0.92} />
      </RoundedBox>
      <RoundedBox args={[1.88, 4.1, 1.12]} radius={0.02} smoothness={2} position={[0, 0.08, 0.24]} receiveShadow>
        <meshStandardMaterial color="#b9875f" roughness={0.72} />
      </RoundedBox>
      <RoundedBox args={[0.11, 4.16, 1.14]} radius={0.02} smoothness={2} position={[-0.94, 0.08, 0.24]} receiveShadow>
        <meshStandardMaterial color="#5d402d" roughness={0.9} />
      </RoundedBox>
      <RoundedBox args={[0.11, 4.16, 1.14]} radius={0.02} smoothness={2} position={[0.94, 0.08, 0.24]} receiveShadow>
        <meshStandardMaterial color="#5d402d" roughness={0.9} />
      </RoundedBox>
      <RoundedBox args={[1.9, 0.1, 1.14]} radius={0.02} smoothness={2} position={[0, 2.1, 0.24]} receiveShadow>
        <meshStandardMaterial color="#5d402d" roughness={0.9} />
      </RoundedBox>
      <RoundedBox args={[1.9, 0.1, 1.14]} radius={0.02} smoothness={2} position={[0, -1.94, 0.24]} receiveShadow>
        <meshStandardMaterial color="#5d402d" roughness={0.9} />
      </RoundedBox>
      <RoundedBox args={[1.9, 4.18, 0.08]} radius={0.02} smoothness={2} position={[0, 0.08, -0.24]} receiveShadow>
        <meshStandardMaterial color="#5d402d" roughness={0.88} />
      </RoundedBox>
      <mesh position={[0, 0.08, 0.34]} receiveShadow>
        <planeGeometry args={[1.8, 4.0]} />
        <meshStandardMaterial color="#ba8a62" roughness={0.74} />
      </mesh>
      <mesh position={[0, 0.08, -0.18]} receiveShadow>
        <planeGeometry args={[1.86, 4.08]} />
        <meshStandardMaterial color="#4b3427" roughness={0.96} transparent opacity={0.16} />
      </mesh>
      {wireframe ? (
        <RoundedBox args={[2.08, 4.28, 1.34]} radius={0.04} smoothness={3} position={[0, 0.08, 0.18]}>
          <meshBasicMaterial color="#111827" {...wireframe} />
        </RoundedBox>
      ) : null}

      {[1.62, 0.9, 0.18, -0.54].map((y) => (
        <group key={y}>
          <RoundedBox args={[1.72, 0.08, 0.94]} radius={0.02} smoothness={2} position={[0, y, 0.24]} receiveShadow>
            <meshStandardMaterial color="#cb9a71" roughness={0.68} />
          </RoundedBox>
          <RoundedBox args={[1.72, 0.03, 0.06]} radius={0.01} smoothness={2} position={[0, y + 0.03, 0.66]} receiveShadow>
            <meshStandardMaterial color="#7c563c" roughness={0.9} />
          </RoundedBox>
          <mesh position={[0, y - 0.01, 0.24]} receiveShadow>
            <planeGeometry args={[1.68, 0.88]} />
            <meshStandardMaterial color="#000000" transparent opacity={0.02} />
          </mesh>
          {wireframe ? (
            <RoundedBox args={[1.72, 0.08, 0.94]} radius={0.02} smoothness={2} position={[0, y, 0.24]}>
              <meshBasicMaterial color="#111827" {...wireframe} />
            </RoundedBox>
          ) : null}
        </group>
      ))}

      <RoundedBox args={[1.88, 0.16, 0.2]} radius={0.03} smoothness={3} position={[0, -1.72, 0.84]} receiveShadow>
        <meshStandardMaterial color="#54392a" roughness={0.92} />
      </RoundedBox>
      <mesh position={[0.02, 0.08, 0.18]} receiveShadow>
        <boxGeometry args={[1.82, 4.02, 1.04]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.03} />
      </mesh>

      <group position={[-1.15, 0.04, 0.96]} rotation={[0, -angle, 0]}>
        <RoundedBox args={[0.08, 4.42, 0.12]} radius={0.03} smoothness={3} position={[0, 0, -0.06]} receiveShadow>
          <meshStandardMaterial color="#5a3b28" roughness={0.64} />
        </RoundedBox>
        <RoundedBox args={[2.22, 4.46, 0.22]} radius={0.09} smoothness={4} position={[1.11, 0, -0.1]} castShadow receiveShadow>
          <meshStandardMaterial color="#c99769" roughness={0.5} />
        </RoundedBox>
        <RoundedBox args={[1.98, 4.16, 0.08]} radius={0.04} smoothness={3} position={[1.03, 0, 0.03]} receiveShadow>
          <meshStandardMaterial color="#6b4b34" roughness={0.9} transparent opacity={0.18} />
        </RoundedBox>
        <RoundedBox args={[1.98, 4.16, 0.02]} radius={0.015} smoothness={2} position={[1.03, 0, -0.005]} receiveShadow>
          <meshStandardMaterial color="#74553c" roughness={0.94} transparent opacity={0.14} />
        </RoundedBox>
        {wireframe ? (
          <RoundedBox args={[2.22, 4.46, 0.22]} radius={0.09} smoothness={4} position={[1.11, 0, -0.1]}>
            <meshBasicMaterial color="#111827" {...wireframe} />
          </RoundedBox>
        ) : null}
        <mesh
          position={[2.02, 0.1, 0.02]}
          onPointerEnter={(event) => {
            event.stopPropagation();
            onHandleEnter();
          }}
          onPointerLeave={(event) => {
            event.stopPropagation();
            onHandleLeave();
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
            onHandleDown(event);
          }}
        >
          <torusGeometry args={[0.18, 0.03, 10, 22, Math.PI]} />
          <meshStandardMaterial color="#4d2f1e" roughness={0.28} metalness={0.24} />
        </mesh>
        {[-0.98, -0.88].map((x, index) => (
          <mesh key={`${x}-${index}`} position={[x, 1.58 - index * 2.0, 0.88]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 0.14, 12]} />
            <meshStandardMaterial color="#5a3b28" roughness={0.52} metalness={0.08} />
          </mesh>
        ))}
        {hovered ? (
          <Billboard position={[1.38, 1.76, 0.18]}>
            <Html center>
              <div className="rounded-full border border-white/70 bg-white/92 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow">
                Open / Close
              </div>
            </Html>
          </Billboard>
        ) : null}
      </group>
    </>
  );
}

export function RealisticPantry({
  angle,
  hovered,
  showWireframe,
  onHandleEnter,
  onHandleLeave,
  onHandleDown,
  onAssetModeChange,
  ...props
}: RealisticPantryProps) {
  const { scene } = useGltfAsset(['/visualize/models/pantry.glb', '/visualize/models/demo/pantry.glb']);
  const clonedScene = useMemo(() => (scene ? (scene.clone(true) as Object3D) : null), [scene]);
  const mode: AssetRenderMode = clonedScene ? 'gltf' : 'fallback';

  useEffect(() => {
    onAssetModeChange?.(mode);
  }, [mode, onAssetModeChange]);

  return (
    <group position={[2.25, 1.8, -0.55]} {...props}>
      {clonedScene ? <primitive object={clonedScene} scale={1.12} position={[0, -2.35, 0]} /> : null}
      {!clonedScene ? (
        <PantryFallback
          angle={angle}
          hovered={hovered}
          showWireframe={showWireframe}
          onHandleEnter={onHandleEnter}
          onHandleLeave={onHandleLeave}
          onHandleDown={onHandleDown}
        />
      ) : null}
    </group>
  );
}
