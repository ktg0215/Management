# Sales Management Page Updates - Business Type Selection Feature

## Overview
This document details all changes made to add business type selection functionality to the sales management page fields tab, similar to the monthly-sales page.

## Files Modified

### 1. C:/job/project/next-app/src/app/admin/sales-management/page.tsx

## Detailed Changes

### A. Import Statements (Line 20)

**BEFORE:**
```typescript
import { BarChart3 } from 'lucide-react';
```

**AFTER:**
```typescript
import { BarChart3, Building2, ChevronDown, Plus, Save } from 'lucide-react';
```

**Purpose:** Added new icons for business type selector UI components.

---

### B. State Variables (After line 30)

**ADD NEW STATE VARIABLES:**
```typescript
  // State for business type selection in fields tab
  const [selectedBusinessTypeId, setSelectedBusinessTypeId] = useState<string>('');
  const [isAddingBusinessType, setIsAddingBusinessType] = useState(false);
  const [newBusinessTypeName, setNewBusinessTypeName] = useState('');
```

**Location:** After `const [activeTab, setActiveTab] = useState<'data' | 'fields'>('data');`

**Purpose:**
- `selectedBusinessTypeId`: Tracks which business type is currently selected in the fields tab
- `isAddingBusinessType`: Controls visibility of the "add new business type" form
- `newBusinessTypeName`: Stores the input value for new business type name

---

### C. Debug Logging (Lines 36-45)

**UPDATE:** Add new fields to the existing console.log statement:

**BEFORE:**
```typescript
  console.log('[SalesManagementPage] Render state:', {
    isLoading,
    error: error ? String(error) : null,
    hasMonthlyData: !!monthlyData,
    dailyDataKeys: monthlyData?.dailyData ? Object.keys(monthlyData.dailyData).length : 0,
    sampleDates: monthlyData?.dailyData ? Object.keys(monthlyData.dailyData).slice(0, 3) : [],
    selectedStoreId,
    currentYear,
    currentMonth
  });
```

**AFTER:**
```typescript
  console.log('[SalesManagementPage] Render state:', {
    isLoading,
    error: error ? String(error) : null,
    hasMonthlyData: !!monthlyData,
    dailyDataKeys: monthlyData?.dailyData ? Object.keys(monthlyData.dailyData).length : 0,
    sampleDates: monthlyData?.dailyData ? Object.keys(monthlyData.dailyData).slice(0, 3) : [],
    selectedStoreId,
    currentYear,
    currentMonth,
    selectedBusinessTypeId,
    activeTab
  });
```

---

### D. Auto-select Business Type Effect (After line 59)

**ADD NEW useEffect:**
```typescript
  // Auto-select first business type when on fields tab
  useEffect(() => {
    if (activeTab === 'fields' && businessTypes.length > 0 && !selectedBusinessTypeId) {
      setSelectedBusinessTypeId(businessTypes[0].id);
    }
  }, [activeTab, businessTypes, selectedBusinessTypeId]);
```

**Location:** After the existing useEffect that fetches stores and business types

**Purpose:** Automatically selects the first business type when switching to the fields tab

---

### E. getCurrentFieldConfig() Function (Lines 62-99)

**REPLACE THE ENTIRE FUNCTION WITH:**

```typescript
  // Get field configuration for the selected business type (when on fields tab) or store's business type (when on data tab)
  const getCurrentFieldConfig = () => {
    // When on fields tab, use selectedBusinessTypeId
    if (activeTab === 'fields') {
      if (!selectedBusinessTypeId || businessTypes.length === 0) {
        return DEFAULT_SALES_FIELDS.map((field, index) => ({
          ...field,
          id: `default-field-${index}`
        }));
      }

      const businessType = businessTypes.find(bt => bt.id === selectedBusinessTypeId);
      if (!businessType) {
        return DEFAULT_SALES_FIELDS.map((field, index) => ({
          ...field,
          id: `default-field-${index}`
        }));
      }

      const config = salesFieldConfigs.find(c => c.businessTypeId === selectedBusinessTypeId);
      if (config) {
        return config.fields;
      }

      // Use EDW config for EDW business types
      const isEDW = businessType.name.includes('EDW') || businessType.name.includes('エデュワード');
      const defaultFields = isEDW ? EDW_SALES_FIELD_CONFIG : DEFAULT_SALES_FIELDS;

      return defaultFields.map((field, index) => ({
        ...field,
        id: `${selectedBusinessTypeId}-field-${index}`
      }));
    }

    // When on data tab, use store's business type
    if (!selectedStoreId || stores.length === 0) {
      return DEFAULT_SALES_FIELDS.map((field, index) => ({
        ...field,
        id: `default-field-${index}`
      }));
    }

    const selectedStore = stores.find(store => String(store.id) === selectedStoreId);
    if (!selectedStore || !selectedStore.businessTypeId) {
      return DEFAULT_SALES_FIELDS.map((field, index) => ({
        ...field,
        id: `default-field-${index}`
      }));
    }

    const businessType = businessTypes.find(bt => bt.id === selectedStore.businessTypeId);
    if (!businessType) {
      return DEFAULT_SALES_FIELDS.map((field, index) => ({
        ...field,
        id: `default-field-${index}`
      }));
    }

    const config = salesFieldConfigs.find(c => c.businessTypeId === selectedStore.businessTypeId);
    if (config) {
      return config.fields;
    }

    // Use EDW config for EDW business types
    const isEDW = businessType.name.includes('EDW') || businessType.name.includes('エデュワード');
    const defaultFields = isEDW ? EDW_SALES_FIELD_CONFIG : DEFAULT_SALES_FIELDS;

    return defaultFields.map((field, index) => ({
      ...field,
      id: `${selectedStore.businessTypeId}-field-${index}`
    }));
  };
```

**Key Changes:**
- Added check for `activeTab === 'fields'` at the beginning
- When on fields tab, uses `selectedBusinessTypeId` instead of store's business type
- When on data tab, maintains original behavior (uses store's business type)

---

### F. getCurrentBusinessTypeName() Function (Lines 103-109)

**REPLACE THE ENTIRE FUNCTION WITH:**

```typescript
  const getCurrentBusinessTypeName = () => {
    // When on fields tab, use selectedBusinessTypeId
    if (activeTab === 'fields') {
      if (!selectedBusinessTypeId || businessTypes.length === 0) return 'デフォルト';
      const businessType = businessTypes.find(bt => bt.id === selectedBusinessTypeId);
      return businessType ? businessType.name : 'デフォルト';
    }

    // When on data tab, use store's business type
    if (!selectedStoreId || stores.length === 0) return 'デフォルト';
    const selectedStore = stores.find(store => String(store.id) === selectedStoreId);
    if (!selectedStore || !selectedStore.businessTypeId) return 'デフォルト';
    const businessType = businessTypes.find(bt => bt.id === selectedStore.businessTypeId);
    return businessType ? businessType.name : 'デフォルト';
  };
```

**Key Changes:**
- Added logic to use `selectedBusinessTypeId` when on fields tab
- Maintains original behavior when on data tab

---

### G. handleFieldsChange() Function (Lines 111-134)

**REPLACE THE ENTIRE FUNCTION WITH:**

```typescript
  const handleFieldsChange = (updatedFields: SalesFieldConfig[]) => {
    // When on fields tab, save to selected business type
    if (activeTab === 'fields') {
      if (!selectedBusinessTypeId || businessTypes.length === 0) return;
      const businessType = businessTypes.find(bt => bt.id === selectedBusinessTypeId);
      if (!businessType) return;

      const existingConfigIndex = salesFieldConfigs.findIndex(c => c.businessTypeId === selectedBusinessTypeId);
      if (existingConfigIndex >= 0) {
        const updatedConfigs = [...salesFieldConfigs];
        updatedConfigs[existingConfigIndex] = {
          businessTypeId: selectedBusinessTypeId,
          businessTypeName: businessType.name,
          fields: updatedFields
        };
        setSalesFieldConfigs(updatedConfigs);
      } else {
        setSalesFieldConfigs([...salesFieldConfigs, {
          businessTypeId: selectedBusinessTypeId,
          businessTypeName: businessType.name,
          fields: updatedFields
        }]);
      }
      return;
    }

    // When on data tab, save to store's business type
    if (!selectedStoreId || stores.length === 0) return;
    const selectedStore = stores.find(store => String(store.id) === selectedStoreId);
    if (!selectedStore || !selectedStore.businessTypeId) return;
    const businessType = businessTypes.find(bt => bt.id === selectedStore.businessTypeId);
    if (!businessType) return;

    const existingConfigIndex = salesFieldConfigs.findIndex(c => c.businessTypeId === selectedStore.businessTypeId);
    if (existingConfigIndex >= 0) {
      const updatedConfigs = [...salesFieldConfigs];
      updatedConfigs[existingConfigIndex] = {
        businessTypeId: selectedStore.businessTypeId,
        businessTypeName: businessType.name,
        fields: updatedFields
      };
      setSalesFieldConfigs(updatedConfigs);
    } else {
      setSalesFieldConfigs([...salesFieldConfigs, {
        businessTypeId: selectedStore.businessTypeId,
        businessTypeName: businessType.name,
        fields: updatedFields
      }]);
    }
  };
```

**Key Changes:**
- Added logic to save to `selectedBusinessTypeId` when on fields tab
- Maintains original behavior (save to store's business type) when on data tab

---

### H. Add New Handler Function (After handleFieldsChange)

**ADD NEW FUNCTION:**

```typescript
  const handleAddBusinessType = () => {
    if (newBusinessTypeName.trim()) {
      const newBusinessType = {
        id: Date.now().toString(),
        name: newBusinessTypeName.trim(),
        description: ''
      };

      // Create empty field config for the new business type
      const newConfig: BusinessTypeSalesConfig = {
        businessTypeId: newBusinessType.id,
        businessTypeName: newBusinessType.name,
        fields: DEFAULT_SALES_FIELDS.map((field, index) => ({
          ...field,
          id: `${newBusinessType.id}-field-${index}`
        }))
      };
      setSalesFieldConfigs([...salesFieldConfigs, newConfig]);

      setSelectedBusinessTypeId(newBusinessType.id);
      setNewBusinessTypeName('');
      setIsAddingBusinessType(false);

      alert('業態を追加しました。この業態はローカルに保存されます。\nサーバーに保存するには、システム管理者にお問い合わせください。');
    }
  };
```

**Purpose:** Handles creating a new business type with default field configuration

---

### I. Fields Tab UI (Lines 355-361)

**REPLACE:**
```typescript
          ) : (
            <SalesFieldConfiguration
              currentFields={currentFields}
              businessTypeName={getCurrentBusinessTypeName()}
              onFieldsChange={handleFieldsChange}
            />
          )}
```

**WITH:**
```typescript
          ) : (
            <>
              {/* Business Type Selector for Fields Tab */}
              <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <label className="text-sm font-medium text-gray-700">業態選択:</label>
                    <div className="flex items-center space-x-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 min-w-64">
                      <Building2 className="w-5 h-5 text-blue-500" />
                      <select
                        value={selectedBusinessTypeId}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '__ADD_NEW__') {
                            setIsAddingBusinessType(true);
                          } else {
                            setSelectedBusinessTypeId(value);
                          }
                        }}
                        className="bg-transparent border-none focus:ring-0 text-gray-900 font-medium cursor-pointer flex-1"
                      >
                        {businessTypes.length === 0 ? (
                          <option value="">業態を追加してください</option>
                        ) : (
                          <>
                            {businessTypes.map(bt => (
                              <option key={bt.id} value={bt.id}>{bt.name}</option>
                            ))}
                            <option value="__ADD_NEW__">+ 新しい業態を追加</option>
                          </>
                        )}
                      </select>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>

                  {/* Quick Add Button */}
                  {!isAddingBusinessType && (
                    <button
                      onClick={() => setIsAddingBusinessType(true)}
                      className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      業態追加
                    </button>
                  )}
                </div>

                {/* Add Business Type Form */}
                {isAddingBusinessType && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-3">
                      <input
                        type="text"
                        value={newBusinessTypeName}
                        onChange={(e) => setNewBusinessTypeName(e.target.value)}
                        placeholder="業態名を入力（例：レストラン、カフェ、居酒屋）"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        autoFocus
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleAddBusinessType();
                          }
                        }}
                      />
                      <button
                        onClick={handleAddBusinessType}
                        disabled={!newBusinessTypeName.trim()}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        追加
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingBusinessType(false);
                          setNewBusinessTypeName('');
                        }}
                        className="inline-flex items-center px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Field Configuration Component */}
              <SalesFieldConfiguration
                currentFields={currentFields}
                businessTypeName={getCurrentBusinessTypeName()}
                onFieldsChange={handleFieldsChange}
              />
            </>
          )}
```

**Purpose:** Adds business type selector dropdown and "add new business type" functionality to the fields tab

---

## Summary of Functionality

### Data Flow

1. **Field Configuration Loading:**
   - On **data tab**: Uses the store's business type to load field config
   - On **fields tab**: Uses `selectedBusinessTypeId` to load field config
   - Field configs are stored in localStorage with key `sales-field-configs`

2. **Field Configuration Saving:**
   - On **data tab**: Saves to the store's business type
   - On **fields tab**: Saves to the selected business type
   - Each business type has its own independent field configuration

3. **Business Type Selection:**
   - Dropdown shows all API business types
   - Special option "+ 新しい業態を追加" triggers the add form
   - Auto-selects first business type when switching to fields tab

4. **Adding New Business Types:**
   - Triggered by clicking "業態追加" button or selecting "+ 新しい業態を追加" from dropdown
   - Creates new business type with default field configuration
   - New business types are stored locally (not persisted to server)
   - User is alerted that the business type is local-only

### UI Components Added

1. **Business Type Selector (Line ~355)**
   - Dropdown with icon
   - Shows all available business types
   - Includes "Add New" option

2. **Quick Add Button**
   - Green button with Plus icon
   - Opens the add business type form

3. **Add Business Type Form**
   - Inline form with text input
   - Save and Cancel buttons
   - Enter key submits the form
   - Auto-focuses on input when opened

### State Management

- `selectedBusinessTypeId`: String, stores currently selected business type ID in fields tab
- `isAddingBusinessType`: Boolean, controls visibility of add form
- `newBusinessTypeName`: String, stores input value for new business type name
- All stored in component state, not persisted across page reloads (except selectedBusinessTypeId which is reset on tab change)

### LocalStorage Structure

```typescript
{
  "sales-field-configs": [
    {
      "businessTypeId": "1",
      "businessTypeName": "カフェ",
      "fields": [
        {
          "id": "1-field-0",
          "key": "revenue",
          "label": "売上",
          // ... other field properties
        },
        // ... more fields
      ]
    },
    // ... more business type configs
  ]
}
```

## Testing Checklist

- [ ] Switch to fields tab - first business type should auto-select
- [ ] Change business type in dropdown - field list should update
- [ ] Modify fields for one business type - changes should save
- [ ] Switch to different business type - should show its own fields
- [ ] Click "業態追加" button - form should appear
- [ ] Enter business type name and submit - new business type should be created and selected
- [ ] New business type should have default field configuration
- [ ] Switch back to data tab - should use store's business type for fields
- [ ] Return to fields tab - should remember last selected business type

## Notes

- Business types added through this interface are stored locally only
- To persist to server, admin must manually add them through the system admin interface
- Field configurations are independent per business type
- The data tab always uses the store's assigned business type
- The fields tab allows configuration of any business type independently
