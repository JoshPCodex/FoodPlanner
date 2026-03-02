import { useEffect, useMemo, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface GltfAssetState {
  scene: GLTF['scene'] | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: Error | null;
  resolvedPath: string | null;
}

export function useGltfAsset(path: string | string[], enabled = true): GltfAssetState {
  const pathKey = Array.isArray(path) ? path.join('|') : path;
  const paths = useMemo(() => (Array.isArray(path) ? path : [path]), [pathKey]);
  const [state, setState] = useState<GltfAssetState>({
    scene: null,
    status: enabled ? 'loading' : 'idle',
    error: null,
    resolvedPath: null
  });

  useEffect(() => {
    if (enabled) {
      paths.forEach((target) => useGLTF.preload(target));
    }
  }, [enabled, paths]);

  useEffect(() => {
    if (!enabled) {
      setState({ scene: null, status: 'idle', error: null, resolvedPath: null });
      return;
    }

    let cancelled = false;
    const loader = new GLTFLoader();

    setState((current) => ({
      scene: current.scene,
      status: 'loading',
      error: null,
      resolvedPath: current.resolvedPath
    }));

    function loadAt(index: number) {
      const target = paths[index];
      if (!target) {
        setState({
          scene: null,
          status: 'error',
          error: new Error('Failed to load GLTF asset'),
          resolvedPath: null
        });
        return;
      }

      loader.load(
        target,
        (gltf) => {
          if (cancelled) return;
          setState({
            scene: gltf.scene,
            status: 'ready',
            error: null,
            resolvedPath: target
          });
        },
        undefined,
        (error) => {
          if (cancelled) return;
          if (index < paths.length - 1) {
            loadAt(index + 1);
            return;
          }
          setState({
            scene: null,
            status: 'error',
            error: error instanceof Error ? error : new Error('Failed to load GLTF asset'),
            resolvedPath: null
          });
        }
      );
    }

    loadAt(0);

    return () => {
      cancelled = true;
    };
  }, [enabled, paths]);

  return state;
}
