import { LabelDecal, AnimatedAsset, AssetProps, tone } from './shared';

export function SnackBag(props: AssetProps) {
  const bag = tone('#ef9f76', props.hovered);

  return (
    <AnimatedAsset {...props} stackSize={props.stackSize}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.24, 0.32, 0.14]} />
        <meshStandardMaterial color={bag} flatShading />
      </mesh>
      <mesh position={[0, 0.18, 0]} castShadow>
        <boxGeometry args={[0.16, 0.03, 0.11]} />
        <meshStandardMaterial color="#f7c59f" flatShading />
      </mesh>
      <LabelDecal label="SNACK" background="#d96d4f" position={[0, 0.01, 0.076]} size={[0.17, 0.12]} />
    </AnimatedAsset>
  );
}
