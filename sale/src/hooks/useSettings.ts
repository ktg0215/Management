import { useState, useEffect } from 'react';
import { SettingsData, ColumnConfig, defaultColumns, defaultCategories } from '../types/settings';

const SETTINGS_STORAGE_KEY = 'salesManagementSettings';

export const useSettings = () => {
  const [settings, setSettings] = useState<SettingsData>({
    columns: defaultColumns,
    categories: defaultCategories,
  });

  // Load settings from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      try {
        const parsedSettings = JSON.parse(stored);
        setSettings(parsedSettings);
      } catch (error) {
        console.error('Failed to parse settings:', error);
      }
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = (newSettings: SettingsData) => {
    setSettings(newSettings);
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
  };

  // Update column visibility
  const updateColumnVisibility = (columnId: string, visible: boolean) => {
    const newSettings = {
      ...settings,
      columns: settings.columns.map(col =>
        col.id === columnId ? { ...col, visible } : col
      ),
    };
    saveSettings(newSettings);
  };

  // Update column order
  const updateColumnOrder = (columnId: string, newOrder: number) => {
    const newSettings = {
      ...settings,
      columns: settings.columns.map(col =>
        col.id === columnId ? { ...col, order: newOrder } : col
      ),
    };
    saveSettings(newSettings);
  };

  // Add new column
  const addColumn = (column: Omit<ColumnConfig, 'order'>) => {
    const maxOrder = Math.max(...settings.columns.map(col => col.order));
    const newColumn: ColumnConfig = {
      ...column,
      order: maxOrder + 1,
    };
    
    const newSettings = {
      ...settings,
      columns: [...settings.columns, newColumn],
    };
    saveSettings(newSettings);
  };

  // Remove column
  const removeColumn = (columnId: string) => {
    const newSettings = {
      ...settings,
      columns: settings.columns.filter(col => col.id !== columnId),
    };
    saveSettings(newSettings);
  };

  // Reorder columns
  const reorderColumns = (newColumns: ColumnConfig[]) => {
    const newSettings = {
      ...settings,
      columns: newColumns,
    };
    saveSettings(newSettings);
  };

  // Reset to defaults
  const resetToDefaults = () => {
    const defaultSettings = {
      columns: defaultColumns,
      categories: defaultCategories,
    };
    saveSettings(defaultSettings);
  };

  // Get visible columns sorted by order
  const getVisibleColumns = () => {
    return settings.columns
      .filter(col => col.visible)
      .sort((a, b) => a.order - b.order);
  };

  // Get columns by category
  const getColumnsByCategory = (categoryId: string) => {
    return settings.columns
      .filter(col => col.category === categoryId)
      .sort((a, b) => a.order - b.order);
  };

  return {
    settings,
    updateColumnVisibility,
    updateColumnOrder,
    addColumn,
    removeColumn,
    reorderColumns,
    resetToDefaults,
    getVisibleColumns,
    getColumnsByCategory,
  };
};