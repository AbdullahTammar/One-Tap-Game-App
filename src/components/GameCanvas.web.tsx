import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { View } from 'react-native';

import type { SkiaRingProps } from './SkiaRing';

/**
 * Web preview: CanvasKit (Skia's WebAssembly build) must finish loading before
 * the Skia module is evaluated, so the ring is imported lazily.
 */
export function GameCanvas(props: SkiaRingProps) {
  return (
    <WithSkiaWeb
      opts={{ locateFile: (file: string) => `/${file}` }}
      getComponent={() => import('./SkiaRing')}
      fallback={<View style={{ width: props.size, height: props.size }} />}
      componentProps={props}
    />
  );
}
