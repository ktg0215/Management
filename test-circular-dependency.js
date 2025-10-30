// Test script to verify circular dependency is fixed
const fs = require('fs');
const path = require('path');

console.log('=== Testing Circular Dependency Fix ===\n');

// Check if the shared types file exists
const typesPath = path.join(__dirname, 'next-app/src/types/employee.ts');
if (fs.existsSync(typesPath)) {
  console.log('✅ Shared types file exists: next-app/src/types/employee.ts');
  const typesContent = fs.readFileSync(typesPath, 'utf8');
  if (typesContent.includes('export interface Employee')) {
    console.log('✅ Employee interface is exported from shared types file');
  }
} else {
  console.log('❌ Shared types file not found');
}

// Check authStore imports
const authStorePath = path.join(__dirname, 'next-app/src/stores/authStore.ts');
if (fs.existsSync(authStorePath)) {
  const authStoreContent = fs.readFileSync(authStorePath, 'utf8');
  if (authStoreContent.includes("from '@/types/employee'") || authStoreContent.includes('from "@/types/employee"')) {
    console.log('✅ authStore imports Employee from shared types file');
  } else {
    console.log('❌ authStore does not import from shared types file');
  }

  // Check if there are any imports from api.ts
  if (authStoreContent.includes("from '../lib/api'") || authStoreContent.includes('from "../lib/api"')) {
    console.log('⚠️  authStore imports from api.ts (apiClient)');
  }
}

// Check api.ts imports
const apiPath = path.join(__dirname, 'next-app/src/lib/api.ts');
if (fs.existsSync(apiPath)) {
  const apiContent = fs.readFileSync(apiPath, 'utf8');
  if (apiContent.includes("from '@/types/employee'") || apiContent.includes('from "@/types/employee"')) {
    console.log('✅ api.ts imports Employee from shared types file');
  } else {
    console.log('❌ api.ts does not import from shared types file');
  }

  // Check if there are any imports from authStore
  if (apiContent.includes("from '../stores/authStore'") ||
      apiContent.includes('from "../stores/authStore"') ||
      apiContent.includes("from '@/stores/authStore'") ||
      apiContent.includes('from "@/stores/authStore"')) {
    console.log('❌ CIRCULAR DEPENDENCY: api.ts imports from authStore');
  } else {
    console.log('✅ api.ts does NOT import from authStore (no circular dependency)');
  }
}

// Check sales-management page imports
const pagePath = path.join(__dirname, 'next-app/src/app/admin/sales-management/page.tsx');
if (fs.existsSync(pagePath)) {
  const pageContent = fs.readFileSync(pagePath, 'utf8');
  if (pageContent.includes("from '@/stores/authStore'") || pageContent.includes('from "@/stores/authStore"')) {
    console.log('✅ sales-management page imports from authStore');
  }
}

console.log('\n=== Analysis Complete ===');
console.log('\nThe circular dependency fix involves:');
console.log('1. Creating a shared types file (types/employee.ts)');
console.log('2. Moving Employee interface to the shared file');
console.log('3. Updating authStore.ts to import from types/employee.ts');
console.log('4. Updating api.ts to import from types/employee.ts');
console.log('5. Ensuring api.ts does NOT import from authStore.ts');
