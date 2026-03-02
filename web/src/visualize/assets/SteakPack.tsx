import { LabelDecal, AnimatedAsset, AssetProps, tone } from './shared';

export function SteakPack(props: AssetProps) {
  const tray = tone('#efe3da', props.hovered);

  return (
    <AnimatedAsset {...props} stackSize={props.stackSize}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.34, 0.08, 0.24]} />
        <meshStandardMaterial color={tray} flatShading />
      </mesh>
      <mesh position={[0, 0.065, 0]} castShadow receiveShadow scale={[1.35, 0.42, 0.75]}>
        <sphereGeometry args={[0.12, 14, 14]} />
        <meshStandardMaterial color="#b85e5d" flatShading />
      </mesh>
      <mesh position={[0.05, 0.08, 0.02]} rotation={[0, 0, 0.4]} castShadow>
        <boxGeometry args={[0.03, 0.14, 0.03]} />
        <meshStandardMaterial color="#f0d7b9" flatShading />
      </mesh>
      <LabelDecal label="STEAK" background="#7f3e48" position={[0, 0.01, 0.125]} size={[0.16, 0.055]} />
    </AnimatedAsset>
  );
}
