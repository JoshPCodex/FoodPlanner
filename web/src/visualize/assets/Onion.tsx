import { AnimatedAsset, AssetProps, tone } from './shared';

export function Onion(props: AssetProps) {
  const skin = tone('#c6a58d', props.hovered);

  return (
    <AnimatedAsset {...props} stackSize={props.stackSize}>
      <mesh castShadow receiveShadow scale={[0.95, 1.08, 0.95]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color={skin} roughness={0.7} metalness={0.02} />
      </mesh>
      <mesh position={[0, 0.22, 0]} castShadow>
        <coneGeometry args={[0.03, 0.12, 6]} />
        <meshStandardMaterial color="#7d9a57" roughness={0.85} />
      </mesh>
    </AnimatedAsset>
  );
}
