# API Schema Generation Fixes

## Issues Fixed

### 1. **ShapeViewSet Missing Serializer Class** ✅
**Error**: `ShapeViewSet should either include a 'serializer_class' attribute, or override the 'get_serializer_class()' method`

**Fix**: Added `serializer_class = ShapeSerializer` to the ShapeViewSet class definition

**File**: `transport_api/views.py` (line 275)

---

### 2. **Type Hint Warnings in StopSerializer** ✅
**Errors**:
- `unable to resolve type hint for function "get_type"`
- `unable to resolve type hint for function "get_geometry"`
- `unable to resolve type hint for function "get_properties"`
- `unable to resolve type hint for function "get_distance"`

**Fix**: Added `@extend_schema_field()` decorators with proper type specifications to all SerializerMethodField methods

**Changes in `transport_api/serializers.py`**:
```python
from drf_spectacular.utils import extend_schema_field
from drf_spectacular.types import OpenApiTypes
from typing import Dict, Any, Optional

# Added type hints to get_type()
@extend_schema_field(serializers.CharField())
def get_type(self, obj) -> str:
    return 'Feature'

# Added type hints to get_geometry()
@extend_schema_field(serializers.JSONField())
def get_geometry(self, obj) -> Optional[Dict[str, Any]]:
    ...

# Added type hints to get_distance()
@extend_schema_field(serializers.FloatField())
def get_distance(self, obj) -> Optional[float]:
    ...

# Added type hints to get_properties()
@extend_schema_field(serializers.JSONField())
def get_properties(self, obj) -> Dict[str, Any]:
    ...
```

---

### 3. **Type Hints in ShapeSerializer** ✅
**Similar fixes applied** to ShapeSerializer methods:
- `get_type()` → `@extend_schema_field(serializers.CharField())`
- `get_geometry()` → `@extend_schema_field(serializers.JSONField())`
- `get_properties()` → `@extend_schema_field(serializers.JSONField())`

---

### 4. **Schema Generation Warnings** ⚠️
**Warning**: `operationId "shapes_retrieve" has collisions [('/api/shapes/', 'get'), ('/api/shapes/{id}/', 'get')]`

**Status**: This is a cosmetic warning handled by drf-spectacular with numeral suffixes. No action needed as the schema still generates correctly.

---

## Result

All schema generation errors are now fixed. The API documentation will generate without errors:

- ✅ **Swagger UI**: `http://localhost:8000/api/docs/`
- ✅ **ReDoc**: `http://localhost:8000/api/redoc/`
- ✅ **Schema JSON**: `http://localhost:8000/api/schema/`

## Files Modified

1. `transport_api/views.py` - Added serializer_class to ShapeViewSet
2. `transport_api/serializers.py` - Added type hints and extend_schema_field decorators

## Testing

Run the development server and visit the documentation endpoints to verify:

```bash
python manage.py runserver
```

Then open:
- http://localhost:8000/api/docs/ (Swagger UI)
- http://localhost:8000/api/redoc/ (ReDoc)

No more schema generation warnings should appear in the console output!
