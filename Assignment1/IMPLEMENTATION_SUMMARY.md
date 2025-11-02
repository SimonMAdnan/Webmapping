# K-Nearest and Stops on Route Implementation Summary

## Overview
Successfully implemented two new spatial query features for the Transport Mapping application:
1. **K-Nearest Neighbors Query** - Find k closest stops to a given point
2. **Stops on Route Query** - Find all stops that serve a specific route

---

## Backend Implementation (Django REST Framework)

### 1. K-Nearest Neighbors Query (`/api/stops/k_nearest/`)

**Location**: `transport_api/views.py` - `StopViewSet.k_nearest()` action (lines 112-136)

**Endpoint**: `GET /api/stops/k_nearest/?lat=<float>&lon=<float>&k=<int>`

**Query Parameters**:
- `lat` (required): Latitude of the query point
- `lon` (required): Longitude of the query point  
- `k` (optional, default=5): Number of nearest stops to return (1-20)

**Implementation Details**:
```python
@action(detail=False, methods=['get'])
def k_nearest(self, request):
    """Find k nearest stops to a point. Params: lat, lon, k"""
    # Uses Distance annotation to calculate distance from query point
    # Orders by distance and limits to k results
    # Returns stops in distance order (closest first)
```

**Returns**:
```json
{
    "count": 5,
    "center": {"lat": 53.3498, "lon": -6.2603},
    "k": 5,
    "results": [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [-6.2603, 53.3498]},
            "properties": {
                "stop_id": "1234",
                "stop_name": "Main Street",
                "stop_code": "MS01",
                "latitude": 53.3498,
                "longitude": -6.2603
            }
        }
        // ... more stops
    ]
}
```

### 2. Stops on Route Query (`/api/stops/on_route/`)

**Location**: `transport_api/views.py` - `StopViewSet.on_route()` action (lines 192-241)

**Endpoint**: `GET /api/stops/on_route/?route_id=<string>`

**Query Parameters**:
- `route_id` (required): The ID of the route to get stops for

**Implementation Details**:
```python
@action(detail=False, methods=['get'])
def on_route(self, request):
    """Find all stops on a specific route. Params: route_id"""
    # Gets all stop times for trips on the route
    # Deduplicates stops (a stop may appear in multiple trips)
    # Returns stops ordered by sequence
    # Includes arrival/departure times from trip schedule
```

**Returns**:
```json
{
    "route_id": "ROUTE123",
    "route_short_name": "1A",
    "route_long_name": "Main Line",
    "route_type": "3",
    "stop_count": 15,
    "stops": [
        {
            "stop_id": "STOP001",
            "stop_name": "Central Station",
            "stop_code": "CS",
            "stop_sequence": 1,
            "latitude": 53.3498,
            "longitude": -6.2603,
            "arrival_time": "08:00:00",
            "departure_time": "08:01:00"
        }
        // ... more stops
    ]
}
```

---

## Frontend Implementation

### 1. HTML UI Updates (`templates/map.html`)

**Advanced Tab Redesign**:
- Changed from "Route Analysis" and "Nearest Stops" to clearer labels
- Added "Stops on Route" option (primary)
- Added "K-Nearest Stops" option

**UI Elements**:
- **Stops on Route Section**:
  - Route selector dropdown (auto-populated from backend)
  
- **K-Nearest Stops Section**:
  - Latitude input
  - Longitude input
  - K value input (1-20 stops)

### 2. JavaScript Functions (`static/js/queries.js`)

#### Main Query Functions

**`performAdvancedQuery()`** (lines 498-545):
- Entry point for advanced queries
- Routes to appropriate handler based on query type
- Error handling with user alerts

**`performStopsOnRouteQuery()`** (lines 547-595):
- Fetches stops for selected route from `/api/stops/on_route/`
- Creates markers with sequence numbers as badges
- Markers color-coded: green background with white sequence number
- Displays stops ordered by sequence in results panel
- Interactive: click marker to center map on stop

**`performKNearestQuery()`** (lines 597-640):
- Fetches k nearest stops from `/api/stops/k_nearest/`
- Creates center point marker (red circle at query location)
- Creates numbered markers for each stop (1, 2, 3, etc.) in blue
- Distance shown in stop properties
- Interactive: click marker to center map and zoom to stop

#### Result Display Functions

**`displayStopsOnRouteResults()`** (lines 974-994):
- Shows route information in header (name, type, stop count)
- Lists stops with sequence number, name, and times
- Allows clicking stops to center map

**`displayKNearestResults()`** (lines 996-1023):
- Shows query center point and k value
- Lists stops ranked 1 to k
- Shows distance in kilometers for each stop
- Allows clicking stops to center map

#### Initialization

**`loadRoutesIntoSelector()`** (lines 1038-1056):
- Loads all routes from `/api/routes/` on page load
- Populates route selector dropdown
- Error handling if routes fail to load

**`updateAdvancedOptions()`** (lines 1025-1032):
- Toggles between "Stops on Route" and "K-Nearest Stops" UI
- Shows/hides appropriate input fields

---

## Key Features

### K-Nearest Query
✅ Finds exactly k closest stops to any point  
✅ Returns stops in order by distance (nearest first)  
✅ Distance calculated using PostGIS ST_Distance  
✅ Efficient: uses database-level filtering  
✅ Customizable k value (1-20)  
✅ Shows distance in km for each stop  
✅ Visual ranking with numbered badges (1, 2, 3, etc.)

### Stops on Route Query
✅ Returns all unique stops served by a route  
✅ Maintains stop sequence order  
✅ Includes arrival/departure times from schedule  
✅ Deduplicates stops (multi-trip routes)  
✅ Route metadata included (type, name, etc.)  
✅ Visual ranking with sequence numbers  
✅ Geographic display on map with markers

### User Interface
✅ Intuitive Advanced tab with clear options  
✅ Auto-populated route dropdown  
✅ Real-time coordinate input fields  
✅ Numbered, color-coded markers on map  
✅ Detailed results panel with stop information  
✅ Interactive map: click stops to center and zoom  
✅ Visual feedback with badges and colors

---

## API Usage Examples

### K-Nearest Query Example
```
GET /api/stops/k_nearest/?lat=53.3498&lon=-6.2603&k=5
```

### Stops on Route Query Example
```
GET /api/stops/on_route/?route_id=ROUTE123
```

---

## Database Optimization

Both queries are optimized for database performance:

**K-Nearest**:
- Uses Django's `Distance()` annotation with PostGIS
- Orders at database level before Python slicing
- Efficiently returns top k results

**Stops on Route**:
- Single query with select_related to avoid N+1 problems
- Joins: stop_times → trips → routes
- Deduplication handled efficiently in Python (minimal overhead)

---

## Testing

To test the features:

1. **K-Nearest Query**:
   - Go to Advanced tab → K-Nearest Stops
   - Enter coordinates (e.g., 53.3498, -6.2603)
   - Set k value (e.g., 5)
   - Click Execute
   - Should show 5 nearest stops with distance

2. **Stops on Route Query**:
   - Go to Advanced tab → Stops on Route
   - Select a route from dropdown
   - Click Execute
   - Should show all stops on that route with sequence numbers

---

## Files Modified

### Backend
- `transport_api/views.py` - Added k_nearest() and on_route() actions to StopViewSet

### Frontend
- `templates/map.html` - Updated Advanced tab UI with new query options
- `static/js/queries.js` - Added query functions and result display functions

---

## Future Enhancements

Possible improvements:
- Add time-based filtering to stops-on-route query
- Support for multiple k values or percentile queries
- Export results to GeoJSON
- Integration with real-time vehicle tracking (if re-enabled)
- Advanced filtering (by stop type, wheelchair accessibility, etc.)
- Performance metrics dashboard
