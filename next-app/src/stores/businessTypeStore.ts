import { create } from 'zustand';
import apiClient, { BusinessType } from '../lib/api';

interface BusinessTypeState {
  businessTypes: BusinessType[];
  isLoading: boolean;
  fetchBusinessTypes: () => Promise<void>;
  createBusinessType: (data: { name: string; description?: string }) => Promise<BusinessType | null>;
  updateBusinessType: (id: string, data: { name: string; description?: string }) => Promise<boolean>;
  deleteBusinessType: (id: string) => Promise<boolean>;
}

export const useBusinessTypeStore = create<BusinessTypeState>((set) => ({
  businessTypes: [],
  isLoading: false,
  
  fetchBusinessTypes: async () => {
    set({ isLoading: true });
    
    try {
      const response = await apiClient.getBusinessTypes();

      if (response.success && response.data) {
        set({ 
          businessTypes: response.data,
          isLoading: false 
        });
      } else {
        console.error('業態取得エラー:', response.error);
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('業態取得エラー:', error);
      set({ isLoading: false });
      throw error;
    }
  },
  
  createBusinessType: async (data) => {
    set({ isLoading: true });
    
    try {
      const response = await apiClient.createBusinessType(data);

      if (response.success && response.data) {
        set(state => ({ 
          businessTypes: [...state.businessTypes, response.data as BusinessType],
          isLoading: false
        }));
        return response.data;
      } else {
        set({ isLoading: false });
        return null;
      }
    } catch (error) {
      console.error('業態作成エラー:', error);
      set({ isLoading: false });
      return null;
    }
  },
  
  updateBusinessType: async (id, data) => {
    set({ isLoading: true });
    
    try {
      const response = await apiClient.updateBusinessType(id, data);

      if (response.success && response.data) {
        set(state => ({
          businessTypes: state.businessTypes.map(bt => 
            bt.id === id ? response.data as BusinessType : bt
          ),
          isLoading: false
        }));
        
        return true;
      } else {
        console.error('業態更新エラー:', response.error);
        set({ isLoading: false });
        return false;
      }
    } catch (error) {
      console.error('業態更新エラー:', error);
      set({ isLoading: false });
      return false;
    }
  },
  
  deleteBusinessType: async (id) => {
    set({ isLoading: true });
    
    try {
      const response = await apiClient.deleteBusinessType(id);

      if (response.success) {
        set(state => ({
          businessTypes: state.businessTypes.filter(bt => bt.id !== id),
          isLoading: false
        }));
        
        return true;
      } else {
        console.error('業態削除エラー:', response.error);
        set({ isLoading: false });
        return false;
      }
    } catch (error) {
      console.error('業態削除エラー:', error);
      set({ isLoading: false });
      return false;
    }
  },
})); 