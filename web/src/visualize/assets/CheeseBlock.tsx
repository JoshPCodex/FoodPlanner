import { AnimatedAsset, AssetProps, tone } from './shared';

export function CheeseBlock(props: AssetProps) {
  const cheese = tone('#f4c542', props.hovered);

  return (
    <AnimatedAsset {...props} rotation={[0, 0.4, 0]} stackSize={props.stackSize}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.3, 0.16, 0.22]} />
        <meshStandardMaterial color={cheese} flatShading />
      </mesh>
      <mesh position={[0.08, 0.03, 0.08]} castShadow>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#d9a425" flatShading />
      </mesh>
      <mesh position={[-0.05, 0.01, 0.05]} castShadow>
        <sphereGeometry args={[0.024, 8, 8]} />
        <meshStandardMaterial color="#d9a425" flatShading />
      </mesh>
    </AnimatedAsset>
  );
}
