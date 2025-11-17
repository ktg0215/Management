import os

# Read the current file
with open('page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Step 1: Update imports
old_imports = """import React, { useState, useEffect } from 'react';
import { SalesHeader } from '@/components/sales/SalesHeader';
import { SimpleSalesTable } from '@/components/sales/SimpleSalesTable';
import { SimpleSalesForm } from '@/components/sales/SimpleSalesForm';
import { useSalesData, usePrefetchAdjacentMonths } from '@/hooks/queries/useSalesQueries';
import { useAuthStore } from '@/stores/authStore';
import { useStoreStore } from '@/stores/storeStore';
import { formatStoreName } from '@/utils/storeDisplay';"""

new_imports = """import React, { useState, useEffect } from 'react';
import { SalesHeader } from '@/components/sales/SalesHeader';
import { DynamicSalesTable } from '@/components/sales/DynamicSalesTable';
import { DynamicSalesForm } from '@/components/sales/DynamicSalesForm';
import { SalesFieldConfiguration } from '@/components/sales/SalesFieldConfiguration';
import { useSalesData, usePrefetchAdjacentMonths } from '@/hooks/queries/useSalesQueries';
import { useAuthStore } from '@/stores/authStore';
import { useStoreStore } from '@/stores/storeStore';
import { useBusinessTypeStore } from '@/stores/businessTypeStore';
import { formatStoreName } from '@/utils/storeDisplay';
import { SalesFieldConfig, BusinessTypeSalesConfig, DEFAULT_SALES_FIELDS, EDW_SALES_FIELD_CONFIG } from '@/types/sales-field-config';
import { BarChart3, Building2, ChevronDown, Plus, Save } from 'lucide-react';"""

content = content.replace(old_imports, new_imports)

# Write the updated content
with open('page.tsx.updated', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated imports written to page.tsx.updated")
