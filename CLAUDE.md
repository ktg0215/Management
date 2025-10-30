# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **management system** for shift scheduling, sales tracking, and P&L management. The application is a full-stack monorepo with:
- **Frontend**: Next.js 15 (App Router) with TypeScript and Tailwind CSS
- **Backend**: Node.js/Express REST API with PostgreSQL
- **Architecture**: Separated into `next-app/` (frontend) and `backend/` directories

The system supports role-based access (user, admin, super_admin) with JWT authentication.

## Development Commands

### Starting Development Environment

Both frontend and backend must be running simultaneously:

```bash
# Terminal 1 - Backend (runs on port 3001)
cd backend
npm run dev

# Terminal 2 - Frontend (runs on port 3002)
cd next-app
npm run dev
```

Access the application at http://localhost:3002

### Testing & Quality Checks

```bash
# Frontend type checking
cd next-app
npm run type-check

# Frontend linting
npm run lint

# Run all tests
npm run test:all

# Performance testing
npm run performance:simple

# Browser debugging
npm run debug:browser
```

### Database Migrations

```bash
cd backend
npm run migrate:pl   # Run P&L schema migration
```

## Architecture Overview

### Frontend Structure (`next-app/src/`)

**App Router Pages** (`app/`):
- `admin/*` - Admin-only pages (dashboard, sales, shifts, employees, stores, payments, P&L)
- `employee/*` - Employee-facing pages (shift submission, personal dashboard)
- `login/`, `register/` - Authentication pages
- `admin/layout.tsx` - Shared admin layout (automatically applied via Next.js App Router)

**Critical Pattern**: Admin pages should NOT import or wrap content with `AppLayout` component. The `admin/layout.tsx` file automatically applies the layout to all `/admin/*` routes. Double-wrapping causes 404 errors.

**State Management** (`stores/`):
- `authStore.ts` - JWT authentication, user session, role-based permissions
- `storeStore.ts` - Store (shop) data management
- `shiftStore.ts` - Shift period and submission management
- Uses **Zustand** with persistence to localStorage

**API Client** (`lib/api.ts`):
- Centralized API communication layer
- Handles JWT token storage and injection
- Environment-aware base URL configuration
- All backend requests go through this client

**SSR Hydration Pattern**:
- Zustand stores use `skipHydration: true` with manual rehydration
- `ClientLayout.tsx` triggers rehydration on mount
- Always check `isHydrated` state before accessing localStorage

### Backend Structure (`backend/src/`)

**Entry Points**:
- `index.ts` - Main server initialization
- `server.ts` - Express app configuration

**Organization**:
- `controllers/` - Request handlers
- `routes/` - Express route definitions
- `services/` - Business logic layer
- `database/` - PostgreSQL query builders
- `middleware/` - Auth, validation, error handling
- `websocket/` - Real-time communication
- `cache/` - Redis caching layer
- `utils/` - Shared utilities

**Authentication Flow**:
1. User logs in via `/api/auth/login`
2. Backend generates JWT token
3. Token stored in localStorage via `apiClient.setToken()`
4. All subsequent requests include token in Authorization header
5. Backend middleware validates token and attaches user to `req.user`

### Key Architectural Patterns

**Role Hierarchy**:
- `user` (level 1) - Basic employee access
- `admin` (level 2) - Store manager access
- `super_admin` (level 3) - Full system access

Use `hasPermission(requiredRole)` from authStore for permission checks.

**Data Flow**:
```
Component → Store → API Client → Backend Route → Controller → Service → Database
                                        ↓
                                    Middleware (Auth, Validation)
```

**Shift Management System**:
- Shifts are divided into half-month periods (1-15, 16-end)
- `ShiftPeriod` defines submission windows
- `ShiftSubmission` tracks employee submissions
- `ShiftEntry` stores individual work days
- Admins view/export via `/admin/shifts`
- Employees submit via `/employee/shift-submission`

**Sales & P&L Management**:
- Sales data stored per day/month/year
- P&L (Profit & Loss) tracks estimates vs actuals
- Payment management integrated with company master data
- Supports multiple stores with store-specific data isolation

## Important Development Notes

### Next.js App Router Gotchas

1. **Layout Inheritance**: The `admin/layout.tsx` automatically wraps all `/admin/*` pages. Never manually wrap page content with `<AppLayout>`.

2. **Client Components**: Pages that use hooks, state, or browser APIs must have `"use client"` directive at the top.

3. **SSR vs CSR**: Zustand stores need special handling:
   ```typescript
   const [isHydrated, setIsHydrated] = useState(false);

   useEffect(() => {
     setIsHydrated(true);
   }, []);

   if (!isHydrated) return <Loading />;
   ```

### Port Configuration

- Frontend: **3002** (not 3000, customized via `--port 3002`)
- Backend: **3001**
- PostgreSQL: **5432**

### Desktop Project Reference

There is a reference implementation at `C:\Users\ktgsh\Desktop\project` that serves as the source of truth for UI/UX patterns. When implementing features, especially for payments, monthly-sales, and yearly-progress pages, refer to Desktop project for correct layout and functionality.

### Common Pitfalls

1. **404 on Admin Pages**: Check for double `AppLayout` wrapper. Remove imports and wrapper tags from page files.

2. **Hydration Errors**: Always guard localStorage access with `typeof window !== 'undefined'` or `isHydrated` checks.

3. **API Connection Issues**:
   - Verify both backend and frontend are running
   - Check `API_BASE_URL` in console logs
   - Ensure CORS is properly configured in backend

4. **Permission Errors**: Use `hasPermission()` or role-specific checks (`isAdmin()`, `isSuperAdmin()`) from authStore.

5. **Shift Date Fields**: Shift entries use `work_date` field (not `date`). Always reference correct field name when working with shift data.

## Environment Variables

Frontend (`next-app/.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Backend (environment-specific):
- Database connection details
- JWT secret
- Redis configuration (if using cache)

## Testing Approach

- **Type Safety**: Run `npm run type-check` before committing
- **Linting**: Fix ESLint warnings with `npm run lint`
- **Browser Testing**: Use chrome-debugger agent or manual testing at localhost:3002
- **Performance**: Run `npm run performance:simple` to check page load times

## Git Workflow

When making commits:
1. Test changes in browser
2. Run type-check and lint
3. Create meaningful commit messages
4. For PR creation, include test plan and summary of changes
5. Commit messages should end with:
   ```
   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>
   ```
