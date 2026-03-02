import { LabelDecal, AnimatedAsset, AssetProps, tone } from './shared';

export function FishFillet(props: AssetProps) {
  const tray = tone('#c6dbe4', props.hovered);

  return (
    <AnimatedAsset {...props} stackSize={props.stackSize}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.34, 0.08, 0.22]} />
        <meshStandardMaterial color={tray} flatShading />
      </mesh>
      <mesh position={[0, 0.07, 0]} castShadow receiveShadow scale={[1.45, 0.45, 0.55]}>
        <sphereGeometry args={[0.12, 14, 14]} />
        <meshStandardMaterial color="#8ec5d1" flatShading />
      </mesh>
      <mesh position={[0.15, 0.07, 0]} rotation={[0, 0.8, 0]} castShadow>
        <coneGeometry args={[0.06, 0.12, 4]} />
        <meshStandardMaterial color="#79adbb" flatShading />
      </mesh>
      <LabelDecal label="FISH" background="#5d97a7" position={[0, 0.01, 0.115]} size={[0.16, 0.055]} />
    </AnimatedAsset>
  );
}
