import { AnimatedAsset, AssetProps, tone } from './shared';

export function Apple(props: AssetProps) {
  const body = tone('#d45d45', props.hovered);

  return (
    <AnimatedAsset {...props} stackSize={props.stackSize}>
      <mesh castShadow receiveShadow scale={[1, 0.96, 1]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color={body} flatShading />
      </mesh>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.12, 6]} />
        <meshStandardMaterial color="#6f4f37" flatShading />
      </mesh>
      <mesh position={[0.1, 0.2, 0]} rotation={[0, 0, 0.45]} castShadow>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#6aa85f" flatShading />
      </mesh>
    </AnimatedAsset>
  );
}
