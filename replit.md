# Kokkur - Local Culinary Marketplace

## Overview

Kokkur is a two-sided marketplace web application connecting local independent chefs with local customers. The core value proposition is extreme transparency on ingredients/allergens and hyper-local discovery. The application uses a calendar-based architecture where chefs select dates and assign food items directly to those days, creating dynamic date-based offerings rather than static menus.

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
- **Key Entities**: ChefProfiles, DaySlots, MenuItems, Ingredients, Allergens, Orders, OrderItems, ServingOptions, ItemPhotos
- **Join Tables**: ItemIngredients, ItemAllergens, IngredientAllergens, MenuItemAssignments

### New Serving Options System
- **Multiple Prices per Item**: Each menu item can have multiple serving options (e.g., "1 serving" at $9.99, "4 servings" at $29.99)
- **ServingOption Table**: Contains menuItemId, servingSize, label, price, and isDefault flag
- **Price Display**: Frontend shows price range (e.g., "$9.99 - $29.99") or default serving price
- **Order Integration**: Customers select a serving option when adding to cart

### Per-Day Stock Management
- **Stock at Assignment Level**: Stock is tracked per day-slot assignment, not per menu item
- **MenuItemAssignment Table**: Contains stockLimited (boolean), stockQuantity (nullable integer)
- **Flexibility**: Same item can have different stock limits on different days

### Multiple Photos per Item
- **ItemPhotos Table**: Contains menuItemId, imageUrl, isCover flag, sortOrder
- **Cover Photo**: One photo can be marked as cover for display in listings
- **Photo Management**: Routes for adding/removing photos and setting cover

### Ingredient-Allergen Mapping
- **Auto-Select Allergens**: When ingredients are added to a dish, related allergens are automatically suggested
- **IngredientAllergens Table**: Maps ingredients to their associated allergens
- **Comprehensive Allergen List**: FDA Big 9 + EU common allergens (15 total)

### Calendar-Based Scheduling System
- **Day Slots**: Chefs create day slots directly (no menus) - each representing a date when food is offered
  - Each day slot has a `date` (fulfillment date) and `orderCutoffDate` (last day to order)
  - Day slots belong directly to chefs via `chefId`
- **Item Assignments**: Menu items are assigned to specific day slots via `menu_item_assignments` table
  - Items can be assigned to multiple days
  - Each assignment can have per-day stock settings
  - Chef's food items remain separate entities owned by the chef
- **Dashboard Calendar View**: 
  - "My Schedule" tab shows upcoming 14 days in a calendar format
  - Chefs click days to expand and manage offerings for that date
  - Items can be assigned/unassigned to specific dates
  - Search functionality for finding items to assign

### Geo-Location Features
- **Distance Calculations**: geolib library for calculating distances between users and chefs
- **Location Storage**: Client-side zip code to coordinates mapping (no external maps API)
- **Service Radius**: Chefs define service radius for filtering

### Key Design Patterns
- **Shared Types**: Schema definitions in `shared/` directory accessible by both client (`@shared/*`) and server
- **Storage Interface**: `IStorage` interface in `server/storage.ts` abstracts database operations
- **Cart Management**: Single-chef cart policy with modal confirmation when switching chefs
- **Allergen Filtering**: Client-side filtering of menu items based on excluded allergens
- **Boolean Fields**: PostgreSQL stores booleans as integers (0/1) for compatibility

### Type Definitions
- **MenuItemWithDetails**: Includes servingOptions[], photos[], coverPhoto (string), ingredients[], allergens[]
- **ChefProfileWithDaySlots**: Chef profile with daySlots array containing DaySlotWithItems
- **DaySlotWithItems**: Day slot with items array of MenuItemWithDetails
- **IngredientWithAllergens**: Ingredient with associated allergens array

### Image Upload (Menu Items)
- **Storage**: Replit Object Storage for file uploads
- **Upload Flow**: Client requests presigned URL from `/api/uploads/request-url`, then uploads directly to storage
- **Validation**: Server-side validation for file type (JPEG, PNG, GIF, WebP) and size (max 10MB)
- **Multiple Photos**: Support for multiple photos per item with cover selection
- **Routes**: Object storage routes in `server/replit_integrations/object_storage/routes.ts`

### Search Functionality
- **Location**: Search bar on home page filters chefs and dishes
- **Matching**: Searches by chef name, cuisine tags, dish titles, descriptions, and ingredients
- **Results**: Shows matching dishes with chef info and links to chef profiles
- **Ingredient Search**: Type-ahead search for ingredients with ability to add new ones

## API Routes

### Ingredients
- `GET /api/ingredients?search=query` - Search ingredients with optional query parameter
- `POST /api/ingredients` - Create new ingredient
- `GET /api/ingredients-with-allergens` - Get all ingredients with their allergen mappings

### Item Photos
- `GET /api/menu-items/:itemId/photos` - Get all photos for an item
- `POST /api/menu-items/:itemId/photos` - Add a photo to an item
- `DELETE /api/photos/:photoId` - Delete a photo
- `POST /api/menu-items/:itemId/photos/:photoId/set-cover` - Set a photo as cover

### Day Slot Assignments
- `POST /api/day-slots/:daySlotId/items/:itemId` - Assign item with stock settings
- `PATCH /api/day-slots/:daySlotId/items/:itemId` - Update assignment stock settings
- `GET /api/day-slots/:daySlotId/items/:itemId` - Get assignment details
- `DELETE /api/day-slots/:daySlotId/items/:itemId` - Remove assignment

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
