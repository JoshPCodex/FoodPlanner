import { AnimatedAsset, AssetProps, tone } from './shared';

export function Banana(props: AssetProps) {
  const peel = tone('#f4d35e', props.hovered);

  return (
    <AnimatedAsset {...props} rotation={[0.2, 0, -0.55]} stackSize={props.stackSize}>
      <mesh castShadow receiveShadow scale={[1.1, 0.9, 0.8]}>
        <capsuleGeometry args={[0.07, 0.38, 5, 14]} />
        <meshStandardMaterial color={peel} flatShading />
      </mesh>
      <mesh position={[0.15, 0.15, 0]} rotation={[0, 0.2, 0.5]} castShadow>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshStandardMaterial color="#8bbf52" flatShading />
      </mesh>
    </AnimatedAsset>
  );
}
