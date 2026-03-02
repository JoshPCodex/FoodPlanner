import { LabelDecal, AnimatedAsset, AssetProps, tone } from './shared';

export function Egg(props: AssetProps) {
  const shell = tone('#ddd2c4', props.hovered);

  return (
    <AnimatedAsset {...props} stackSize={props.stackSize}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.34, 0.14, 0.22]} />
        <meshStandardMaterial color={shell} flatShading />
      </mesh>
      {[-0.1, 0, 0.1].map((x) => (
        <mesh key={x} position={[x, 0.08, 0]} castShadow receiveShadow scale={[0.7, 1, 0.7]}>
          <sphereGeometry args={[0.06, 10, 10]} />
          <meshStandardMaterial color="#f7ede2" flatShading />
        </mesh>
      ))}
      <LabelDecal label="EGGS" background="#8f6b53" position={[0, 0.01, 0.115]} size={[0.18, 0.06]} />
    </AnimatedAsset>
  );
}
