import { LabelDecal, AnimatedAsset, AssetProps, tone } from './shared';

export function ChickenDrumstick(props: AssetProps) {
  const tray = tone('#f0c9ae', props.hovered);

  return (
    <AnimatedAsset {...props} rotation={[0, 0.25, 0]} stackSize={props.stackSize}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.34, 0.08, 0.24]} />
        <meshStandardMaterial color={tray} flatShading />
      </mesh>
      <mesh position={[-0.07, 0.06, 0]} castShadow receiveShadow scale={[1.05, 0.45, 0.65]}>
        <sphereGeometry args={[0.11, 14, 14]} />
        <meshStandardMaterial color="#d4866a" flatShading />
      </mesh>
      <mesh position={[0.08, 0.06, 0]} castShadow receiveShadow scale={[1.05, 0.45, 0.65]}>
        <sphereGeometry args={[0.11, 14, 14]} />
        <meshStandardMaterial color="#d4866a" flatShading />
      </mesh>
      <LabelDecal label="CHKN" background="#bb6f50" position={[0, 0.01, 0.125]} size={[0.16, 0.055]} />
    </AnimatedAsset>
  );
}
