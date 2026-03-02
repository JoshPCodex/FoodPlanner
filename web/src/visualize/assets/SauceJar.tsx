import { LabelDecal, AnimatedAsset, AssetProps, tone } from './shared';

export function SauceJar(props: AssetProps) {
  const sauce = tone('#c85f45', props.hovered);

  return (
    <AnimatedAsset {...props} stackSize={props.stackSize}>
      <mesh position={[0, -0.02, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.11, 0.12, 0.28, 14]} />
        <meshStandardMaterial color={sauce} flatShading />
      </mesh>
      <mesh position={[0, 0.19, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.06, 10]} />
        <meshStandardMaterial color="#7c4d39" flatShading />
      </mesh>
      <LabelDecal label="SAUCE" background="#f2d1a6" foreground="#8a4333" position={[0, 0.01, 0.115]} size={[0.16, 0.11]} />
    </AnimatedAsset>
  );
}
