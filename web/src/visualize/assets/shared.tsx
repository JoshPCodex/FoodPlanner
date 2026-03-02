import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { GroupProps } from '@react-three/fiber';
import { CanvasTexture, SRGBColorSpace, type Group } from 'three';

export interface AssetProps extends Omit<GroupProps, 'position'> {
  hovered?: boolean;
  reduceMotion?: boolean;
  position?: [number, number, number];
  stackSize?: number;
}

export function tone(base: string, hovered?: boolean): string {
  return hovered ? '#fff7d6' : base;
}

export function useLabelTexture(label: string, background: string, foreground = '#fff9ec') {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) return null;

    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(255,255,255,0.14)';
    context.fillRect(12, 12, canvas.width - 24, 22);
    context.fillStyle = foreground;
    context.font = '700 44px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(label, canvas.width / 2, canvas.height / 2 + 6);

    const next = new CanvasTexture(canvas);
    next.colorSpace = SRGBColorSpace;
    return next;
  }, [background, foreground, label]);

  useEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

  return texture;
}

export function LabelDecal({
  label,
  background,
  foreground,
  position,
  rotation,
  size = [0.18, 0.1]
}: {
  label: string;
  background: string;
  foreground?: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  size?: [number, number];
}) {
  const texture = useLabelTexture(label, background, foreground);
  if (!texture) return null;

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  );
}

export function AnimatedAsset({ hovered, reduceMotion, children, rotation, stackSize = 1, ...props }: AssetProps) {
  const ref = useRef<Group>(null);
  const baseRotationY = Array.isArray(rotation) ? rotation[1] : 0;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    if (reduceMotion) {
      ref.current.rotation.y = baseRotationY;
      ref.current.position.y = 0;
      return;
    }

    const wobble = hovered ? 0.16 : 0.08;
    const bob = hovered ? 0.05 : 0.028;
    ref.current.rotation.y = baseRotationY + Math.sin(clock.elapsedTime * 0.9) * wobble;
    ref.current.position.y = Math.sin(clock.elapsedTime * (1.1 + stackSize * 0.08)) * bob;
  });

  return (
    <group ref={ref} rotation={rotation} {...props}>
      {children}
    </group>
  );
}
