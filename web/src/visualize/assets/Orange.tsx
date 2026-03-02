import { AnimatedAsset, AssetProps, tone } from './shared';

export function Orange(props: AssetProps) {
  const peel = tone('#e6892d', props.hovered);

  return (
    <AnimatedAsset {...props} stackSize={props.stackSize}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[0.19, 18, 18]} />
        <meshStandardMaterial color={peel} roughness={0.72} metalness={0.02} />
      </mesh>
      <mesh position={[0.05, 0.19, 0]} castShadow>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshStandardMaterial color="#648c48" roughness={0.8} />
      </mesh>
    </AnimatedAsset>
  );
}
