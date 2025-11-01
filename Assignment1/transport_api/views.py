"""
Django REST Framework views for transport API with advanced spatial queries.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.gis.measure import D
from django.contrib.gis.geos import Point, Polygon
from django.contrib.gis.db.models.functions import Distance
from django.views.generic import TemplateView
from django.shortcuts import render
from transport_api.models import Vehicle, Route, Stop, SpatialQuery
from transport_api.serializers import (
    VehicleSerializer, RouteSerializer, StopSerializer, 
    SpatialQuerySerializer, SpatialSearchSerializer,
    ShapeSerializer, TripScheduleSerializer
)
from transport_api.models import Trip, StopTime, Shape


class MapView(TemplateView):
    """Main map view with Leaflet integration."""
    template_name = 'map.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['api_base_url'] = '/api'
        return context


class BlankMapView(TemplateView):
    """Blank map view with no data loaded - for clean development."""
    template_name = 'blank_map.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        return context

class StopViewSet(viewsets.ModelViewSet):
    """ViewSet for public transport stops with spatial queries."""
    queryset = Stop.objects.all()
    serializer_class = StopSerializer
    filter_backends = [SearchFilter, OrderingFilter, DjangoFilterBackend]
    search_fields = ['stop_name', 'stop_code', 'stop_id']
    ordering_fields = ['stop_name', 'created_at']
    ordering = ['stop_name']

    @action(detail=False, methods=['get'])
    def nearby(self, request):
        """Find stops near a point. Params: lat, lon, distance_km"""
        lat = request.query_params.get('lat')
        lon = request.query_params.get('lon')
        distance_km = float(request.query_params.get('distance_km', 1.0))

        if not lat or not lon:
            return Response({'error': 'lat and lon required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            lat, lon = float(lat), float(lon)
            point = Point(lon, lat)
            stops = Stop.objects.filter(
                location__distance_lte=(point, D(km=distance_km))
            ).annotate(
                distance=Distance('location', point)
            ).order_by('distance')
            
            serializer = self.get_serializer(stops, many=True)
            return Response({
                'count': stops.count(),
                'center': {'lat': lat, 'lon': lon},
                'radius_km': distance_km,
                'results': serializer.data
            })
        except (ValueError, TypeError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def in_bounds(self, request):
        """Find stops within a bounding box. Params: min_lat, max_lat, min_lon, max_lon"""
        min_lat = request.query_params.get('min_lat')
        max_lat = request.query_params.get('max_lat')
        min_lon = request.query_params.get('min_lon')
        max_lon = request.query_params.get('max_lon')

        if not all([min_lat, max_lat, min_lon, max_lon]):
            return Response({'error': 'All bounds parameters required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            min_lat, max_lat = float(min_lat), float(max_lat)
            min_lon, max_lon = float(min_lon), float(max_lon)
            
            bounds = Polygon([
                (min_lon, min_lat),
                (max_lon, min_lat),
                (max_lon, max_lat),
                (min_lon, max_lat),
                (min_lon, min_lat),
            ])
            stops = Stop.objects.filter(location__within=bounds)
            serializer = self.get_serializer(stops, many=True)
            return Response({
                'count': stops.count(),
                'bounds': {'min_lat': min_lat, 'max_lat': max_lat, 'min_lon': min_lon, 'max_lon': max_lon},
                'results': serializer.data
            })
        except (ValueError, TypeError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def nearby_stops(self, request, pk=None):
        """Get stops near a specific stop."""
        stop = self.get_object()
        distance_km = float(request.query_params.get('distance_km', 1.0))
        
        nearby = Stop.objects.filter(
            location__distance_lte=(stop.location, D(km=distance_km))
        ).exclude(id=stop.id).annotate(
            distance=Distance('location', stop.location)
        ).order_by('distance')
        
        serializer = self.get_serializer(nearby, many=True)
        return Response({
            'center_stop': StopSerializer(stop).data,
            'nearby_count': nearby.count(),
            'distance_km': distance_km,
            'results': serializer.data
        })

    @action(detail=True, methods=['get'])
    def schedules(self, request, pk=None):
        """Get trip schedules for a specific stop."""
        stop = self.get_object()
        
        # Get all stop times for this stop, ordered by arrival time
        stop_times = StopTime.objects.filter(stop=stop).select_related(
            'trip', 'trip__route'
        ).order_by('arrival_time')
        
        schedules = []
        for st in stop_times:
            schedules.append({
                'trip_id': st.trip.trip_id,
                'route_id': st.trip.route.route_id,
                'route_short_name': st.trip.route.route_short_name,
                'route_long_name': st.trip.route.route_long_name,
                'trip_headsign': st.trip.trip_headsign or '',
                'arrival_time': st.arrival_time,
                'departure_time': st.departure_time,
                'stop_sequence': st.stop_sequence,
            })
        
        return Response({
            'stop_id': stop.stop_id,
            'stop_name': stop.stop_name,
            'schedule_count': len(schedules),
            'schedules': schedules
        })


class ShapeViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for route shapes as GeoJSON LineStrings."""
    queryset = Shape.objects.all()
    pagination_class = None  # No pagination for shapes
    
    def list(self, request, *args, **kwargs):
        """Return all shapes as GeoJSON Features."""
        # Get limit from query params
        limit = request.query_params.get('limit', None)
        offset = int(request.query_params.get('offset', 0))
        
        all_shapes = self.get_queryset()
        
        if limit:
            limit = int(limit)
            shapes = all_shapes[offset:offset + limit]
        else:
            shapes = all_shapes[offset:]
        
        # Preload all trips with routes to avoid N+1 queries
        shape_ids = [s.shape_id for s in shapes]
        trips_by_shape = {}
        for trip in Trip.objects.filter(shape_id__in=shape_ids).select_related('route').only(
            'shape_id', 'route__route_id', 'route__route_short_name', 'route__route_long_name', 'route__route_type'
        ):
            if trip.shape_id not in trips_by_shape:
                trips_by_shape[trip.shape_id] = trip
        
        features = []
        
        for shape in shapes:
            if shape.geometry and len(shape.geometry.coords) > 0:
                # Get route info from preloaded trips
                trip = trips_by_shape.get(shape.shape_id)
                route = trip.route if trip else None
                
                coords = list(shape.geometry.coords)
                feature = {
                    'type': 'Feature',
                    'geometry': {
                        'type': 'LineString',
                        'coordinates': coords
                    },
                    'properties': {
                        'shape_id': shape.shape_id,
                        'route_id': route.route_id if route else None,
                        'route_short_name': route.route_short_name if route else None,
                        'route_long_name': route.route_long_name if route else None,
                        'route_type': route.route_type if route else None,
                    }
                }
                features.append(feature)
        
        return Response({
            'count': all_shapes.count(),
            'offset': offset,
            'limit': limit,
            'results': features
        })

    @action(detail=False, methods=['get'])
    def trips(self, request):
        """Get trips for a specific shape. Params: shape_id"""
        shape_id = request.query_params.get('shape_id')
        
        if not shape_id:
            return Response({'error': 'shape_id required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get all unique routes that use this shape
        trips = Trip.objects.filter(shape_id=shape_id).select_related('route').values_list(
            'route_id', 'route__route_short_name', 'route__route_long_name', 'route__route_type'
        )
        
        # Deduplicate in Python
        seen = set()
        data = []
        for route_id, route_short_name, route_long_name, route_type in trips:
            key = (route_id, route_short_name, route_long_name, route_type)
            if key not in seen:
                seen.add(key)
                data.append({
                    'route_id': route_id,
                    'route_short_name': route_short_name,
                    'route_long_name': route_long_name,
                    'route_type': route_type,
                    'shape_id': shape_id,
                })
        
        return Response(data)


class VehicleViewSet(viewsets.ModelViewSet):
    """ViewSet for real-time vehicle tracking with spatial queries."""
    queryset = Vehicle.objects.all()
    serializer_class = VehicleSerializer
    filter_backends = [SearchFilter, OrderingFilter, DjangoFilterBackend]
    search_fields = ['vehicle_id', 'route__route_short_name']
    ordering_fields = ['timestamp', 'speed']
    ordering = ['-timestamp']
    filterset_fields = ['route', 'status']

    @action(detail=False, methods=['get'])
    def nearby_vehicles(self, request):
        """Find vehicles near a point. Params: lat, lon, distance_km"""
        lat = request.query_params.get('lat')
        lon = request.query_params.get('lon')
        distance_km = float(request.query_params.get('distance_km', 2.0))

        if not lat or not lon:
            return Response({'error': 'lat and lon required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            lat, lon = float(lat), float(lon)
            point = Point(lon, lat)
            vehicles = Vehicle.objects.filter(
                location__distance_lte=(point, D(km=distance_km))
            ).annotate(
                distance=Distance('location', point)
            ).order_by('distance')
            
            serializer = self.get_serializer(vehicles, many=True)
            return Response({
                'count': vehicles.count(),
                'center': {'lat': lat, 'lon': lon},
                'radius_km': distance_km,
                'results': serializer.data
            })
        except (ValueError, TypeError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def in_bounds(self, request):
        """Get vehicles within a bounding box. Params: min_lat, max_lat, min_lon, max_lon"""
        min_lat = request.query_params.get('min_lat')
        max_lat = request.query_params.get('max_lat')
        min_lon = request.query_params.get('min_lon')
        max_lon = request.query_params.get('max_lon')

        if not all([min_lat, max_lat, min_lon, max_lon]):
            return Response({'error': 'All bounds parameters required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            min_lat, max_lat = float(min_lat), float(max_lat)
            min_lon, max_lon = float(min_lon), float(max_lon)
            
            bounds = Polygon([
                (min_lon, min_lat),
                (max_lon, min_lat),
                (max_lon, max_lat),
                (min_lon, max_lat),
                (min_lon, min_lat),
            ])
            vehicles = Vehicle.objects.filter(location__within=bounds)
            serializer = self.get_serializer(vehicles, many=True)
            return Response({
                'count': vehicles.count(),
                'bounds': {'min_lat': min_lat, 'max_lat': max_lat, 'min_lon': min_lon, 'max_lon': max_lon},
                'results': serializer.data
            })
        except (ValueError, TypeError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def congestion(self, request):
        """Identify congestion areas (clusters of slow vehicles)."""
        min_vehicles = int(request.query_params.get('min_vehicles', 3))
        max_speed_kmh = float(request.query_params.get('max_speed_kmh', 10.0))
        distance_km = float(request.query_params.get('distance_km', 0.5))

        slow_vehicles = Vehicle.objects.filter(
            speed__lte=max_speed_kmh, status='in_transit'
        ) | Vehicle.objects.filter(speed__isnull=True, status='in_transit')

        congestion_zones = []
        processed = set()
        
        for vehicle in slow_vehicles:
            if vehicle.id in processed:
                continue
            
            nearby = slow_vehicles.filter(
                location__distance_lte=(vehicle.location, D(km=distance_km))
            ).exclude(id__in=processed)
            
            if nearby.count() >= min_vehicles:
                serializer = self.get_serializer(nearby, many=True)
                congestion_zones.append({
                    'center': {
                        'lat': vehicle.location.y,
                        'lon': vehicle.location.x
                    },
                    'vehicle_count': nearby.count(),
                    'max_speed_kmh': max_speed_kmh,
                    'vehicles': serializer.data
                })
                processed.update(nearby.values_list('id', flat=True))

        return Response({
            'congestion_zones': congestion_zones,
            'total_slow_vehicles': slow_vehicles.count()
        })

    @action(detail=True, methods=['get'])
    def nearby_stops(self, request, pk=None):
        """Get stops near a vehicle."""
        vehicle = self.get_object()
        distance_km = float(request.query_params.get('distance_km', 0.5))
        
        stops = Stop.objects.filter(
            location__distance_lte=(vehicle.location, D(km=distance_km))
        ).annotate(
            distance=Distance('location', vehicle.location)
        ).order_by('distance')
        
        serializer = StopSerializer(stops, many=True)
        return Response({
            'vehicle': VehicleSerializer(vehicle).data,
            'nearby_stops_count': stops.count(),
            'distance_km': distance_km,
            'results': serializer.data
        })


class RouteViewSet(viewsets.ModelViewSet):
    """ViewSet for transit routes with spatial geometry."""
    queryset = Route.objects.all()
    serializer_class = RouteSerializer
    filter_backends = [SearchFilter, OrderingFilter, DjangoFilterBackend]
    search_fields = ['route_short_name', 'route_long_name', 'operator']
    ordering_fields = ['route_short_name', 'operator']
    ordering = ['route_short_name']
    filterset_fields = ['route_type', 'operator']


class SpatialQueryViewSet(viewsets.ModelViewSet):
    """ViewSet for managing saved spatial queries."""
    queryset = SpatialQuery.objects.all()
    serializer_class = SpatialQuerySerializer
    filter_backends = [SearchFilter, OrderingFilter, DjangoFilterBackend]
    search_fields = ['name', 'description']
    ordering_fields = ['created_at', 'name']
    ordering = ['-created_at']
    filterset_fields = ['query_type']
