import { useEffect, useMemo } from 'react';
import { Billboard, Html, RoundedBox } from '@react-three/drei';
import type { GroupProps, ThreeEvent } from '@react-three/fiber';
import type { Object3D } from 'three';
import { useGltfAsset } from '../loaders/useGltfAsset';

export type AssetRenderMode = 'gltf' | 'fallback';

interface RealisticFridgeProps extends Omit<GroupProps, 'position'> {
  angle: number;
  hovered: boolean;
  showWireframe?: boolean;
  onHandleEnter: () => void;
  onHandleLeave: () => void;
  onHandleDown: (event: ThreeEvent<PointerEvent>) => void;
  onAssetModeChange?: (mode: AssetRenderMode) => void;
}

function FridgeFallback({
  angle,
  hovered,
  showWireframe,
  onHandleEnter,
  onHandleLeave,
  onHandleDown
}: Omit<RealisticFridgeProps, 'position' | 'onAssetModeChange'>) {
  const wireframe = showWireframe ? { wireframe: true, transparent: true, opacity: 0.28 } : null;

  return (
    <>
      <RoundedBox args={[2.34, 4.78, 1.96]} radius={0.19} smoothness={5} castShadow receiveShadow>
        <meshStandardMaterial color="#d7dde2" roughness={0.42} metalness={0.16} />
      </RoundedBox>
      {wireframe ? (
        <RoundedBox args={[2.34, 4.78, 1.96]} radius={0.19} smoothness={5}>
          <meshBasicMaterial color="#111827" {...wireframe} />
        </RoundedBox>
      ) : null}

      <RoundedBox args={[2.04, 4.3, 1.54]} radius={0.08} smoothness={4} position={[0, 0.02, 0.18]} receiveShadow>
        <meshStandardMaterial color="#aeb9c1" roughness={0.55} metalness={0.08} />
      </RoundedBox>
      {wireframe ? (
        <RoundedBox args={[2.04, 4.3, 1.54]} radius={0.08} smoothness={4} position={[0, 0.02, 0.18]}>
          <meshBasicMaterial color="#1f2937" {...wireframe} />
        </RoundedBox>
      ) : null}

      <RoundedBox args={[1.8, 4.0, 1.16]} radius={0.04} smoothness={3} position={[0, 0.03, 0.28]} receiveShadow>
        <meshStandardMaterial color="#e8ece7" roughness={0.34} metalness={0.02} />
      </RoundedBox>
      {wireframe ? (
        <RoundedBox args={[1.8, 4.0, 1.16]} radius={0.04} smoothness={3} position={[0, 0.03, 0.28]}>
          <meshBasicMaterial color="#111827" {...wireframe} />
        </RoundedBox>
      ) : null}

      <RoundedBox args={[0.12, 4.06, 1.18]} radius={0.03} smoothness={3} position={[-0.9, 0.02, 0.28]} receiveShadow>
        <meshStandardMaterial color="#d4ddd9" roughness={0.38} metalness={0.02} />
      </RoundedBox>
      <RoundedBox args={[0.12, 4.06, 1.18]} radius={0.03} smoothness={3} position={[0.9, 0.02, 0.28]} receiveShadow>
        <meshStandardMaterial color="#d4ddd9" roughness={0.38} metalness={0.02} />
      </RoundedBox>
      <RoundedBox args={[1.84, 0.12, 1.18]} radius={0.03} smoothness={3} position={[0, 2.0, 0.28]} receiveShadow>
        <meshStandardMaterial color="#d4ddd9" roughness={0.38} metalness={0.02} />
      </RoundedBox>
      <RoundedBox args={[1.84, 0.12, 1.18]} radius={0.03} smoothness={3} position={[0, -1.98, 0.28]} receiveShadow>
        <meshStandardMaterial color="#c0ccd1" roughness={0.5} metalness={0.04} />
      </RoundedBox>
      <RoundedBox args={[1.84, 0.14, 0.18]} radius={0.03} smoothness={3} position={[0, -1.98, 0.78]} receiveShadow>
        <meshStandardMaterial color="#8ea2af" roughness={0.36} metalness={0.24} />
      </RoundedBox>
      <RoundedBox args={[1.84, 4.08, 0.1]} radius={0.03} smoothness={3} position={[0, 0.02, -0.2]} receiveShadow>
        <meshStandardMaterial color="#d0d9dd" roughness={0.44} metalness={0.03} />
      </RoundedBox>
      <mesh position={[0, 0.02, 0.38]} receiveShadow>
        <planeGeometry args={[1.74, 3.86]} />
        <meshStandardMaterial color="#f2f4ef" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.02, -0.14]} receiveShadow>
        <planeGeometry args={[1.74, 3.86]} />
        <meshStandardMaterial color="#b0bac0" roughness={0.9} transparent opacity={0.2} />
      </mesh>
      {wireframe ? (
        <>
          <mesh position={[0, 0.02, 0.38]}>
            <planeGeometry args={[1.74, 3.86]} />
            <meshBasicMaterial color="#111827" {...wireframe} />
          </mesh>
          <mesh position={[0, 0.02, -0.2]}>
            <planeGeometry args={[1.84, 4.08]} />
            <meshBasicMaterial color="#111827" {...wireframe} />
          </mesh>
        </>
      ) : null}

      {[1.28, 0.52, -0.22].map((y) => (
        <group key={y}>
          <RoundedBox args={[1.62, 0.05, 1]} radius={0.015} smoothness={3} position={[0, y, 0.3]} receiveShadow>
            <meshStandardMaterial color="#edf6fb" roughness={0.08} metalness={0.02} transparent opacity={0.52} />
          </RoundedBox>
          <RoundedBox args={[1.62, 0.02, 0.08]} radius={0.01} smoothness={2} position={[0, y + 0.015, 0.77]} receiveShadow>
            <meshStandardMaterial color="#9cb0ba" roughness={0.24} metalness={0.14} />
          </RoundedBox>
          {wireframe ? (
            <RoundedBox args={[1.62, 0.05, 1]} radius={0.015} smoothness={3} position={[0, y, 0.3]}>
              <meshBasicMaterial color="#0f172a" {...wireframe} />
            </RoundedBox>
          ) : null}
        </group>
      ))}

      <RoundedBox args={[1.58, 0.42, 0.96]} radius={0.04} smoothness={3} position={[0, -1.12, 0.28]} receiveShadow>
        <meshStandardMaterial color="#c8d4da" roughness={0.56} metalness={0.04} />
      </RoundedBox>
      <RoundedBox args={[1.58, 0.14, 0.12]} radius={0.03} smoothness={3} position={[0, -0.9, 0.78]} receiveShadow>
        <meshStandardMaterial color="#97a9b3" roughness={0.42} metalness={0.18} />
      </RoundedBox>
      {wireframe ? (
        <RoundedBox args={[1.58, 0.42, 0.96]} radius={0.04} smoothness={3} position={[0, -1.12, 0.28]}>
          <meshBasicMaterial color="#111827" {...wireframe} />
        </RoundedBox>
      ) : null}

      {[-0.99, -0.92].map((x, index) => (
        <mesh key={`${x}-${index}`} position={[x, 1.58 - index * 1.92, 0.92]} castShadow>
          <cylinderGeometry args={[0.032, 0.032, 0.16, 14]} />
          <meshStandardMaterial color="#8799a5" roughness={0.26} metalness={0.54} />
        </mesh>
      ))}
      <mesh position={[-1.15, -2.38, 0.02]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1.6, 0.62]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.08} />
      </mesh>
      <mesh position={[0.05, 0.08, 0.1]} receiveShadow>
        <boxGeometry args={[1.64, 3.9, 1.2]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.035} />
      </mesh>

      <group position={[-1.12, 0.18, 0.98]} rotation={[0, -angle, 0]}>
        <RoundedBox args={[0.08, 4.22, 0.12]} radius={0.025} smoothness={3} position={[0, 0, -0.08]} receiveShadow>
          <meshStandardMaterial color="#7b8f9b" roughness={0.36} metalness={0.38} />
        </RoundedBox>
        <RoundedBox args={[2.18, 4.3, 0.24]} radius={0.11} smoothness={5} position={[1.09, 0, -0.12]} castShadow receiveShadow>
          <meshStandardMaterial color="#f5f8fa" roughness={0.24} metalness={0.06} />
        </RoundedBox>
        <RoundedBox args={[1.98, 4.08, 0.08]} radius={0.05} smoothness={3} position={[1.04, 0, 0.03]} receiveShadow>
          <meshStandardMaterial color="#68737b" roughness={0.86} metalness={0.04} transparent opacity={0.2} />
        </RoundedBox>
        <RoundedBox args={[1.76, 0.2, 0.18]} radius={0.035} smoothness={3} position={[1.1, 1.36, -0.08]} receiveShadow>
          <meshStandardMaterial color="#dfe7eb" roughness={0.48} />
        </RoundedBox>
        <RoundedBox args={[1.76, 0.2, 0.18]} radius={0.035} smoothness={3} position={[1.1, 0.48, -0.08]} receiveShadow>
          <meshStandardMaterial color="#dfe7eb" roughness={0.48} />
        </RoundedBox>
        <RoundedBox args={[1.82, 4.0, 0.03]} radius={0.02} smoothness={2} position={[1.06, 0, 0.08]} receiveShadow>
          <meshStandardMaterial color="#3f4a52" roughness={0.94} metalness={0.02} />
        </RoundedBox>
        <RoundedBox args={[1.94, 4.14, 0.025]} radius={0.015} smoothness={2} position={[1.06, 0, -0.005]} receiveShadow>
          <meshStandardMaterial color="#6a737b" roughness={0.96} metalness={0.01} transparent opacity={0.16} />
        </RoundedBox>
        <RoundedBox args={[1.68, 0.16, 0.14]} radius={0.03} smoothness={3} position={[1.08, -0.48, -0.08]} receiveShadow>
          <meshStandardMaterial color="#d4dde2" roughness={0.5} />
        </RoundedBox>
        {wireframe ? (
          <RoundedBox args={[2.18, 4.3, 0.24]} radius={0.11} smoothness={5} position={[1.09, 0, -0.12]}>
            <meshBasicMaterial color="#111827" {...wireframe} />
          </RoundedBox>
        ) : null}
        <mesh
          position={[2.0, 0.22, 0]}
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
          <torusGeometry args={[0.2, 0.03, 10, 24, Math.PI]} />
          <meshStandardMaterial color="#748896" roughness={0.2} metalness={0.64} />
        </mesh>
        {hovered ? (
          <Billboard position={[1.28, 1.8, 0.18]}>
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

export function RealisticFridge({
  angle,
  hovered,
  showWireframe,
  onHandleEnter,
  onHandleLeave,
  onHandleDown,
  onAssetModeChange,
  ...props
}: RealisticFridgeProps) {
  const { scene } = useGltfAsset(['/visualize/models/fridge.glb', '/visualize/models/demo/fridge.glb']);
  const clonedScene = useMemo(() => (scene ? (scene.clone(true) as Object3D) : null), [scene]);
  const mode: AssetRenderMode = clonedScene ? 'gltf' : 'fallback';

  useEffect(() => {
    onAssetModeChange?.(mode);
  }, [mode, onAssetModeChange]);

  return (
    <group position={[-2.1, 1.65, -0.45]} {...props}>
      {clonedScene ? <primitive object={clonedScene} scale={1.1} position={[0, -2.2, 0]} /> : null}
      {!clonedScene ? (
        <FridgeFallback
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
