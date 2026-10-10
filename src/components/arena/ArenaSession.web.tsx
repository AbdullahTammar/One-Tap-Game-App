import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
export default function ArenaSession(props: { seed?: number; stress?: boolean }) {
  return (
    <WithSkiaWeb
      opts={{ locateFile: (file: string) => `/${file}` }}
      getComponent={() => import('./ArenaNative')}
      componentProps={props}
    />
  );
}
