import { useEffect, useMemo, useRef, useState } from 'react';
import { Billboard, ContactShadows, Environment, Html, Lightformer, MeshReflectorMaterial, RoundedBox } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { ACESFilmicToneMapping, BackSide, CanvasTexture, PCFSoftShadowMap, SRGBColorSpace } from 'three';
import { usePlannerStore } from '../store/usePlannerStore';
import { ASSET_COMPONENTS } from '../visualize/assets';
import { RealisticFridge } from '../visualize/scene/RealisticFridge';
import { RealisticPantry } from '../visualize/scene/RealisticPantry';
import {
  buildCategoryTotals,
  buildZones,
  findNearestSlot,
  getMaxDoorAngle,
  mapInventoryToVisuals,
  reconcileLayout,
  type VisualLayoutMap,
  type ZoneDefinition,
  type ZoneId
} from '../visualize/inventoryMapping';

interface VisualizePageProps {
  onBack: () => void;
}

interface DoorHandlePayload {
  kind: 'fridge' | 'pantry';
  clientX: number;
}

interface ItemDragState {
  id: string;
  startX: number;
  startY: number;
  startPosition: [number, number, number];
  depthNdc: number;
}

interface PendingStackPress {
  id: string;
  startX: number;
  startY: number;
  startPosition: [number, number, number];
  depthNdc: number;
}

interface StackView {
  id: string;
  name: string;
  count: number;
  displayCount: number;
  zoneId: ZoneId;
  slotIndex: number;
  assetId: keyof typeof ASSET_COMPONENTS;
  assetScale: number;
  assetRotationY: number;
  category: string;
  position: [number, number, number];
}

const LAYOUT_STORAGE_KEY = 'meal-bubble-visualize-layout-v2';
const AUTO_FOCUS_STORAGE_KEY = 'meal-bubble-visualize-auto-focus-v1';
const DEFAULT_CAMERA = {
  position: new THREE.Vector3(0.9, 3.35, 8.5),
  target: new THREE.Vector3(0, 1.5, 0.2)
};
const DOOR_MAX_ANGLE = getMaxDoorAngle();
const CLICK_THRESHOLD_PX = 6;

function formatCount(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function clampAngle(value: number): number {
  return Math.max(0, Math.min(DOOR_MAX_ANGLE, value));
}

function loadSavedLayout(): VisualLayoutMap {
  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as VisualLayoutMap;
  } catch {
    return {};
  }
}

function loadAutoFocusEnabled(): boolean {
  try {
    return window.localStorage.getItem(AUTO_FOCUS_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function DoorAnimator({ selectedZone }: { selectedZone: ZoneDefinition | null }) {
  const { camera } = useThree();
  const lookTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }, delta) => {
    const idleX = Math.sin(clock.elapsedTime * 0.18) * 0.08;
    const idleY = Math.sin(clock.elapsedTime * 0.24) * 0.05;
    const zonePosition = selectedZone ? new THREE.Vector3(...selectedZone.focusPosition) : DEFAULT_CAMERA.position;
    const zoneTarget = selectedZone ? new THREE.Vector3(...selectedZone.focusTarget) : DEFAULT_CAMERA.target;
    const desiredPosition = zonePosition.clone().add(new THREE.Vector3(idleX, idleY, 0));
    const desiredTarget = zoneTarget.clone().add(new THREE.Vector3(idleX * 0.18, idleY * 0.12, 0));

    camera.position.lerp(desiredPosition, 1 - Math.exp(-delta * 1.5));
    lookTarget.lerp(desiredTarget, 1 - Math.exp(-delta * 1.9));
    camera.lookAt(lookTarget);
  });

  return null;
}

function CounterFloor() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) return null;

    context.fillStyle = '#d6d0c4';
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        context.fillStyle = (x + y) % 2 === 0 ? '#ddd7cb' : '#cfc8bb';
        context.fillRect(x * 64, y * 64, 62, 62);
      }
    }

    const next = new CanvasTexture(canvas);
    next.wrapS = THREE.RepeatWrapping;
    next.wrapT = THREE.RepeatWrapping;
    next.repeat.set(4, 4);
    next.colorSpace = SRGBColorSpace;
    return next;
  }, []);

  useEffect(() => () => texture?.dispose(), [texture]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} receiveShadow>
      <planeGeometry args={[18, 18]} />
      <MeshReflectorMaterial
        map={texture ?? undefined}
        color="#d6d0c4"
        roughness={0.9}
        metalness={0.02}
        blur={[200, 60]}
        mixBlur={0.6}
        mixStrength={0.16}
        resolution={512}
        mirror={0.05}
      />
    </mesh>
  );
}

function RoomShell() {
  return (
    <>
      <mesh position={[0, 2.7, -2.7]} receiveShadow>
        <planeGeometry args={[16, 8]} />
        <meshStandardMaterial color="#e5e2db" roughness={0.95} />
      </mesh>
      <mesh position={[0, 4.85, -2.45]}>
        <planeGeometry args={[16, 3.6]} />
        <meshBasicMaterial color="#edf2f6" transparent opacity={0.28} />
      </mesh>
      <mesh position={[0, 1.35, -2.69]}>
        <planeGeometry args={[16, 1.8]} />
        <meshStandardMaterial color="#cbc7bf" roughness={0.98} />
      </mesh>
      <CounterFloor />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <ringGeometry args={[1.2, 7.5, 64]} />
        <meshStandardMaterial color="#c8c1b4" roughness={1} transparent opacity={0.22} />
      </mesh>
      <mesh position={[0, 0.7, -2.68]} receiveShadow>
        <planeGeometry args={[16, 0.25]} />
        <meshStandardMaterial color="#9ca3af" roughness={0.45} metalness={0.35} />
      </mesh>
    </>
  );
}

function Fridge({
  angle,
  hovered,
  onHandleEnter,
  onHandleLeave,
  onHandleDown
}: {
  angle: number;
  hovered: boolean;
  onHandleEnter: () => void;
  onHandleLeave: () => void;
  onHandleDown: (payload: DoorHandlePayload) => void;
}) {
  const showHint = hovered;

  return (
    <group position={[-2.1, 1.65, -0.45]}>
      <RoundedBox args={[2.2, 4.4, 1.62]} radius={0.16} smoothness={5} castShadow receiveShadow>
        <meshStandardMaterial color="#d4dde4" roughness={0.42} metalness={0.16} />
      </RoundedBox>
      <RoundedBox args={[1.86, 3.96, 1.22]} radius={0.09} smoothness={4} position={[0, 0, 0.11]} receiveShadow>
        <meshStandardMaterial color="#b7c1c7" roughness={0.52} metalness={0.08} />
      </RoundedBox>
      <RoundedBox args={[1.84, 0.07, 1.14]} radius={0.03} smoothness={3} position={[0, 1.18, 0.16]} receiveShadow>
        <meshStandardMaterial color="#e9eef2" roughness={0.28} metalness={0.08} />
      </RoundedBox>
      <RoundedBox args={[1.84, 0.07, 1.14]} radius={0.03} smoothness={3} position={[0, 0.46, 0.16]} receiveShadow>
        <meshStandardMaterial color="#e9eef2" roughness={0.28} metalness={0.08} />
      </RoundedBox>
      <RoundedBox args={[1.76, 0.34, 1.05]} radius={0.05} smoothness={3} position={[0, -0.88, 0.16]} receiveShadow>
        <meshStandardMaterial color="#cbd6dc" roughness={0.55} metalness={0.05} />
      </RoundedBox>
      <RoundedBox args={[1.76, 0.18, 0.1]} radius={0.03} smoothness={3} position={[0, -0.7, 0.63]} receiveShadow>
        <meshStandardMaterial color="#9fb2be" roughness={0.35} metalness={0.2} />
      </RoundedBox>
      {[-0.98, -0.9].map((x, index) => (
        <mesh key={`${x}-${index}`} position={[x, 1.5 - index * 1.9, 0.77]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.14, 14]} />
          <meshStandardMaterial color="#8fa1ad" roughness={0.32} metalness={0.48} />
        </mesh>
      ))}

      <group position={[-1.07, 0.2, 0.78]} rotation={[0, -angle, 0]}>
        <RoundedBox args={[0.08, 4.1, 0.08]} radius={0.02} smoothness={3} position={[0, 0, -0.04]} receiveShadow>
          <meshStandardMaterial color="#8ca0ad" roughness={0.4} metalness={0.3} />
        </RoundedBox>
        <RoundedBox args={[2.06, 4.12, 0.14]} radius={0.12} smoothness={5} position={[1.03, 0, -0.06]} castShadow receiveShadow>
          <meshStandardMaterial color="#f3f7fa" roughness={0.24} metalness={0.08} />
        </RoundedBox>
        <RoundedBox args={[1.72, 0.22, 0.18]} radius={0.05} smoothness={4} position={[1.08, 1.34, -0.08]} receiveShadow>
          <meshStandardMaterial color="#d8e0e6" roughness={0.45} metalness={0.06} />
        </RoundedBox>
        <RoundedBox args={[1.72, 0.22, 0.18]} radius={0.05} smoothness={4} position={[1.08, 0.46, -0.08]} receiveShadow>
          <meshStandardMaterial color="#d8e0e6" roughness={0.45} metalness={0.06} />
        </RoundedBox>
        <RoundedBox args={[1.84, 3.9, 0.03]} radius={0.05} smoothness={3} position={[1.04, 0, 0.03]} receiveShadow>
          <meshStandardMaterial color="#6b7280" roughness={0.8} metalness={0.1} transparent opacity={0.18} />
        </RoundedBox>
        <mesh
          position={[1.9, 0.2, -0.01]}
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
            onHandleDown({ kind: 'fridge', clientX: event.clientX });
          }}
        >
          <capsuleGeometry args={[0.06, 0.55, 6, 12]} />
          <meshStandardMaterial color="#7f95a3" roughness={0.24} metalness={0.58} />
        </mesh>
        {showHint ? (
          <Billboard position={[1.25, 1.75, 0.18]}>
            <Html center>
              <div className="rounded-full border border-white/70 bg-white/92 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow">
                Open / Close
              </div>
            </Html>
          </Billboard>
        ) : null}
      </group>
    </group>
  );
}

function Pantry({
  angle,
  hovered,
  onHandleEnter,
  onHandleLeave,
  onHandleDown
}: {
  angle: number;
  hovered: boolean;
  onHandleEnter: () => void;
  onHandleLeave: () => void;
  onHandleDown: (payload: DoorHandlePayload) => void;
}) {
  return (
    <group position={[2.25, 1.8, -0.55]}>
      <RoundedBox args={[2.3, 4.75, 1.7]} radius={0.12} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color="#8e6646" roughness={0.82} />
      </RoundedBox>
      <RoundedBox args={[1.96, 4.12, 1.22]} radius={0.05} smoothness={3} position={[0, 0.05, 0.12]} receiveShadow>
        <meshStandardMaterial color="#6b4b34" roughness={0.9} />
      </RoundedBox>
      {[1.62, 0.9, 0.18, -0.54].map((y) => (
        <RoundedBox key={y} args={[1.9, 0.08, 1.16]} radius={0.03} smoothness={3} position={[0, y, 0.18]} receiveShadow>
          <meshStandardMaterial color="#c59c73" roughness={0.74} />
        </RoundedBox>
      ))}
      <mesh position={[0, -1.7, 0.84]} receiveShadow>
        <planeGeometry args={[2.1, 0.2]} />
        <meshStandardMaterial color="#5c4030" roughness={0.95} />
      </mesh>

      <group position={[-1.1, 0.05, 0.8]} rotation={[0, -angle, 0]}>
        <RoundedBox args={[0.08, 4.3, 0.1]} radius={0.03} smoothness={3} position={[0, 0, -0.05]} receiveShadow>
          <meshStandardMaterial color="#5c3d2a" roughness={0.62} />
        </RoundedBox>
        <RoundedBox args={[2.16, 4.34, 0.16]} radius={0.1} smoothness={4} position={[1.07, 0, -0.08]} castShadow receiveShadow>
          <meshStandardMaterial color="#c6946a" roughness={0.52} />
        </RoundedBox>
        <RoundedBox args={[1.92, 4.08, 0.03]} radius={0.04} smoothness={3} position={[1.03, 0, 0.02]} receiveShadow>
          <meshStandardMaterial color="#6b4b34" roughness={0.92} transparent opacity={0.16} />
        </RoundedBox>
        <mesh
          position={[1.96, 0.1, 0.02]}
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
            onHandleDown({ kind: 'pantry', clientX: event.clientX });
          }}
        >
          <capsuleGeometry args={[0.055, 0.48, 6, 12]} />
          <meshStandardMaterial color="#4a2c1c" roughness={0.3} metalness={0.2} />
        </mesh>
        {hovered ? (
          <Billboard position={[1.35, 1.72, 0.18]}>
            <Html center>
              <div className="rounded-full border border-white/70 bg-white/92 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow">
                Open / Close
              </div>
            </Html>
          </Billboard>
        ) : null}
      </group>
    </group>
  );
}

function Countertop() {
  return (
    <group position={[-0.05, 0.65, 1.05]}>
      <RoundedBox args={[3.35, 0.2, 1.55]} radius={0.08} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color="#b98a5d" roughness={0.44} metalness={0.04} />
      </RoundedBox>
      {[-1.25, 1.25].map((x) => (
        <RoundedBox key={x} args={[0.18, 1.45, 0.18]} radius={0.03} smoothness={3} position={[x, -0.82, -0.55]} castShadow receiveShadow>
          <meshStandardMaterial color="#7a5338" roughness={0.76} />
        </RoundedBox>
      ))}
      <mesh position={[0, 0.14, -0.62]} receiveShadow>
        <planeGeometry args={[3, 0.16]} />
        <meshStandardMaterial color="#8a5f43" roughness={0.82} />
      </mesh>
    </group>
  );
}

function ZoneMarkers({
  zones,
  organizeMode,
  activeSlotKey,
  onSelectZone
}: {
  zones: ZoneDefinition[];
  organizeMode: boolean;
  activeSlotKey: string | null;
  onSelectZone: (zoneId: ZoneId | null) => void;
}) {
  if (!organizeMode) return null;

  return (
    <>
      {zones.flatMap((zone) =>
        zone.slotPositions.map((slot, slotIndex) => {
          const key = `${zone.id}:${slotIndex}`;
          const active = key === activeSlotKey;
          return (
            <mesh
              key={key}
              position={slot}
              onPointerDown={(event) => {
                event.stopPropagation();
                onSelectZone(zone.id);
              }}
            >
              <cylinderGeometry args={[0.12, 0.12, 0.025, 18]} />
              <meshStandardMaterial
                color={active ? '#5eead4' : '#ffffff'}
                transparent
                opacity={active ? 0.58 : 0.22}
                emissive={active ? '#4ade80' : '#ffffff'}
                emissiveIntensity={active ? 0.25 : 0.04}
              />
            </mesh>
          );
        })
      )}
    </>
  );
}

function StackMesh({
  stack,
  hovered,
  selected,
  dragging,
  showLabels,
  reduceMotion,
  organizeMode,
  onHover,
  onBlur,
  onSelect,
  onDragStart
}: {
  stack: StackView;
  hovered: boolean;
  selected: boolean;
  dragging: boolean;
  showLabels: boolean;
  reduceMotion: boolean;
  organizeMode: boolean;
  onHover: () => void;
  onBlur: () => void;
  onSelect: () => void;
  onDragStart: (event: ThreeEvent<PointerEvent>) => void;
}) {
  const Asset = ASSET_COMPONENTS[stack.assetId];
  const stackCopies = Math.min(3, Math.max(1, Math.ceil(stack.displayCount / 4)));

  return (
    <group position={stack.position}>
      <RoundedBox args={[0.34, 0.06, 0.26]} radius={0.05} smoothness={3} position={[0, -0.04, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={dragging ? '#bbf7d0' : selected ? '#fde68a' : '#e8e3dd'} roughness={0.78} />
      </RoundedBox>
      <group
        onPointerEnter={(event) => {
          event.stopPropagation();
          onHover();
        }}
        onPointerLeave={(event) => {
          event.stopPropagation();
          onBlur();
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
          if (organizeMode) {
            onDragStart(event);
            return;
          }
          onSelect();
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (!organizeMode) onSelect();
        }}
      >
        {Array.from({ length: stackCopies }, (_, index) => (
          <group
            key={`${stack.id}-${index}`}
            position={[index * 0.04 - (stackCopies - 1) * 0.02, index * 0.05, index * -0.02]}
            rotation={[0, stack.assetRotationY, 0]}
            scale={stack.assetScale}
          >
            <Asset hovered={hovered || dragging} reduceMotion={reduceMotion || dragging} stackSize={stackCopies} />
          </group>
        ))}
      </group>
      {showLabels ? (
        <Billboard position={[0, 0.52, 0]}>
          <Html center distanceFactor={11}>
            <div className="rounded-full border border-white/70 bg-white/94 px-2 py-0.5 text-[11px] font-semibold text-slate-700 shadow">
              x{formatCount(stack.count)}
            </div>
          </Html>
        </Billboard>
      ) : null}
      {hovered && !dragging ? (
        <Billboard position={[0, 0.78, 0]}>
          <Html center distanceFactor={10}>
            <div className="rounded-xl border border-amber-200 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-lg">
              <div className="font-semibold text-slate-900">{stack.name}</div>
              <div>{stack.category}</div>
              <div>Total: x{formatCount(stack.count)}</div>
            </div>
          </Html>
        </Billboard>
      ) : null}
    </group>
  );
}

function Scene({
  zones,
  stacks,
  hoveredDoor,
  organizeMode,
  showLabels,
  reduceMotion,
  showApplianceWireframe,
  fridgeDoorAngle,
  pantryDoorAngle,
  activeSlotKey,
  selectedZone,
  hoveredStackId,
  selectedStackId,
  draggingStackId,
  onHandleEnter,
  onHandleLeave,
  onHandleDown,
  onSelectZone,
  onStackHover,
  onStackBlur,
  onStackSelect,
  onStackDragStart,
  onCanvasReady,
  onFridgeAssetModeChange,
  onPantryAssetModeChange
}: {
  zones: ZoneDefinition[];
  stacks: StackView[];
  hoveredDoor: 'fridge' | 'pantry' | null;
  organizeMode: boolean;
  showLabels: boolean;
  reduceMotion: boolean;
  showApplianceWireframe: boolean;
  fridgeDoorAngle: number;
  pantryDoorAngle: number;
  activeSlotKey: string | null;
  selectedZone: ZoneDefinition | null;
  hoveredStackId: string | null;
  selectedStackId: string | null;
  draggingStackId: string | null;
  onHandleEnter: (kind: 'fridge' | 'pantry') => void;
  onHandleLeave: () => void;
  onHandleDown: (payload: DoorHandlePayload) => void;
  onSelectZone: (zoneId: ZoneId | null) => void;
  onStackHover: (id: string) => void;
  onStackBlur: () => void;
  onStackSelect: (zoneId: ZoneId) => void;
  onStackDragStart: (id: string, event: ThreeEvent<PointerEvent>) => void;
  onCanvasReady: (camera: THREE.Camera, canvas: HTMLCanvasElement) => void;
  onFridgeAssetModeChange: (mode: 'gltf' | 'fallback') => void;
  onPantryAssetModeChange: (mode: 'gltf' | 'fallback') => void;
}) {
  return (
    <Canvas
      shadows
      camera={{ position: DEFAULT_CAMERA.position.toArray() as [number, number, number], fov: 38 }}
      onCreated={({ camera, gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.02;
        gl.outputColorSpace = SRGBColorSpace;
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = PCFSoftShadowMap;
        onCanvasReady(camera, gl.domElement);
      }}
      onPointerMissed={() => {
        onStackBlur();
        onSelectZone(null);
      }}
    >
      <color attach="background" args={['#f5ebdd']} />
      <fog attach="fog" args={['#f5ebdd', 9, 18]} />
      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#eef3f6']} />
        <mesh scale={30}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshBasicMaterial side={BackSide} color="#eef3f6" />
        </mesh>
        <Lightformer form="rect" intensity={5} color="#fff7ec" position={[0, 5.8, 3.2]} scale={[6, 3, 1]} />
        <Lightformer form="rect" intensity={2.2} color="#d9eefb" position={[-5, 2.5, 2.5]} scale={[4, 2.5, 1]} />
        <Lightformer form="rect" intensity={1.6} color="#ffe7c8" position={[5.5, 2.3, -1.6]} scale={[3, 2, 1]} />
      </Environment>
      <ambientLight intensity={0.18} />
      <rectAreaLight position={[0, 5.4, 3.4]} width={6.4} height={2.6} intensity={8} color="#fff6ea" />
      <directionalLight
        position={[5.8, 7.4, 4.5]}
        intensity={1.25}
        color="#fff8ef"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00015}
      />
      <directionalLight position={[-4.8, 3.8, 2.4]} intensity={0.38} color="#cde8f5" />
      <pointLight position={[4.8, 3.2, -1.2]} intensity={0.22} color="#ffd7b0" />
      <RoomShell />
      <ContactShadows position={[0, 0.01, 0]} scale={13} blur={2.4} opacity={0.34} far={6.2} />
      <DoorAnimator selectedZone={selectedZone} />
      <RealisticFridge
        angle={fridgeDoorAngle}
        hovered={hoveredDoor === 'fridge'}
        showWireframe={showApplianceWireframe}
        onHandleEnter={() => onHandleEnter('fridge')}
        onHandleLeave={onHandleLeave}
        onHandleDown={(event) => onHandleDown({ kind: 'fridge', clientX: event.clientX })}
        onAssetModeChange={onFridgeAssetModeChange}
      />
      <RealisticPantry
        angle={pantryDoorAngle}
        hovered={hoveredDoor === 'pantry'}
        showWireframe={showApplianceWireframe}
        onHandleEnter={() => onHandleEnter('pantry')}
        onHandleLeave={onHandleLeave}
        onHandleDown={(event) => onHandleDown({ kind: 'pantry', clientX: event.clientX })}
        onAssetModeChange={onPantryAssetModeChange}
      />
      <Countertop />
      <ZoneMarkers zones={zones} organizeMode={organizeMode} activeSlotKey={activeSlotKey} onSelectZone={onSelectZone} />

      {stacks.map((stack) => (
        <StackMesh
          key={stack.id}
          stack={stack}
          hovered={hoveredStackId === stack.id}
          selected={selectedStackId === stack.id}
          dragging={draggingStackId === stack.id}
          showLabels={showLabels}
          reduceMotion={reduceMotion}
          organizeMode={organizeMode}
          onHover={() => onStackHover(stack.id)}
          onBlur={onStackBlur}
          onSelect={() => onStackSelect(stack.zoneId)}
          onDragStart={(event) => onStackDragStart(stack.id, event)}
        />
      ))}
    </Canvas>
  );
}

export default function VisualizePage({ onBack }: VisualizePageProps) {
  const ingredients = usePlannerStore((state) => state.ingredients);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const entries = useMemo(() => mapInventoryToVisuals(ingredients), [ingredients]);
  const [showLabels, setShowLabels] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [showApplianceWireframe, setShowApplianceWireframe] = useState(false);
  const [organizeMode, setOrganizeMode] = useState(false);
  const [autoFocusEnabled, setAutoFocusEnabled] = useState<boolean>(() => loadAutoFocusEnabled());
  const [hoveredStackId, setHoveredStackId] = useState<string | null>(null);
  const [selectedStackId, setSelectedStackId] = useState<string | null>(null);
  const [hoveredDoor, setHoveredDoor] = useState<'fridge' | 'pantry' | null>(null);
  const [fridgeRenderMode, setFridgeRenderMode] = useState<'gltf' | 'fallback'>('fallback');
  const [pantryRenderMode, setPantryRenderMode] = useState<'gltf' | 'fallback'>('fallback');
  const [selectedZoneId, setSelectedZoneId] = useState<ZoneId | null>(null);
  const [savedLayout, setSavedLayout] = useState<VisualLayoutMap>(() => loadSavedLayout());
  const [fridgeDoorTarget, setFridgeDoorTarget] = useState(0);
  const [pantryDoorTarget, setPantryDoorTarget] = useState(0);
  const [fridgeDoorAngle, setFridgeDoorAngle] = useState(0);
  const [pantryDoorAngle, setPantryDoorAngle] = useState(0);
  const [doorDrag, setDoorDrag] = useState<{ kind: 'fridge' | 'pantry'; startX: number; startAngle: number; moved: boolean } | null>(null);
  const [pendingStackPress, setPendingStackPress] = useState<PendingStackPress | null>(null);
  const [itemDrag, setItemDrag] = useState<ItemDragState | null>(null);
  const [draggedPosition, setDraggedPosition] = useState<[number, number, number] | null>(null);

  function screenToWorld(clientX: number, clientY: number, depthNdc: number): [number, number, number] | null {
    const camera = cameraRef.current;
    const canvas = canvasRef.current;
    if (!camera || !canvas) return null;

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    const projected = new THREE.Vector3(x, y, depthNdc).unproject(camera);
    return [projected.x, projected.y, projected.z];
  }

  const zones = useMemo(() => buildZones(fridgeDoorAngle), [fridgeDoorAngle]);
  const layout = useMemo(() => reconcileLayout(entries, zones, savedLayout), [entries, zones, savedLayout]);
  const categoryTotals = useMemo(() => buildCategoryTotals(entries), [entries]);
  const totalInventoryCount = useMemo(() => entries.reduce((sum, entry) => sum + entry.count, 0), [entries]);

  const stacks = useMemo<StackView[]>(
    () =>
      entries.map((entry) => {
        const placement = layout[entry.id];
        const position = itemDrag?.id === entry.id && draggedPosition ? draggedPosition : placement.position;
        return {
          id: entry.id,
          name: entry.name,
          count: entry.count,
          displayCount: entry.displayCount,
          zoneId: placement.zoneId,
          slotIndex: placement.slotIndex,
          assetId: entry.assetId,
          assetScale: entry.assetScale,
          assetRotationY: entry.assetRotationY,
          category: entry.category,
          position
        };
      }),
    [draggedPosition, entries, itemDrag?.id, layout]
  );

  const selectedZone = useMemo(() => zones.find((zone) => zone.id === selectedZoneId) ?? null, [selectedZoneId, zones]);
  const cameraZone = useMemo(() => {
    if (organizeMode || !autoFocusEnabled) return null;
    return selectedZone;
  }, [autoFocusEnabled, organizeMode, selectedZone]);
  const activeSlotKey = useMemo(() => {
    if (!draggedPosition || !itemDrag) return null;
    const nearest = findNearestSlot(draggedPosition, zones);
    return `${nearest.zoneId}:${nearest.slotIndex}`;
  }, [draggedPosition, itemDrag, zones]);

  const selectedZoneItems = useMemo(
    () => (selectedZoneId ? stacks.filter((stack) => stack.zoneId === selectedZoneId) : []),
    [selectedZoneId, stacks]
  );

  useEffect(() => {
    const next: VisualLayoutMap = {};
    entries.forEach((entry) => {
      if (layout[entry.id]) next[entry.id] = layout[entry.id];
    });
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(next));
  }, [entries, layout]);

  useEffect(() => {
    window.localStorage.setItem(AUTO_FOCUS_STORAGE_KEY, autoFocusEnabled ? 'true' : 'false');
  }, [autoFocusEnabled]);

  useEffect(() => {
    if (doorDrag) return;
    const timer = window.setInterval(() => {
      setFridgeDoorAngle((current) => {
        const next = THREE.MathUtils.damp(current, fridgeDoorTarget, 7, 1 / 60);
        return Math.abs(next - fridgeDoorTarget) < 0.002 ? fridgeDoorTarget : next;
      });
      setPantryDoorAngle((current) => {
        const next = THREE.MathUtils.damp(current, pantryDoorTarget, 7, 1 / 60);
        return Math.abs(next - pantryDoorTarget) < 0.002 ? pantryDoorTarget : next;
      });
    }, 16);

    return () => {
      window.clearInterval(timer);
    };
  }, [doorDrag, fridgeDoorTarget, pantryDoorTarget]);

  useEffect(() => {
    if (!doorDrag) return;
    const activeDoorDrag = doorDrag;

    function handleMove(event: PointerEvent) {
      const delta = (event.clientX - activeDoorDrag.startX) * 0.008;
      const nextAngle = clampAngle(activeDoorDrag.startAngle + delta);
      if (activeDoorDrag.kind === 'fridge') {
        setFridgeDoorAngle(nextAngle);
        setFridgeDoorTarget(nextAngle);
      } else {
        setPantryDoorAngle(nextAngle);
        setPantryDoorTarget(nextAngle);
      }

      setDoorDrag((current) => {
        if (!current) return current;
        return {
          ...current,
          moved: current.moved || Math.abs(event.clientX - current.startX) > 4
        };
      });
    }

    function handleUp() {
      setDoorDrag((current) => {
        if (!current) return null;
        const currentAngle = current.kind === 'fridge' ? fridgeDoorAngle : pantryDoorAngle;
        const toggled = current.moved ? currentAngle : currentAngle > DOOR_MAX_ANGLE * 0.45 ? 0 : DOOR_MAX_ANGLE;
        if (current.kind === 'fridge') {
          setFridgeDoorTarget(toggled);
        } else {
          setPantryDoorTarget(toggled);
        }
        return null;
      });
    }

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [doorDrag, fridgeDoorAngle, pantryDoorAngle]);

  useEffect(() => {
    if (!pendingStackPress || itemDrag) return;
    const activePress = pendingStackPress;

    function handleMove(event: PointerEvent) {
      const deltaX = event.clientX - activePress.startX;
      const deltaY = event.clientY - activePress.startY;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance < CLICK_THRESHOLD_PX) return;

      setItemDrag({
        id: activePress.id,
        startX: activePress.startX,
        startY: activePress.startY,
        startPosition: activePress.startPosition,
        depthNdc: activePress.depthNdc
      });
      setDraggedPosition(activePress.startPosition);
      setPendingStackPress(null);
    }

    function handleUp(event: PointerEvent) {
      const deltaX = event.clientX - activePress.startX;
      const deltaY = event.clientY - activePress.startY;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance < CLICK_THRESHOLD_PX) {
        const stack = stacks.find((candidate) => candidate.id === activePress.id);
        if (stack) {
          setSelectedStackId(stack.id);
          setSelectedZoneId(stack.zoneId);
        }
      }
      setPendingStackPress(null);
    }

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [itemDrag, pendingStackPress, stacks]);

  useEffect(() => {
    if (!itemDrag) return;
    const activeItemDrag = itemDrag;

    function handleMove(event: PointerEvent) {
      const worldPoint = screenToWorld(event.clientX, event.clientY, activeItemDrag.depthNdc);
      if (!worldPoint) return;
      setDraggedPosition([
        worldPoint[0],
        Math.max(0.45, Math.min(3.1, worldPoint[1])),
        worldPoint[2]
      ]);
    }

    function handleUp() {
      const finalPosition = draggedPosition ?? activeItemDrag.startPosition;
      const nearest = findNearestSlot(finalPosition, zones);
      setSavedLayout((current) => ({
        ...current,
        [activeItemDrag.id]: nearest
      }));
      setSelectedStackId(activeItemDrag.id);
      setSelectedZoneId(nearest.zoneId);
      setItemDrag(null);
      setDraggedPosition(null);
    }

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [draggedPosition, itemDrag, zones]);

  const handleDoorStart = (payload: DoorHandlePayload) => {
    const currentAngle = payload.kind === 'fridge' ? fridgeDoorAngle : pantryDoorAngle;
    setDoorDrag({
      kind: payload.kind,
      startX: payload.clientX,
      startAngle: currentAngle,
      moved: false
    });
  };

  const handleStackDragStart = (id: string, event: ThreeEvent<PointerEvent>) => {
    const stack = stacks.find((candidate) => candidate.id === id);
    if (!stack) return;
    if (!organizeMode) {
      setSelectedStackId(stack.id);
      setSelectedZoneId(stack.zoneId);
      return;
    }

    setPendingStackPress({
      id,
      startX: event.clientX,
      startY: event.clientY,
      startPosition: stack.position,
      depthNdc: new THREE.Vector3(...stack.position).project(event.camera).z
    });
  };

  return (
    <div className="app-shell min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.75),_transparent_42%),linear-gradient(180deg,_#fcf4e8_0%,_#f2e1cb_100%)] px-4 py-4 text-slate-800">
      <div className="shell-content mx-auto flex w-full max-w-[1800px] flex-col gap-4">
        <header className="glass-panel-strong rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="hero-title">Refridgermate</div>
              <div className="hero-subtitle">Visualize mode is now a toy-box pantry scene with movable stacks and interactive doors.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`btn-glass btn-md ${organizeMode ? 'btn-primary' : ''}`}
                onClick={() => setOrganizeMode((value) => !value)}
              >
                Organize Mode {organizeMode ? 'On' : 'Off'}
              </button>
              <button
                type="button"
                className="btn-glass btn-md"
                onClick={() => {
                  setSelectedStackId(null);
                  window.localStorage.removeItem(LAYOUT_STORAGE_KEY);
                  setSavedLayout({});
                  setSelectedZoneId(null);
                }}
              >
                Reset Layout
              </button>
              <button
                type="button"
                className="btn-glass btn-md"
                onClick={() => {
                  setSelectedStackId(null);
                  setSelectedZoneId(null);
                }}
              >
                Reset Camera
              </button>
              <button type="button" className="btn-glass btn-md" onClick={onBack}>
                Back to Planner
              </button>
            </div>
          </div>
        </header>

        <div className="relative overflow-hidden rounded-[28px] border border-white/50 bg-white/35 shadow-2xl">
          <div className="h-[78vh] min-h-[680px]">
            <Scene
              zones={zones}
              stacks={stacks}
              hoveredDoor={hoveredDoor}
              organizeMode={organizeMode}
              showLabels={showLabels}
              reduceMotion={reduceMotion}
              showApplianceWireframe={showApplianceWireframe}
              fridgeDoorAngle={fridgeDoorAngle}
              pantryDoorAngle={pantryDoorAngle}
              activeSlotKey={activeSlotKey}
              selectedZone={cameraZone}
              hoveredStackId={hoveredStackId}
              selectedStackId={selectedStackId}
              draggingStackId={itemDrag?.id ?? null}
              onHandleEnter={setHoveredDoor}
              onHandleLeave={() => setHoveredDoor(null)}
              onHandleDown={handleDoorStart}
              onSelectZone={setSelectedZoneId}
              onStackHover={setHoveredStackId}
              onStackBlur={() => setHoveredStackId(null)}
              onStackSelect={setSelectedZoneId}
              onStackDragStart={handleStackDragStart}
              onCanvasReady={(camera, canvas) => {
                cameraRef.current = camera;
                canvasRef.current = canvas;
              }}
              onFridgeAssetModeChange={setFridgeRenderMode}
              onPantryAssetModeChange={setPantryRenderMode}
            />
          </div>

          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="pointer-events-auto max-w-sm rounded-2xl border border-white/60 bg-white/84 p-4 shadow-lg backdrop-blur">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Inventory Snapshot</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">{formatCount(totalInventoryCount)}</div>
                <div className="text-sm text-slate-600">Current inventory units visualized as draggable stacks</div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-white/70 px-3 py-2">Protein: {formatCount(categoryTotals.Protein)}</div>
                  <div className="rounded-xl bg-white/70 px-3 py-2">Dairy: {formatCount(categoryTotals.Dairy)}</div>
                  <div className="rounded-xl bg-white/70 px-3 py-2">Produce: {formatCount(categoryTotals.Produce)}</div>
                  <div className="rounded-xl bg-white/70 px-3 py-2">Pantry: {formatCount(categoryTotals.Pantry)}</div>
                </div>
                {categoryTotals.Other > 0 ? <div className="mt-2 text-sm text-slate-600">Other: {formatCount(categoryTotals.Other)}</div> : null}
              </div>

              <div className="pointer-events-auto rounded-2xl border border-white/60 bg-white/84 p-4 shadow-lg backdrop-blur">
                <div className="space-y-3 text-sm text-slate-700">
                  <label className="flex items-center justify-between gap-4">
                    <span>Auto-focus on select</span>
                    <input
                      type="checkbox"
                      checked={autoFocusEnabled}
                      onChange={(event) => setAutoFocusEnabled(event.target.checked)}
                    />
                  </label>
                  <div className="text-xs text-slate-500">
                    Smooth camera focus only happens when this is on, and it is always suppressed while Organize Mode is enabled.
                  </div>
                  <label className="flex items-center justify-between gap-4">
                    <span>Show Labels</span>
                    <input type="checkbox" checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} />
                  </label>
                  <label className="flex items-center justify-between gap-4">
                    <span>Reduce Motion</span>
                    <input type="checkbox" checked={reduceMotion} onChange={(event) => setReduceMotion(event.target.checked)} />
                  </label>
                  <label className="flex items-center justify-between gap-4">
                    <span>Show Appliance Wireframe</span>
                    <input
                      type="checkbox"
                      checked={showApplianceWireframe}
                      onChange={(event) => setShowApplianceWireframe(event.target.checked)}
                    />
                  </label>
                  <div className="rounded-xl border border-white/60 bg-white/65 px-3 py-2 text-[11px] text-slate-500">
                    <div>Fridge: {fridgeRenderMode === 'gltf' ? 'GLTF' : 'Fallback'}</div>
                    <div>Pantry: {pantryRenderMode === 'gltf' ? 'GLTF' : 'Fallback'}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="pointer-events-auto max-w-md rounded-2xl border border-white/60 bg-white/84 p-4 shadow-lg backdrop-blur">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Interaction</div>
                <div className="mt-2 text-sm text-slate-700">
                  Click or drag a door handle to open it. Turn on Organize Mode to drag stacks between fridge shelves, door bins, pantry shelves, and the countertop.
                </div>
                <div className="mt-2 text-sm text-slate-700">
                  Layout is saved locally and restored on refresh without touching planner data.
                </div>
              </div>

              <div className="pointer-events-auto min-w-[320px] rounded-2xl border border-white/60 bg-white/84 p-4 shadow-lg backdrop-blur">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  {selectedZone ? selectedZone.label : 'Zone Focus'}
                </div>
                {selectedZone ? (
                  selectedZoneItems.length > 0 ? (
                    <div className="mt-2 max-h-44 space-y-2 overflow-auto text-sm text-slate-700">
                      {selectedZoneItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2">
                          <span className="truncate pr-3">{item.name}</span>
                          <span className="shrink-0 font-semibold">x{formatCount(item.count)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-slate-600">This zone is empty right now.</div>
                  )
                ) : (
                  <div className="mt-2 text-sm text-slate-600">
                    {entries.length > 0 ? 'Select a stack or a drop zone to focus that area.' : 'Add ingredients in Planner mode to populate the room.'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {entries.length === 0 ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="rounded-2xl border border-white/60 bg-white/88 px-5 py-4 text-sm text-slate-700 shadow-lg">
                No inventory yet. Add ingredients in Planner mode, then come back to organize the room.
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
