import { AnimatedAsset, AssetProps, tone } from './shared';

export function GenericBox(props: AssetProps) {
  const base = tone('#d8dfe8', props.hovered);

  return (
    <AnimatedAsset {...props} stackSize={props.stackSize}>
      <mesh position={[0, -0.01, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.11, 0.11, 0.26, 16]} />
        <meshStandardMaterial color={base} flatShading />
      </mesh>
      <mesh position={[0, 0.14, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.03, 16]} />
        <meshStandardMaterial color="#aab6c3" flatShading />
      </mesh>
    </AnimatedAsset>
  );
}
