import { AnimatedAsset, AssetProps, tone } from './shared';

export function Lettuce(props: AssetProps) {
  const leaf = tone('#6ca965', props.hovered);

  return (
    <AnimatedAsset {...props} stackSize={props.stackSize}>
      <mesh castShadow receiveShadow>
        <icosahedronGeometry args={[0.22, 1]} />
        <meshStandardMaterial color={leaf} flatShading />
      </mesh>
      <mesh position={[0.03, 0.05, 0.12]} castShadow>
        <sphereGeometry args={[0.11, 10, 10]} />
        <meshStandardMaterial color="#7dbe70" flatShading />
      </mesh>
    </AnimatedAsset>
  );
}
