from django.contrib import admin
from transport_api.models import Stop, Route, Agency, Calendar, Trip, StopTime, Shape, SpatialQuery

# Registering models with the admin site for management
@admin.register(Stop)
class StopAdmin(admin.ModelAdmin):
    list_display = ('stop_id', 'stop_name', 'stop_code', 'stop_type')
    search_fields = ('stop_id', 'stop_name', 'stop_code')
    list_filter = ('stop_type', 'wheelchair_boarding', 'created_at')
    ordering = ('stop_name',)


@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = ('route_id', 'route_short_name', 'route_long_name', 'route_type', 'operator')
    search_fields = ('route_id', 'route_short_name', 'route_long_name')
    list_filter = ('route_type', 'operator')
    ordering = ('route_short_name',)


@admin.register(Agency)
class AgencyAdmin(admin.ModelAdmin):
    list_display = ('agency_id', 'agency_name', 'agency_url', 'agency_timezone')
    search_fields = ('agency_id', 'agency_name')
    ordering = ('agency_name',)


@admin.register(Calendar)
class CalendarAdmin(admin.ModelAdmin):
    list_display = ('service_id', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
    search_fields = ('service_id',)
    list_filter = ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = ('trip_id', 'route', 'service_id', 'trip_headsign')
    search_fields = ('trip_id', 'trip_headsign')
    list_filter = ('route', 'service_id')
    ordering = ('trip_id',)


@admin.register(StopTime)
class StopTimeAdmin(admin.ModelAdmin):
    list_display = ('trip', 'stop', 'arrival_time', 'departure_time', 'stop_sequence')
    search_fields = ('trip__trip_id', 'stop__stop_name')
    list_filter = ('stop_sequence', 'trip')
    ordering = ('trip', 'stop_sequence')


@admin.register(Shape)
class ShapeAdmin(admin.ModelAdmin):
    list_display = ('shape_id', 'sequence')
    search_fields = ('shape_id',)
    list_filter = ('shape_id',)
    ordering = ('shape_id', 'sequence')


@admin.register(SpatialQuery)
class SpatialQueryAdmin(admin.ModelAdmin):
    list_display = ('query_type', 'created_at')
    list_filter = ('query_type', 'created_at')
    readonly_fields = ('created_at',)
