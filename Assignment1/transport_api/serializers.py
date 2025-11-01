"""
Django REST Framework serializers for transport API with spatial support.
"""
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from rest_framework import serializers
from transport_api.models import Vehicle, Route, Stop, SpatialQuery


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


class VehicleSerializer(GeoFeatureModelSerializer):
    """Serializer for Vehicle model with real-time location data."""
    route_short_name = serializers.CharField(source='route.route_short_name', read_only=True)
    route_long_name = serializers.CharField(source='route.route_long_name', read_only=True)
    
    class Meta:
        model = Vehicle
        geo_field = 'location'
        fields = ['id', 'vehicle_id', 'route', 'route_short_name', 'route_long_name',
                  'bearing', 'speed', 'occupancy', 'status', 'timestamp', 'created_at', 'updated_at']


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
