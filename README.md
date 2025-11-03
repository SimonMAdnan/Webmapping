# Transport API - National Transport Network Web Mapping

A Django REST Framework application for visualizing and querying public transport data with interactive mapping capabilities using Leaflet.js and PostGIS spatial queries.

## Features

- **Interactive Map** - Leaflet-based web map for visualizing transport networks
- **Stop Management** - Browse and search public transport stops
- **Route Tracking** - View bus routes and route shapes
- **Spatial Queries**:
  - Radius Search - Find stops within a distance radius
  - Bounding Box - Query stops within geographic bounds
  - K-Nearest - Find k closest stops to a point
  - On Route - Get all stops serving a specific route
- **Auto-Generated API Documentation** - Interactive Swagger UI and ReDoc
- **PostGIS Integration** - Advanced spatial database queries
- **Responsive Design** - Bootstrap 5 styling

## Technology Stack

- **Backend**: Django 5.2.7, Django REST Framework
- **Database**: PostgreSQL with PostGIS spatial extension
- **Frontend**: Leaflet.js, Bootstrap 5, Vanilla JavaScript
- **API Documentation**: drf-spectacular (OpenAPI 3.0)

## Requirements

- Python 3.12+
- PostgreSQL 16+ with PostGIS
- Git

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/SimonMAdnan/Webmapping.git
cd Webmapping/Assignment1
```

### 2. Create Virtual Environment

```bash
# On Windows PowerShell
python -m venv webmapping_env
webmapping_env\Scripts\Activate.ps1

# On Linux/Mac
python3 -m venv webmapping_env
source webmapping_env/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Database Setup

Ensure PostgreSQL is running with PostGIS installed:

```sql
CREATE DATABASE webpmappingdb;
CREATE EXTENSION postgis;
```

Update `Assignment1/settings.py` with your database credentials:

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis',
        'NAME': 'webpmappingdb',
        'USER': 'postgres',
        'PASSWORD': 'your_password',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}
```

### 5. Apply Migrations

```bash
python manage.py migrate
```

### 5.1. Download and Unzip data

Unzip the GTFS_Realtime to get the data
Here: **https://www.transportforireland.ie/transitData/Data/GTFS_Realtime.zip**

### 6. Load GTFS Data

```bash
python manage.py fetch_transport_data
```

This command:
- Reads GTFS data from `GTFS_Realtime/` directory
- Parses stops, routes, shapes, trips, and stop times
- Loads 417+ routes and 9000+ stops into the database

### 7. Create Superuser (Optional)

```bash
python manage.py createsuperuser
```

## Running the Application

### Start the Development Server

```bash
python manage.py runserver
```

The application will be available at: **http://localhost:8000**

### Access the Application

- **Web Map**: http://localhost:8000/
- **Blank Map**: http://localhost:8000/blank/
- **Admin Panel**: http://localhost:8000/admin/

## API Documentation

Interactive API documentation is available at:

- **Swagger UI**: http://localhost:8000/api/docs/
- **ReDoc**: http://localhost:8000/api/redoc/
- **OpenAPI Schema**: http://localhost:8000/api/schema/

### API Endpoints

#### Stops

- `GET /api/stops/` - List all stops
- `GET /api/stops/nearby/` - Find stops within a radius
  - Parameters: `lat`, `lon`, `distance_km` (default: 1.0)
- `GET /api/stops/in_bounds/` - Find stops in bounding box
  - Parameters: `min_lat`, `max_lat`, `min_lon`, `max_lon`
- `GET /api/stops/k_nearest/` - Find k nearest stops
  - Parameters: `lat`, `lon`, `k` (default: 5)
- `GET /api/stops/on_route/` - Get stops on a specific route
  - Parameters: `route_id`

#### Routes

- `GET /api/routes/` - List all routes
- `GET /api/routes/{id}/` - Get route details

#### Shapes

- `GET /api/shapes/` - List all route shapes
- `GET /api/shapes/nearby/` - Find shapes near a point
- `GET /api/shapes/in_bounds/` - Find shapes in bounding box
- `GET /api/shapes/trips/` - Get trips for a shape
- `GET /api/shapes/trip_details/` - Get detailed trip information

## Map Features

### Query Types

1. **Radius Search**
   - Click on the map to set center point
   - Enter radius in kilometers
   - View all stops within the radius

2. **Bounding Box**
   - Click on map to set two corners
   - View all stops within the rectangular area

3. **Advanced Queries**
   - **K-Nearest**: Find the 5 closest stops to a point
   - **Stops on Route**: Select a route and see all stops

### Layer Management

- Toggle different map tile providers (OpenStreetMap, Satellite, Terrain, CartoDB)
- Show/hide stops, routes, and shapes
- Filter routes by type (Bus, Rail, Tram, Ferry)

## Project Structure

```
Assignment1/
├── manage.py
├── requirements.txt
├── GTFS_Realtime/           # GTFS data files
├── Assignment1/
│   ├── settings.py          # Django settings
│   ├── urls.py              # Project URLs
│   ├── wsgi.py
│   └── asgi.py
├── transport_api/
│   ├── models.py            # Stop, Route, Trip models
│   ├── views.py             # API viewsets
│   ├── serializers.py       # DRF serializers
│   ├── urls.py              # API URLs
│   ├── gtfs_parser.py       # GTFS data parser
│   └── management/
│       └── commands/
│           └── fetch_transport_data.py  # Data loading command
├── templates/
│   ├── map.html             # Main map interface
│   └── blank_map.html       # Minimal map
└── static/
    ├── js/
    │   ├── map.js           # Map initialization
    │   ├── layers.js        # Layer configuration
    │   ├── queries.js       # Query execution
    │   └── api.js           # API calls
    └── css/
        └── style.css        # Custom styling
```

## Configuration

### Settings

Key configuration options in `Assignment1/settings.py`:

```python
# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.LimitOffsetPagination',
    'PAGE_SIZE': 10000,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# API Documentation
SPECTACULAR_SETTINGS = {
    'TITLE': 'Transport API',
    'DESCRIPTION': 'API for national transport network with spatial queries',
    'VERSION': '1.0.0',
}
```

## Development

### Running Tests

```bash
python manage.py test transport_api
```

### Creating Migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

## GTFS Data

The application supports GTFS (General Transit Feed Specification) data format. Place GTFS files in the `GTFS_Realtime/` directory:

- `stops.txt` - Stop locations and details
- `routes.txt` - Route information
- `trips.txt` - Trip schedules and routes
- `stop_times.txt` - Stop arrival/departure times
- `shapes.txt` - Route geometry
- `calendar.txt` - Service calendar
- `calendar_dates.txt` - Service date exceptions

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
psql -U postgres -d webpmappingdb

# Reset migrations
python manage.py migrate transport_api zero
python manage.py migrate
```

### GTFS Data Not Loading

```bash
# Check data files exist
ls GTFS_Realtime/

# Run with verbose output
python manage.py fetch_transport_data --verbosity 2
```

### Map Not Displaying

1. Clear browser cache (Ctrl+Shift+Delete)
2. Check browser console for errors (F12)
3. Verify static files are collected:
   ```bash
   python manage.py collectstatic --noinput
   ```

## Performance Optimization

- **Spatial Indexes**: Database uses PostGIS spatial indexes for fast queries
- **Client-Side Caching**: Stop and shape data cached in browser localStorage
- **Pagination**: API results paginated (10,000 items per page)
- **Lazy Loading**: Route data loaded on-demand

## API Examples

### Find 5 Nearest Stops to Dublin City Center

```bash
curl "http://localhost:8000/api/stops/k_nearest/?lat=53.3498&lon=-6.2603&k=5"
```

### Find All Stops Within 1km Radius

```bash
curl "http://localhost:8000/api/stops/nearby/?lat=53.3498&lon=-6.2603&distance_km=1"
```

### Get All Stops on a Route

```bash
curl "http://localhost:8000/api/stops/on_route/?route_id=100"
```

### Python Example

```python
import requests

# Get k-nearest stops
response = requests.get(
    "http://localhost:8000/api/stops/k_nearest/",
    params={
        "lat": 53.3498,
        "lon": -6.2603,
        "k": 5
    }
)

stops = response.json()['results']
for stop in stops:
    print(f"{stop['properties']['stop_name']} - {stop['properties']['distance']}m away")
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

MIT License

## Contact & Support

For issues, questions, or suggestions, please open an issue on GitHub or contact the development team.

## Acknowledgments

- OpenStreetMap contributors
- GTFS Realtime data providers
- Django and DRF communities
- Leaflet.js library
