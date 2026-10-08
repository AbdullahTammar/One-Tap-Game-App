import type { ComponentType } from 'react';
// Metro folds __DEV__ in production: the development module graph is unreachable.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- production must not import development modules
const Harness: ComponentType = __DEV__ ? require('../game/core/dev/FoundationHarness').default : () => null;
export default Harness;
