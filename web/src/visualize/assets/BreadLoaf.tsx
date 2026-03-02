import { LabelDecal, AnimatedAsset, AssetProps, tone } from './shared';

export function BreadLoaf(props: AssetProps) {
  const loaf = tone('#d89f5a', props.hovered);

  return (
    <AnimatedAsset {...props} stackSize={props.stackSize}>
      <mesh castShadow receiveShadow scale={[1.1, 0.8, 0.9]}>
        <capsuleGeometry args={[0.11, 0.22, 8, 14]} />
        <meshStandardMaterial color={loaf} flatShading />
      </mesh>
      <mesh position={[0, -0.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.28, 0.09, 0.18]} />
        <meshStandardMaterial color="#f0d4b1" flatShading />
      </mesh>
      <LabelDecal label="BREAD" background="#ab6d3e" position={[0, 0.03, 0.1]} size={[0.16, 0.06]} />
    </AnimatedAsset>
  );
}
