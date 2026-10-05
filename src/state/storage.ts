import { createMMKV } from 'react-native-mmkv';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

/** Synchronous, JSI-backed key/value store (~30x faster than AsyncStorage). */
export const mmkv = createMMKV({ id: 'lumo' });

const mmkvStateStorage: StateStorage = {
  getItem: (name) => mmkv.getString(name) ?? null,
  setItem: (name, value) => mmkv.set(name, value),
  removeItem: (name) => {
    mmkv.remove(name);
  },
};

export const persistStorage = createJSONStorage(() => mmkvStateStorage);
