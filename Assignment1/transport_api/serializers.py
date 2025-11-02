"""
Django REST Framework serializers for transport API with spatial support.
"""
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from rest_framework import serializers
from transport_api.models import Route, Stop, SpatialQuery


class RouteSerializer(GeoFeatureModelSerializer):
    """Serializer for Route model with GeoJSON support."""
    class Meta:
        model = Route
        geo_field = 'geometry'
        fields = ['id', 'route_id', 'route_short_name', 'route_long_name', 
                  'route_type', 'operator', 'created_at', 'updated_at']


class StopSerializer(serializers.ModelSerializer):
    """Serializer for Stop model - simple GeoJSON Feature format."""
    type = serializers.SerializerMethodField()
    geometry = serializers.SerializerMethodField()
    properties = serializers.SerializerMethodField()
    
    def get_type(self, obj):
        return 'Feature'
    
    def get_geometry(self, obj):
        """Return GeoJSON geometry."""
        if obj.location:
            return {
                'type': 'Point',
                'coordinates': [obj.location.x, obj.location.y]
            }
        return None
    
    def get_properties(self, obj):
        """Return feature properties."""
        return {
            'id': obj.id,
            'stop_id': obj.stop_id,
            'stop_code': obj.stop_code,
            'stop_name': obj.stop_name,
            'stop_desc': obj.stop_desc or '',
            'stop_type': obj.stop_type or '',
            'wheelchair_boarding': obj.wheelchair_boarding or 0,
        }
    
    class Meta:
        model = Stop
        fields = ['type', 'geometry', 'properties', 'id']


class SpatialQuerySerializer(GeoFeatureModelSerializer):
    """Serializer for saved spatial queries with geometry."""
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
    """Serializer for route shapes as GeoJSON LineStrings."""
    type = serializers.SerializerMethodField()
    geometry = serializers.SerializerMethodField()
    properties = serializers.SerializerMethodField()
    
    def __init__(self, shape_instance, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.shape_instance = shape_instance
    
    def get_type(self, obj):
        return 'Feature'
    
    def get_geometry(self, obj):
        """Return GeoJSON LineString geometry."""
        if hasattr(self.shape_instance, 'geometry') and self.shape_instance.geometry:
            coords = list(self.shape_instance.geometry.coords)
            return {
                'type': 'LineString',
                'coordinates': coords
            }
        return None
    
    def get_properties(self, obj):
        """Return feature properties."""
        shape = self.shape_instance
        route = shape.trip_set.first().route if shape.trip_set.exists() else None
        
        return {
            'shape_id': shape.shape_id,
            'route_id': route.route_id if route else None,
            'route_short_name': route.route_short_name if route else None,
            'route_long_name': route.route_long_name if route else None,
            'route_type': route.route_type if route else None,
        }
    
    class Meta:
        fields = ['type', 'geometry', 'properties']


class TripScheduleSerializer(serializers.Serializer):
    """Serializer for trip schedules at a specific stop."""
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
