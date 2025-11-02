# API Documentation

This project now includes automatic API documentation generated using **drf-spectacular**.

## Accessing the Documentation

The API documentation is available at three endpoints:

### 1. **Swagger UI** (Interactive Documentation)
- **URL**: `http://localhost:8000/api/docs/`
- **Format**: Interactive Swagger interface
- **Best for**: Testing API endpoints directly from the browser

### 2. **ReDoc** (Alternative Documentation View)
- **URL**: `http://localhost:8000/api/redoc/`
- **Format**: Elegant ReDoc interface
- **Best for**: Reading and understanding API structure

### 3. **OpenAPI Schema** (Raw Schema File)
- **URL**: `http://localhost:8000/api/schema/`
- **Format**: JSON OpenAPI 3.0 specification
- **Best for**: Integration with code generation tools

## API Endpoints

### Stops

#### List All Stops
- **Endpoint**: `GET /api/stops/`
- **Description**: Retrieve all public transport stops
- **Query Parameters**:
  - `limit`: Number of results (default: 10000)
  - `offset`: Pagination offset
  - `search`: Search by stop name, code, or ID

#### Nearby Stops
- **Endpoint**: `GET /api/stops/nearby/`
- **Description**: Find stops within a radius of a geographic point
- **Parameters**:
  - `lat` (required): Latitude coordinate
  - `lon` (required): Longitude coordinate
  - `distance_km` (optional): Search radius in kilometers (default: 1.0)

#### Stops in Bounding Box
- **Endpoint**: `GET /api/stops/in_bounds/`
- **Description**: Find stops within a bounding box
- **Parameters**:
  - `min_lat` (required): Minimum latitude
  - `max_lat` (required): Maximum latitude
  - `min_lon` (required): Minimum longitude
  - `max_lon` (required): Maximum longitude

#### K-Nearest Stops
- **Endpoint**: `GET /api/stops/k_nearest/`
- **Description**: Find the k nearest stops to a geographic point
- **Parameters**:
  - `lat` (required): Latitude coordinate
  - `lon` (required): Longitude coordinate
  - `k` (optional): Number of nearest stops (default: 5)

#### Stops on Route
- **Endpoint**: `GET /api/stops/on_route/`
- **Description**: Find all stops serving a specific route
- **Parameters**:
  - `route_id` (required): The route ID to get stops for

### Routes

#### List All Routes
- **Endpoint**: `GET /api/routes/`
- **Description**: Retrieve all transit routes
- **Query Parameters**:
  - `limit`: Number of results (default: 10000)
  - `offset`: Pagination offset
  - `search`: Search by route name or operator
  - `route_type`: Filter by route type
  - `operator`: Filter by operator

### Shapes

#### List Route Shapes
- **Endpoint**: `GET /api/shapes/`
- **Description**: Retrieve route geometry shapes

## Installation

The API documentation uses the **drf-spectacular** package. To ensure it's installed:

```bash
pip install -r requirements.txt
```

Or install directly:

```bash
pip install drf-spectacular==0.28.0
```

## Configuration

The API documentation is configured in `Assignment1/settings.py`:

```python
INSTALLED_APPS = [
    ...
    'drf_spectacular',
    ...
]

REST_FRAMEWORK = {
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'Transport API',
    'DESCRIPTION': 'API for national transport network with spatial queries',
    'VERSION': '1.0.0',
}
```

## Running the Development Server

```bash
python manage.py runserver
```

Then navigate to:
- Swagger UI: http://localhost:8000/api/docs/
- ReDoc: http://localhost:8000/api/redoc/

## Testing the API

You can test the API endpoints using:

1. **Browser**: Visit the Swagger UI or ReDoc endpoints
2. **cURL**: 
   ```bash
   curl "http://localhost:8000/api/stops/k_nearest/?lat=53.3498&lon=-6.2603&k=5"
   ```
3. **Postman**: Import the OpenAPI schema from `/api/schema/`
4. **Python requests**:
   ```python
   import requests
   response = requests.get("http://localhost:8000/api/stops/k_nearest/", params={
       "lat": 53.3498,
       "lon": -6.2603,
       "k": 5
   })
   print(response.json())
   ```

## Schema Documentation

All endpoints are documented with:
- Detailed descriptions
- Parameter specifications with types
- Example responses
- Error handling information

The schema is automatically generated from your Django REST Framework ViewSets and includes all custom actions like `k_nearest`, `on_route`, etc.

## Further Reading

- [drf-spectacular Documentation](https://drf-spectacular.readthedocs.io/)
- [OpenAPI 3.0 Specification](https://spec.openapis.org/oas/v3.0.3)
- [Swagger/OpenAPI Documentation](https://swagger.io/docs/)
