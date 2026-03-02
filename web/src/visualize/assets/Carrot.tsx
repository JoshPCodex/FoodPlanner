import { AnimatedAsset, AssetProps, tone } from './shared';

export function Carrot(props: AssetProps) {
  const root = tone('#e67f3d', props.hovered);

  return (
    <AnimatedAsset {...props} rotation={[0.35, 0, 0.65]} stackSize={props.stackSize}>
      <mesh castShadow receiveShadow>
        <coneGeometry args={[0.11, 0.5, 10]} />
        <meshStandardMaterial color={root} flatShading />
      </mesh>
      <mesh position={[0.02, 0.27, 0]} castShadow>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#6fbf73" flatShading />
      </mesh>
      <mesh position={[-0.07, 0.24, 0]} castShadow>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshStandardMaterial color="#6fbf73" flatShading />
      </mesh>
    </AnimatedAsset>
  );
}
