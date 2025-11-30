import { create } from 'zustand';
import apiClient from '../lib/api';
import type { Store } from '@/types/store';

export type { Store };

interface StoreState {
  stores: Store[];
  isLoading: boolean;
  fetchStores: () => Promise<void>;
  createStore: (name: string, businessTypeId?: string, address?: string) => Promise<Store | null>;
  updateStore: (id: string, name: string, businessTypeId?: string, address?: string) => Promise<boolean>;
  deleteStore: (id: string) => Promise<boolean>;
}

export const useStoreStore = create<StoreState>((set) => ({
  stores: [],
  isLoading: false,
  
  fetchStores: async () => {
    set({ isLoading: true });

    try {
      const response = await apiClient.getStores();

      if (response.success && response.data) {
        set({
          stores: response.data,
          isLoading: false
        });
      } else {
        console.error('fetchStores: エラー:', response.error);
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('fetchStores: 例外発生:', error);
      set({ isLoading: false });
      throw error; // エラーを再スローして上位でキャッチできるようにする
    }
  },
  
  createStore: async (name, businessTypeId, address) => {
    set({ isLoading: true });
    
    try {
      const response = await apiClient.createStore(name, businessTypeId, address);

      if (response.success && response.data) {
        set(state => ({ 
          stores: [...state.stores, response.data as Store],
          isLoading: false
        }));
        return response.data;
      } else {
        set({ isLoading: false });
        return null;
      }
    } catch (error) {
      console.error('店舗作成エラー:', error);
      set({ isLoading: false });
      return null;
    }
  },
  
  updateStore: async (id, name, businessTypeId, address) => {
    set({ isLoading: true });
    
    try {
      const response = await apiClient.updateStore(id, name, businessTypeId, address);

      if (response.success && response.data) {
        set(state => ({
          stores: state.stores.map(store => 
            store.id === id ? response.data as Store : store
          ),
          isLoading: false
        }));
        
        return true;
      } else {
        console.error('店舗更新エラー:', response.error);
        set({ isLoading: false });
        return false;
      }
    } catch (error) {
      console.error('店舗更新エラー:', error);
      set({ isLoading: false });
      return false;
    }
  },
  
  deleteStore: async (id) => {
    set({ isLoading: true });
    
    try {
      const response = await apiClient.deleteStore(id);

      if (response.success) {
        set(state => ({
          stores: state.stores.filter(store => store.id !== id),
          isLoading: false
        }));
        
        return true;
      } else {
        console.error('店舗削除エラー:', response.error);
        set({ isLoading: false });
        return false;
      }
    } catch (error) {
      console.error('店舗削除エラー:', error);
      set({ isLoading: false });
      return false;
    }
  },
}));