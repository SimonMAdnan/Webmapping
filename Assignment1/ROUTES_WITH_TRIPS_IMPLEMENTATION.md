# Routes with Trips and Services Implementation

## Overview
Enhanced route visualization that displays routes alongside trips and their associated services. This implementation keeps the existing shapes layer while adding enriched trip and service information to the route popups.

## Data Structure

### GTFS Models Used
- **Route**: Transit route information (route_id, route_type, geometry)
- **Trip**: Individual trip/journey linking routes to services (trip_id, service_id, trip_headsign)
- **Service (Calendar)**: Defines which days service runs (service_id, day flags, date range)
- **Shape**: Route geometry (shape_id, LineString coordinates)

### Relationship Flow
```
Route → Trips → Service (Calendar)
  ↓
Shape (via trip.shape_id)
```

## Implementation Details

### New Functions in `static/js/map.js`

#### 1. `loadRoutesWithTripsAndServices()`
Main async function that:
- Fetches all shapes (routes) from `/api/shapes/?limit=1000`
- For each shape, fetches associated trips via `/api/shapes/trips/?shape_id={shape_id}`
- Groups trips by service_id for organized display
- Creates polylines with enhanced popups showing trip/service details
- Adds layers to appropriate service type layer groups

**Key Features:**
- Displays route short name and long name
- Shows service type with color-coded badge
- Lists all services running on the route
- Groups trips by service_id
- Shows destination headsigns for each service
- Counts trips per service

#### 2. `createRoutePopupWithTrips(routeProps, trips)`
Creates detailed popup content showing:
- Route short name with service type badge
- Route long name description
- Services & Trips section with:
  - Service ID
  - Number of trips for that service
  - Destination headsigns (up to 3 shown, with "more" indicator)

**Popup Structure:**
```
Route 4820 [Bus]
Dublin to Prosperous
────────────────────
Services & Trips:
  Service 43: 5 trips
    ▸ Prosperous
    ▸ Dublin
  Service 44: 3 trips
    ▸ Edenderry
```

#### 3. `getRouteTypeLabel(routeType)`
Utility function mapping route type codes to readable labels:
- 0: Tram
- 1: Subway
- 2: Rail
- 3: Bus
- 4: Ferry
- 5-7: Cable Car, Gondola, Funicular
- 11-12: Trolleybus, Monorail

## API Endpoints Used

### Shapes Endpoint
```
GET /api/shapes/?limit=1000
Response: {
  "results": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [[lon, lat], ...]
      },
      "properties": {
        "shape_id": "4820_3",
        "route_short_name": "4820",
        "route_long_name": "Dublin to Prosperous",
        "route_type": "3",
        "route_id": "4820_106967"
      }
    }
  ]
}
```

### Shape Trips Endpoint
```
GET /api/shapes/trips/?shape_id=4820_3
Response: [
  {
    "route_id": "4820_106967",
    "route_short_name": "4820",
    "route_long_name": "Dublin to Prosperous",
    "route_type": "3",
    "service_id": "43",
    "trip_headsign": "Prosperous"
  }
]
```

## Map Layer Integration

Routes are added to shape-type layers based on route_type:
- **Shapes - Bus**: route_type = 3
- **Shapes - Rail**: route_type = 1, 2
- **Shapes - Tram**: route_type = 0
- **Shapes - Other**: Remaining types

### Layer Toggles (HTML)
All existing layer toggles in the left sidebar continue to work:
- ☑️ Bus Shapes
- ☑️ Rail Shapes
- ☑️ Tram Shapes
- ☑️ Other Shapes

## Visual Representation

### Route Display
- **Color**: Determined by route_type (Bus: yellow, Rail: green, Tram: cyan, etc.)
- **Style**: Dashed polyline (5px dash, 5px gap)
- **Weight**: 3px
- **Opacity**: 0.7 (70%)

### Popup Features
- **Max Height**: 500px (scrollable)
- **Max Width**: 400px
- **Font Size**: 12px for optimal readability
- **Sections**: Route header, services list, trip counts

## Data Flow

```
Map Initialization
    ↓
initMap() called
    ↓
loadRoutesWithTripsAndServices()
    ↓
Fetch all shapes
    ↓
For each shape:
  ├─ Fetch trips for shape_id
  ├─ Group trips by service_id
  ├─ Create polyline with enhanced popup
  └─ Add to appropriate layer
    ↓
Update map with all routes
```

## Performance Considerations

1. **Pagination**: Shapes fetched in single batch (limit=1000), adjusted if needed
2. **API Calls**: One call per shape for trips (can be N+1, but optimized by server)
3. **Grouping**: Done client-side to keep server load minimal
4. **Caching**: Can be extended to cache trips similar to shapes
5. **Memory**: Each route popup is created on-demand (not pre-rendered)

## Browser Console Logs

```
Loading routes with trips and services...
Loaded 847 shapes, fetching trips...
Loaded and displayed 847 route shapes with trips
```

## Backward Compatibility

- Existing `loadShapesAndDisplay()` still available but not called
- All other map functions remain unchanged
- Layer toggles continue to work as before
- Statistics updates unchanged
- Stop markers unchanged (still circles)

## Future Enhancements

1. **Real-time updates**: WebSocket for live trip information
2. **Trip filtering**: Filter by service or destination
3. **Service schedule**: Show calendar dates when service operates
4. **Trip duration**: Display estimated travel time per trip
5. **Vehicle tracking**: Show real-time vehicle position on trips
6. **Advanced caching**: IndexedDB caching for trips data

## Testing

To verify implementation:
1. Open browser DevTools Console
2. Look for "Loading routes with trips and services..." log
3. Click on any route line on the map
4. Popup should show:
   - Route name and type badge
   - Service IDs
   - Trip counts
   - Destination headsigns

## Files Modified

- `static/js/map.js`: Added `loadRoutesWithTripsAndServices()`, `createRoutePopupWithTrips()`, `getRouteTypeLabel()`
- Modified `initMap()` to call new function

## Database Queries Generated

When loading:
- `/api/shapes/` - Single query with pagination
- `/api/shapes/trips/?shape_id=X` - One query per unique shape_id

Both optimized with `select_related()` to prevent N+1 queries.
