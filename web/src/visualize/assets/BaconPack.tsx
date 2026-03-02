import { LabelDecal, AnimatedAsset, AssetProps, tone } from './shared';

export function BaconPack(props: AssetProps) {
  const tray = tone('#f1dfd3', props.hovered);

  return (
    <AnimatedAsset {...props} stackSize={props.stackSize}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.34, 0.08, 0.22]} />
        <meshStandardMaterial color={tray} roughness={0.58} />
      </mesh>
      {[-0.07, 0, 0.07].map((x) => (
        <mesh key={x} position={[x, 0.055, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.05, 0.03, 0.18]} />
          <meshStandardMaterial color="#b85b56" roughness={0.72} />
        </mesh>
      ))}
      <LabelDecal label="BACON" background="#8f4744" position={[0, 0.01, 0.115]} size={[0.16, 0.055]} />
    </AnimatedAsset>
  );
}
