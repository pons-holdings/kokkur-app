# Kokkur - Local Culinary Marketplace

## Overview

Kokkur is a two-sided marketplace web application connecting local independent chefs with local customers. The core value proposition is extreme transparency on ingredients/allergens and hyper-local discovery. The application allows buyers to browse local chefs, view their menus with detailed ingredient and allergen information, and place orders for pickup or delivery.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter for client-side routing (lightweight alternative to React Router)
- **State Management**: Zustand for local state (cart, favorites, location) with persist middleware for localStorage
- **Data Fetching**: TanStack React Query for server state management
- **UI Components**: Shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom emerald/slate color theme and CSS variables for theming
- **Icons**: Lucide React

### Backend Architecture
- **Runtime**: Node.js with Express 5
- **Language**: TypeScript with ES modules
- **API Design**: RESTful JSON API with `/api` prefix
- **Build System**: Custom build script using esbuild for server bundling and Vite for client

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` - shared between client and server
- **Migrations**: Drizzle Kit with migrations output to `/migrations`
- **Key Entities**: ChefProfiles, Menus, MenuDaySlots, MenuItems, Ingredients, Allergens, Orders, OrderItems, UserFavorites
- **Join Tables**: ItemIngredients, ItemAllergens, and MenuItemAssignments for many-to-many relationships

### Menu Structure (Day-Based)
- **Menus are Week-Based**: Each menu has a `weekStartDate` representing the Monday of that week
- **Day Slots**: Menus contain `menu_day_slots` - specific days within the week when food is offered
  - Each day slot has a `date` (fulfillment date) and `orderCutoffDate` (last day to order)
- **Item Assignments**: Menu items are assigned to specific day slots via `menu_item_assignments` table
  - Items can be assigned to multiple days across different menus
  - Chef's food items remain separate entities owned by the chef
- **Dashboard Management**: Chefs manage day slots through "Manage Days" dialog, then assign items to each day

### Geo-Location Features
- **Distance Calculations**: geolib library for calculating distances between users and chefs
- **Location Storage**: Client-side zip code to coordinates mapping (no external maps API)
- **Service Radius**: Chefs define service radius for filtering

### Key Design Patterns
- **Shared Types**: Schema definitions in `shared/` directory accessible by both client (`@shared/*`) and server
- **Storage Interface**: `IStorage` interface in `server/storage.ts` abstracts database operations
- **Cart Management**: Single-chef cart policy with modal confirmation when switching chefs
- **Allergen Filtering**: Client-side filtering of menu items based on excluded allergens

### Image Upload (Menu Items)
- **Storage**: Replit Object Storage for file uploads
- **Upload Flow**: Client requests presigned URL from `/api/uploads/request-url`, then uploads directly to storage
- **Validation**: Server-side validation for file type (JPEG, PNG, GIF, WebP) and size (max 10MB)
- **Display**: MenuItemCard component renders image if `imageUrl` exists, falls back to placeholder icon
- **Routes**: Object storage routes in `server/replit_integrations/object_storage/routes.ts`

### Search Functionality
- **Location**: Search bar on home page filters chefs and dishes
- **Matching**: Searches by chef name, cuisine tags, dish titles, descriptions, and ingredients
- **Results**: Shows matching dishes with chef info and links to chef profiles

## External Dependencies

### Database
- PostgreSQL database (connection via `DATABASE_URL` environment variable)
- Drizzle ORM for type-safe database queries
- connect-pg-simple for session storage (if sessions are added)

### Core NPM Packages
- **UI**: @radix-ui/* primitives, class-variance-authority, clsx, tailwind-merge
- **Forms**: react-hook-form with @hookform/resolvers, zod for validation
- **Geo**: geolib for distance calculations
- **Dates**: date-fns for date formatting

### Development Tools
- Vite with React plugin
- Replit-specific plugins for development (error overlay, cartographer, dev banner)
- TypeScript with strict mode enabled