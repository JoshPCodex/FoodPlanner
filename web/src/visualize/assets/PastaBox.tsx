import { LabelDecal, AnimatedAsset, AssetProps, tone } from './shared';

export function PastaBox(props: AssetProps) {
  const box = tone('#f3d27d', props.hovered);

  return (
    <AnimatedAsset {...props} stackSize={props.stackSize}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.24, 0.34, 0.1]} />
        <meshStandardMaterial color={box} flatShading />
      </mesh>
      <LabelDecal label="PASTA" background="#ca7f36" position={[0, 0.01, 0.056]} size={[0.16, 0.18]} />
    </AnimatedAsset>
  );
}
