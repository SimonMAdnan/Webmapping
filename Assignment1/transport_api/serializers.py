"""
Django REST Framework serializers for transport API with spatial support.

Serializers handle:
- Data transformation between models and JSON/GeoJSON
- GeoJSON Feature format generation for map visualization
- Type hints for API schema generation
- Distance calculation for spatial queries
"""
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from drf_spectacular.types import OpenApiTypes
from transport_api.models import Route, Stop, SpatialQuery, Shape
from typing import Dict, Any, Optional


class RouteSerializer(GeoFeatureModelSerializer):
    """
    Serializer for Route model with GeoJSON support.
    
    Converts Route objects to GeoJSON Feature format with geometry.
    Used for rendering route lines on the map.
    """
    class Meta:
        model = Route
        geo_field = 'geometry'
        fields = ['id', 'route_id', 'route_short_name', 'route_long_name', 
                  'route_type', 'operator', 'created_at', 'updated_at']


class StopSerializer(serializers.ModelSerializer):
    """
    Serializer for Stop model - GeoJSON Feature format.
    
    Converts Stop objects to GeoJSON Feature format with:
    - Point geometry (longitude, latitude)
    - Stop properties (name, code, type, etc.)
    - Optional distance field (for spatial queries)
    - Accessibility information
    
    Handles both regular list output and spatial query results.
    """
    type = serializers.SerializerMethodField()
    geometry = serializers.SerializerMethodField()
    properties = serializers.SerializerMethodField()
    distance = serializers.SerializerMethodField()
    
    @extend_schema_field(serializers.CharField())
    def get_type(self, obj) -> str:
        return 'Feature'
    
    @extend_schema_field(serializers.JSONField())
    def get_geometry(self, obj) -> Optional[Dict[str, Any]]:
        """Return GeoJSON geometry."""
        if obj.location:
            return {
                'type': 'Point',
                'coordinates': [obj.location.x, obj.location.y]
            }
        return None
    
    @extend_schema_field(serializers.FloatField())
    def get_distance(self, obj) -> Optional[float]:
        """Return distance if annotated, otherwise None."""
        if hasattr(obj, 'distance') and obj.distance:
            # Return distance in meters
            return obj.distance.m
        return None
    
    @extend_schema_field(serializers.JSONField())
    def get_properties(self, obj) -> Dict[str, Any]:
        """Return feature properties."""
        props = {
            'id': obj.id,
            'stop_id': obj.stop_id,
            'stop_code': obj.stop_code,
            'stop_name': obj.stop_name,
            'stop_desc': obj.stop_desc or '',
            'stop_type': obj.stop_type or '',
            'wheelchair_boarding': obj.wheelchair_boarding or 0,
        }
        # Add distance to properties if available
        if hasattr(obj, 'distance') and obj.distance:
            props['distance'] = obj.distance.m
        return props
    
    class Meta:
        model = Stop
        fields = ['type', 'geometry', 'properties', 'id', 'distance']


class SpatialQuerySerializer(GeoFeatureModelSerializer):
    """
    Serializer for saved spatial queries with geometry.
    
    Stores and retrieves spatial query definitions with:
    - Query geometry (point, polygon, or bounding box)
    - Query type and parameters
    - Creator information and timestamps
    """
    class Meta:
        model = SpatialQuery
        geo_field = 'geometry'
        fields = ['id', 'name', 'description', 'query_type', 'parameters', 
                  'created_by', 'created_at', 'updated_at']


class SpatialSearchSerializer(serializers.Serializer):
    """Serializer for spatial search request parameters."""
    query_type = serializers.ChoiceField(
        choices=['radius', 'bbox', 'polygon'],
        help_text='Type of spatial query'
    )
    latitude = serializers.FloatField(required=False)
    longitude = serializers.FloatField(required=False)
    radius_km = serializers.FloatField(required=False, default=1.0)
    min_lat = serializers.FloatField(required=False)
    max_lat = serializers.FloatField(required=False)
    min_lon = serializers.FloatField(required=False)
    max_lon = serializers.FloatField(required=False)
    polygon = serializers.JSONField(required=False)
    include_nearby = serializers.BooleanField(default=True)
    
    def validate(self, data):
        query_type = data.get('query_type')
        
        if query_type == 'radius':
            if not data.get('latitude') or not data.get('longitude'):
                raise serializers.ValidationError("Latitude and longitude required")
        elif query_type == 'bbox':
            required_fields = ['min_lat', 'max_lat', 'min_lon', 'max_lon']
            if not all(data.get(f) is not None for f in required_fields):
                raise serializers.ValidationError("All bbox coordinates required")
        elif query_type == 'polygon':
            if not data.get('polygon'):
                raise serializers.ValidationError("Polygon coordinates required")
        
        return data


class ShapeSerializer(serializers.Serializer):
    """
    Serializer for route shapes as GeoJSON LineStrings.
    
    Converts Shape objects to GeoJSON Feature format with:
    - LineString geometry (sequence of lat/lon coordinates)
    - Associated route information
    - Route type and short name for categorization
    
    Used for rendering route paths on the map.
    """
    type = serializers.SerializerMethodField()
    geometry = serializers.SerializerMethodField()
    properties = serializers.SerializerMethodField()
    
    @extend_schema_field(serializers.CharField())
    def get_type(self, obj) -> str:
        return 'Feature'
    
    @extend_schema_field(serializers.JSONField())
    def get_geometry(self, obj) -> Optional[Dict[str, Any]]:
        """Return GeoJSON LineString geometry."""
        if obj.geometry and len(obj.geometry.coords) > 0:
            coords = list(obj.geometry.coords)
            return {
                'type': 'LineString',
                'coordinates': coords
            }
        return None
    
    @extend_schema_field(serializers.JSONField())
    def get_properties(self, obj) -> Dict[str, Any]:
        """Return feature properties."""
        # Get route info from first trip that uses this shape
        route = None
        trip = obj.trip_set.first() if hasattr(obj, 'trip_set') else None
        if trip:
            route = trip.route
        
        return {
            'shape_id': obj.shape_id,
            'route_id': route.route_id if route else None,
            'route_short_name': route.route_short_name if route else None,
            'route_long_name': route.route_long_name if route else None,
            'route_type': route.route_type if route else None,
        }
    
    class Meta:
        model = Shape
        fields = ['type', 'geometry', 'properties', 'id', 'shape_id']


class TripScheduleSerializer(serializers.Serializer):
    """
    Serializer for trip schedules at a specific stop.
    
    Provides schedule information for trips passing through a stop:
    - Route and trip identifiers
    - Arrival and departure times
    - Stop sequence (order within route)
    
    Used for displaying transit schedules in the UI.
    """
    trip_id = serializers.CharField()
    route_id = serializers.CharField()
    route_short_name = serializers.CharField()
    route_long_name = serializers.CharField()
    trip_headsign = serializers.CharField()
    arrival_time = serializers.TimeField(format='%H:%M:%S')
    departure_time = serializers.TimeField(format='%H:%M:%S')
    stop_sequence = serializers.IntegerField()
    
    class Meta:
        fields = ['trip_id', 'route_id', 'route_short_name', 'route_long_name',
                  'trip_headsign', 'arrival_time', 'departure_time', 'stop_sequence']
