"""
Transport mapping models using GeoDjango for spatial queries.
Models for vehicles, routes, and stops from National Transport API.
"""
from django.contrib.gis.db import models


class Agency(models.Model):
    """
    Transit agency/operator information from GTFS.
    """
    agency_id = models.CharField(max_length=100, unique=True)
    agency_name = models.CharField(max_length=255)
    agency_url = models.URLField(blank=True)
    agency_timezone = models.CharField(max_length=50, blank=True)
    agency_lang = models.CharField(max_length=10, blank=True)
    agency_phone = models.CharField(max_length=50, blank=True)
    agency_fare_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['agency_name']
        verbose_name_plural = 'Agencies'

    def __str__(self):
        return self.agency_name


class Calendar(models.Model):
    """
    Service calendar from GTFS - defines which days service runs.
    """
    service_id = models.CharField(max_length=100, unique=True)
    monday = models.BooleanField(default=False)
    tuesday = models.BooleanField(default=False)
    wednesday = models.BooleanField(default=False)
    thursday = models.BooleanField(default=False)
    friday = models.BooleanField(default=False)
    saturday = models.BooleanField(default=False)
    sunday = models.BooleanField(default=False)
    start_date = models.DateField()
    end_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['service_id']
        verbose_name_plural = 'Calendars'

    def __str__(self):
        return f"Service {self.service_id}"


class Shape(models.Model):
    """
    Shape geometry for routes from GTFS - defines the actual path of a route.
    """
    shape_id = models.CharField(max_length=100)
    geometry = models.LineStringField()
    sequence = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['shape_id', 'sequence']
        unique_together = ('shape_id', 'sequence')
        indexes = [
            models.Index(fields=['shape_id']),
        ]

    def __str__(self):
        return f"Shape {self.shape_id} - Point {self.sequence}"


class Trip(models.Model):
    """
    Individual trip/journey from GTFS - links a route to a service pattern.
    """
    # Use string reference to avoid NameError if Route is defined later in the file
    route = models.ForeignKey('Route', on_delete=models.CASCADE, related_name='trips')
    service_id = models.CharField(max_length=100)
    trip_id = models.CharField(max_length=100, unique=True)
    trip_headsign = models.CharField(max_length=255, blank=True)
    direction_id = models.IntegerField(choices=[(0, 'One direction'), (1, 'Opposite direction')], default=0)
    shape_id = models.CharField(max_length=100, blank=True)
    wheelchair_accessible = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['trip_id']
        indexes = [
            models.Index(fields=['trip_id']),
            models.Index(fields=['route']),
            models.Index(fields=['service_id']),
        ]

    def __str__(self):
        return f"Trip {self.trip_id} on Route {self.route.route_short_name}"


class StopTime(models.Model):
    """
    Stop times for each trip from GTFS - when a trip arrives/departs at each stop.
    """
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='stop_times')
    stop = models.ForeignKey('Stop', on_delete=models.CASCADE, related_name='stop_times')
    stop_sequence = models.IntegerField()
    arrival_time = models.TimeField(null=True, blank=True)
    departure_time = models.TimeField(null=True, blank=True)
    stop_headsign = models.CharField(max_length=255, blank=True)
    pickup_type = models.IntegerField(
        choices=[
            (0, 'Regular'),
            (1, 'No pickup'),
            (2, 'Phone agency'),
            (3, 'Coordinate with driver'),
        ],
        default=0
    )
    drop_off_type = models.IntegerField(
        choices=[
            (0, 'Regular'),
            (1, 'No drop-off'),
            (2, 'Phone agency'),
            (3, 'Coordinate with driver'),
        ],
        default=0
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['trip', 'stop_sequence']
        unique_together = ('trip', 'stop_sequence')
        indexes = [
            models.Index(fields=['trip']),
            models.Index(fields=['stop']),
        ]

    def __str__(self):
        return f"{self.trip.trip_id} Stop #{self.stop_sequence}"


class Route(models.Model):
    """
    Represents a public transport route.
    Stores route information and spatial geometry.
    """
    route_id = models.CharField(max_length=100, unique=True)
    route_short_name = models.CharField(max_length=50)
    route_long_name = models.CharField(max_length=255)
    route_type = models.CharField(
        max_length=50,
        choices=[
            ('0', 'Tram'),
            ('1', 'Subway'),
            ('2', 'Rail'),
            ('3', 'Bus'),
            ('4', 'Ferry'),
        ]
    )
    operator = models.CharField(max_length=100, blank=True)
    geometry = models.LineStringField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['route_short_name']
        indexes = [
            models.Index(fields=['route_id']),
            models.Index(fields=['operator']),
        ]

    def __str__(self):
        return f"{self.route_short_name} - {self.route_long_name}"


class Stop(models.Model):
    """
    Represents a public transport stop/station.
    Stores stop location and metadata.
    """
    stop_id = models.CharField(max_length=100, unique=True)
    stop_code = models.CharField(max_length=50, blank=True)
    stop_name = models.CharField(max_length=255)
    stop_desc = models.TextField(blank=True)
    location = models.PointField()
    stop_type = models.CharField(
        max_length=50,
        choices=[
            ('station', 'Station'),
            ('stop', 'Stop'),
            ('terminal', 'Terminal'),
        ],
        default='stop'
    )
    wheelchair_boarding = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['stop_name']
        indexes = [
            models.Index(fields=['stop_id']),
            models.Index(fields=['stop_name']),
        ]

    def __str__(self):
        return self.stop_name

    def get_nearby_stops(self, distance_km=1):
        """Spatial query: Find stops within a certain distance."""
        from django.contrib.gis.measure import D
        return Stop.objects.filter(
            location__distance_lte=(self.location, D(km=distance_km))
        ).exclude(id=self.id).order_by('location__distance_from', 'stop_name')


class Vehicle(models.Model):
    """
    Represents a real-time vehicle/transit unit.
    Data fetched from National Transport API.
    """
    vehicle_id = models.CharField(max_length=100, unique=True)
    route = models.ForeignKey(Route, on_delete=models.SET_NULL, null=True, blank=True, related_name='vehicles')
    location = models.PointField()
    bearing = models.FloatField(null=True, blank=True)
    speed = models.FloatField(null=True, blank=True)
    occupancy = models.IntegerField(null=True, blank=True)
    status = models.CharField(
        max_length=50,
        choices=[
            ('in_transit', 'In Transit'),
            ('stopped', 'Stopped'),
            ('delayed', 'Delayed'),
            ('off_route', 'Off Route'),
        ],
        default='in_transit'
    )
    timestamp = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['vehicle_id']),
            models.Index(fields=['route']),
            models.Index(fields=['-timestamp']),
        ]

    def __str__(self):
        return f"{self.vehicle_id} on {self.route}"

    def get_nearby_vehicles(self, distance_km=2):
        """Spatial query: Find vehicles within a certain distance."""
        from django.contrib.gis.measure import D
        return Vehicle.objects.filter(
            location__distance_lte=(self.location, D(km=distance_km))
        ).exclude(id=self.id).order_by('location__distance_from')

    def get_nearby_stops(self, distance_km=0.5):
        """Spatial query: Find stops near this vehicle."""
        from django.contrib.gis.measure import D
        return Stop.objects.filter(
            location__distance_lte=(self.location, D(km=distance_km))
        ).order_by('location__distance_from')


class SpatialQuery(models.Model):
    """
    Saved spatial queries for analysis and reporting.
    """
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    query_type = models.CharField(
        max_length=50,
        choices=[
            ('radius', 'Radius Search'),
            ('bbox', 'Bounding Box'),
            ('polygon', 'Polygon'),
            ('corridor', 'Corridor'),
        ]
    )
    geometry = models.GeometryField()
    parameters = models.JSONField(default=dict, blank=True)
    created_by = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name
