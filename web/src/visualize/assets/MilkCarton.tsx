import { LabelDecal, AnimatedAsset, AssetProps, tone } from './shared';

export function MilkCarton(props: AssetProps) {
  const carton = tone('#f2f7fb', props.hovered);

  return (
    <AnimatedAsset {...props} stackSize={props.stackSize}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.22, 0.38, 0.18]} />
        <meshStandardMaterial color={carton} flatShading />
      </mesh>
      <mesh position={[0, 0.25, 0]} castShadow>
        <coneGeometry args={[0.12, 0.16, 4]} />
        <meshStandardMaterial color="#8ecae6" flatShading />
      </mesh>
      <LabelDecal label="MILK" background="#7ab8db" position={[0, 0.02, 0.1]} size={[0.14, 0.09]} />
    </AnimatedAsset>
  );
}
