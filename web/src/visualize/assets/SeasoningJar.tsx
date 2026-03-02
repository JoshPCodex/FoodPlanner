import { LabelDecal, AnimatedAsset, AssetProps, tone } from './shared';

export function SeasoningJar(props: AssetProps) {
  const glass = tone('#8f7a66', props.hovered);

  return (
    <AnimatedAsset {...props} stackSize={props.stackSize}>
      <mesh position={[0, -0.01, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.24, 18]} />
        <meshStandardMaterial color={glass} roughness={0.36} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0.14, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.05, 18]} />
        <meshStandardMaterial color="#d4d4d8" roughness={0.3} metalness={0.35} />
      </mesh>
      <LabelDecal label="SPICE" background="#f0d6a8" foreground="#6e4b30" position={[0, 0.01, 0.105]} size={[0.15, 0.1]} />
    </AnimatedAsset>
  );
}
