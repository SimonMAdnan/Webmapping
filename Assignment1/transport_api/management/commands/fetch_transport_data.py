"""
Management command to fetch transport data from local GTFS static files (primary source)
and real-time vehicle data from National Transport API (optional).

Usage: 
  python manage.py fetch_transport_data                    # Load from GTFS files
  python manage.py fetch_transport_data --api-key YOUR_KEY # Also fetch live data
  python manage.py fetch_transport_data --stops --routes   # Load only stops and routes from GTFS
"""
import os
import requests
from datetime import datetime
from pathlib import Path
from decouple import config
from django.core.management.base import BaseCommand
from django.contrib.gis.geos import Point
from django.utils import timezone
from transport_api.models import Vehicle, Route, Stop
from transport_api.gtfs_parser import GTFSParser


class Command(BaseCommand):
    help = 'Fetch transport data from National Transport API'

    def add_arguments(self, parser):
        parser.add_argument('--api-key', type=str, help='National Transport API key')
        parser.add_argument('--stops', action='store_true', help='Fetch stops only')
        parser.add_argument('--vehicles', action='store_true', help='Fetch vehicles only')
        parser.add_argument('--routes', action='store_true', help='Fetch routes only')

    def handle(self, *args, **options):
        # Get API key (optional - only for live vehicle fetching)
        api_key = options.get('api_key')
        
        if not api_key:
            api_key = config('TRANSPORT_API_KEY', default=None)
        
        self.stdout.write(self.style.SUCCESS('Starting transport data fetch from GTFS static files...'))
        
        # Determine what to load
        load_all = not options['stops'] and not options['vehicles'] and not options['routes']
        
        try:
            # Find GTFS folder (relative to project root)
            from django.conf import settings
            project_root = Path(settings.BASE_DIR)
            gtfs_folder = project_root / 'GTFS_realtime'
            
            if not gtfs_folder.exists():
                self.stdout.write(self.style.ERROR(f'ERROR: GTFS_realtime folder not found at {gtfs_folder}'))
                return
            
            parser = GTFSParser(str(gtfs_folder))
            
            # Load all GTFS data
            if load_all:
                self.fetch_agencies_from_gtfs(parser)
                self.fetch_calendars_from_gtfs(parser)
                self.fetch_stops_from_gtfs(parser)
                self.fetch_routes_from_gtfs(parser)
                self.fetch_trips_from_gtfs(parser)
                self.fetch_stop_times_from_gtfs(parser)
                self.fetch_shapes_from_gtfs(parser)
            else:
                if options['stops']:
                    self.fetch_stops_from_gtfs(parser)
                if options['routes']:
                    self.fetch_routes_from_gtfs(parser)
                if options['vehicles']:
                    if api_key and api_key != 'your_api_key_here':
                        self.fetch_vehicles(api_key)
                    else:
                        self.stdout.write(self.style.WARNING('Skipping live vehicles: No API key found'))
        
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'ERROR: {str(e)}'))
            return
        
        self.stdout.write(self.style.SUCCESS('Transport data fetch completed!'))

        self.stdout.write(self.style.SUCCESS('Transport data fetch completed!'))

    def fetch_stops(self, api_key):
        """Fetch stops from National Transport API."""
        self.stdout.write('Fetching stops...')
        
        # Try multiple endpoint variations
        endpoints = [
            'https://api.nationaltransport.ie/gtfsr/v2/gtfsr/Stops',
            'https://api.nationaltransport.ie/gtfsr/v2/gtfsr/stops',
            'https://api.nationaltransport.ie/gtfsr/v2/Stops',
            'https://api.nationaltransport.ie/v2/gtfsr/Stops',
            'https://api.nationaltransport.ie/gtfsr/Stops',
        ]
        
        headers = {'x-api-key': api_key}
        data = None
        
        for url in endpoints:
            try:
                response = requests.get(url, headers=headers, timeout=30)
                response.raise_for_status()
                data = response.json()
                self.stdout.write(f'Successfully fetched stops from {url}')
                break
            except requests.exceptions.RequestException as e:
                self.stdout.write(self.style.WARNING(f'Endpoint {url} failed: {str(e)}'))
                continue
        
        if data is None:
            self.stdout.write(self.style.WARNING('Could not fetch stops - all endpoints failed, skipping...'))
            return
        
        # Handle different response formats
        stops_data = (
            data.get('stops', []) or 
            data.get('entity', []) or 
            data.get('data', []) or 
            []
        )
        
        if not stops_data and isinstance(data, list):
            stops_data = data
        
        created_count = 0
        updated_count = 0
        
        for stop_data in stops_data:
            try:
                location = Point(
                    float(stop_data.get('stop_lon', 0)),
                    float(stop_data.get('stop_lat', 0))
                )
                
                stop, created = Stop.objects.update_or_create(
                    stop_id=stop_data.get('stop_id'),
                    defaults={
                        'stop_code': stop_data.get('stop_code', ''),
                        'stop_name': stop_data.get('stop_name', ''),
                        'stop_desc': stop_data.get('stop_desc', ''),
                        'location': location,
                        'stop_type': stop_data.get('stop_type', 'stop'),
                        'wheelchair_boarding': stop_data.get('wheelchair_boarding', False) == 1,
                    }
                )
                
                if created:
                    created_count += 1
                else:
                    updated_count += 1
                    
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'Error processing stop: {str(e)}'))
                continue
        
        self.stdout.write(self.style.SUCCESS(f'Stops: {created_count} created, {updated_count} updated'))

    def fetch_vehicles(self, api_key):
        """Fetch vehicles from National Transport API."""
        self.stdout.write('Fetching vehicles...')
        
        # Try multiple endpoint variations
        endpoints = [
            'https://api.nationaltransport.ie/gtfsr/v2/gtfsr/Vehicles',
            'https://api.nationaltransport.ie/gtfsr/v2/gtfsr/VehiclePositions',
            'https://api.nationaltransport.ie/gtfsr/v2/Vehicles',
            'https://api.nationaltransport.ie/v2/gtfsr/Vehicles',
        ]
        
        headers = {'x-api-key': api_key}
        data = None
        
        for url in endpoints:
            try:
                response = requests.get(url, headers=headers, timeout=30)
                response.raise_for_status()
                data = response.json()
                self.stdout.write(f'Successfully fetched vehicles from {url}')
                break
            except requests.exceptions.RequestException as e:
                self.stdout.write(self.style.WARNING(f'Endpoint {url} failed: {str(e)}'))
                continue
        
        if data is None:
            self.stdout.write(self.style.WARNING('Could not fetch vehicles - all endpoints failed, skipping...'))
            return
        
        # Handle different response formats
        entities = (
            data.get('entity', []) or 
            data.get('vehicles', []) or 
            data.get('data', []) or 
            []
        )
        
        if not entities and isinstance(data, list):
            entities = data
            
        created_count = 0
        updated_count = 0
        
        for entity in entities:
            try:
                vehicle_data = entity.get('vehicle', {}) if 'vehicle' in entity else entity
                position = vehicle_data.get('position', {})
                trip = vehicle_data.get('trip', {})
                
                vehicle_id = vehicle_data.get('vehicle', {}).get('id') or vehicle_data.get('id')
                if not vehicle_id:
                    continue
                
                location = Point(
                    float(position.get('longitude', 0)),
                    float(position.get('latitude', 0))
                )
                
                route = None
                route_id = trip.get('route_id')
                if route_id:
                    route, _ = Route.objects.get_or_create(
                        route_id=route_id,
                        defaults={
                            'route_short_name': route_id,
                            'route_long_name': route_id,
                            'route_type': '3',
                        }
                    )
                
                vehicle, created = Vehicle.objects.update_or_create(
                    vehicle_id=vehicle_id,
                    defaults={
                        'route': route,
                        'location': location,
                        'bearing': position.get('bearing'),
                        'speed': position.get('speed'),
                        'occupancy': vehicle_data.get('occupancy_status'),
                        'status': 'in_transit',
                        'timestamp': timezone.now(),
                    }
                )
                
                if created:
                    created_count += 1
                else:
                    updated_count += 1
                    
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'Error processing vehicle: {str(e)}'))
                continue
        
        self.stdout.write(self.style.SUCCESS(f'Vehicles: {created_count} created, {updated_count} updated'))

    def fetch_routes(self, api_key):
        """Fetch trip updates from National Transport API."""
        self.stdout.write('Fetching trip updates...')
        
        # Try multiple endpoint variations
        endpoints = [
            'https://api.nationaltransport.ie/gtfsr/v2/gtfsr/TripUpdates',
            'https://api.nationaltransport.ie/gtfsr/v2/TripUpdates',
            'https://api.nationaltransport.ie/v2/gtfsr/TripUpdates',
        ]
        
        headers = {'x-api-key': api_key}
        data = None
        
        for url in endpoints:
            try:
                response = requests.get(url, headers=headers, timeout=30)
                response.raise_for_status()
                data = response.json()
                self.stdout.write(f'Successfully fetched trip updates from {url}')
                break
            except requests.exceptions.RequestException as e:
                self.stdout.write(self.style.WARNING(f'Endpoint {url} failed: {str(e)}'))
                continue
        
        if data is None:
            self.stdout.write(self.style.WARNING('Could not fetch trip updates - all endpoints failed, skipping...'))
            return
        
        # Handle different response formats
        routes_data = (
            data.get('routes', []) or 
            data.get('entity', []) or 
            data.get('data', []) or 
            []
        )
        
        if not routes_data and isinstance(data, list):
            routes_data = data
        
        created_count = 0
        updated_count = 0
        
        for route_data in routes_data:
            try:
                route, created = Route.objects.update_or_create(
                    route_id=route_data.get('route_id'),
                    defaults={
                        'route_short_name': route_data.get('route_short_name', ''),
                        'route_long_name': route_data.get('route_long_name', ''),
                        'route_type': route_data.get('route_type', '3'),
                        'operator': route_data.get('agency_id', ''),
                    }
                )
                
                if created:
                    created_count += 1
                else:
                    updated_count += 1
                    
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'Error processing route: {str(e)}'))
                continue
        
        self.stdout.write(self.style.SUCCESS(f'Routes: {created_count} created, {updated_count} updated'))

    def fetch_stops_from_gtfs(self, parser):
        """Load stops from local GTFS stops.txt file."""
        self.stdout.write('Loading stops from GTFS...')
        
        created_count = 0
        updated_count = 0
        
        try:
            for stop_data in parser.parse_stops():
                try:
                    location = Point(
                        float(stop_data['stop_lon']),
                        float(stop_data['stop_lat'])
                    )
                    
                    stop, created = Stop.objects.update_or_create(
                        stop_id=stop_data['stop_id'],
                        defaults={
                            'stop_code': stop_data.get('stop_code', ''),
                            'stop_name': stop_data.get('stop_name', ''),
                            'stop_desc': stop_data.get('stop_desc', ''),
                            'location': location,
                            'stop_type': stop_data.get('location_type', 'stop'),
                        }
                    )
                    
                    if created:
                        created_count += 1
                    else:
                        updated_count += 1
                        
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'Error processing stop {stop_data.get("stop_id")}: {str(e)}'))
                    continue
            
            self.stdout.write(self.style.SUCCESS(f'Stops: {created_count} created, {updated_count} updated'))
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error reading GTFS stops: {str(e)}'))

    def fetch_routes_from_gtfs(self, parser):
        """Load routes from local GTFS routes.txt file."""
        self.stdout.write('Loading routes from GTFS...')
        
        created_count = 0
        updated_count = 0
        
        try:
            for route_data in parser.parse_routes():
                try:
                    route, created = Route.objects.update_or_create(
                        route_id=route_data['route_id'],
                        defaults={
                            'route_short_name': route_data.get('route_short_name', ''),
                            'route_long_name': route_data.get('route_long_name', ''),
                            'route_type': route_data.get('route_type', '3'),
                            'operator': route_data.get('agency_id', ''),
                        }
                    )
                    
                    if created:
                        created_count += 1
                    else:
                        updated_count += 1
                        
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'Error processing route {route_data.get("route_id")}: {str(e)}'))
                    continue
            
            self.stdout.write(self.style.SUCCESS(f'Routes: {created_count} created, {updated_count} updated'))
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error reading GTFS routes: {str(e)}'))

    def fetch_agencies_from_gtfs(self, parser):
        """Load agencies from GTFS."""
        self.stdout.write('Loading agencies from GTFS...')
        
        from transport_api.models import Agency
        
        created_count = 0
        updated_count = 0
        
        try:
            for agency_data in parser.parse_agencies():
                try:
                    agency, created = Agency.objects.update_or_create(
                        agency_id=agency_data.get('agency_id', ''),
                        defaults={
                            'agency_name': agency_data.get('agency_name', ''),
                            'agency_url': agency_data.get('agency_url', ''),
                            'agency_timezone': agency_data.get('agency_timezone', ''),
                            'agency_lang': agency_data.get('agency_lang', ''),
                            'agency_phone': agency_data.get('agency_phone', ''),
                            'agency_fare_url': agency_data.get('agency_fare_url', ''),
                        }
                    )
                    if created:
                        created_count += 1
                    else:
                        updated_count += 1
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'Error processing agency: {str(e)}'))
                    continue
            
            self.stdout.write(self.style.SUCCESS(f'Agencies: {created_count} created, {updated_count} updated'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error reading GTFS agencies: {str(e)}'))

    def fetch_calendars_from_gtfs(self, parser):
        """Load calendars from GTFS."""
        self.stdout.write('Loading calendars from GTFS...')
        
        from transport_api.models import Calendar
        
        created_count = 0
        updated_count = 0
        
        try:
            for calendar_data in parser.parse_calendars():
                try:
                    calendar, created = Calendar.objects.update_or_create(
                        service_id=calendar_data.get('service_id'),
                        defaults={
                            'monday': calendar_data.get('monday', False),
                            'tuesday': calendar_data.get('tuesday', False),
                            'wednesday': calendar_data.get('wednesday', False),
                            'thursday': calendar_data.get('thursday', False),
                            'friday': calendar_data.get('friday', False),
                            'saturday': calendar_data.get('saturday', False),
                            'sunday': calendar_data.get('sunday', False),
                            'start_date': calendar_data.get('start_date'),
                            'end_date': calendar_data.get('end_date'),
                        }
                    )
                    if created:
                        created_count += 1
                    else:
                        updated_count += 1
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'Error processing calendar: {str(e)}'))
                    continue
            
            self.stdout.write(self.style.SUCCESS(f'Calendars: {created_count} created, {updated_count} updated'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error reading GTFS calendars: {str(e)}'))

    def fetch_trips_from_gtfs(self, parser):
        """Load trips from GTFS."""
        self.stdout.write('Loading trips from GTFS...')
        
        from transport_api.models import Trip
        
        created_count = 0
        updated_count = 0
        
        try:
            for trip_data in parser.parse_trips():
                try:
                    route_id = trip_data.get('route_id')
                    if not Route.objects.filter(route_id=route_id).exists():
                        continue
                    
                    route = Route.objects.get(route_id=route_id)
                    
                    trip, created = Trip.objects.update_or_create(
                        trip_id=trip_data.get('trip_id'),
                        defaults={
                            'route': route,
                            'service_id': trip_data.get('service_id', ''),
                            'trip_headsign': trip_data.get('trip_headsign', ''),
                            'direction_id': int(trip_data.get('direction_id', 0)),
                            'shape_id': trip_data.get('shape_id', ''),
                            'wheelchair_accessible': trip_data.get('wheelchair_accessible', '0') == '1',
                        }
                    )
                    if created:
                        created_count += 1
                    else:
                        updated_count += 1
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'Error processing trip: {str(e)}'))
                    continue
            
            self.stdout.write(self.style.SUCCESS(f'Trips: {created_count} created, {updated_count} updated'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error reading GTFS trips: {str(e)}'))

    def fetch_stop_times_from_gtfs(self, parser):
        """Load stop times from GTFS."""
        self.stdout.write('Loading stop times from GTFS...')
        
        from transport_api.models import StopTime, Trip
        
        created_count = 0
        updated_count = 0
        skipped = 0
        
        try:
            for stop_time_data in parser.parse_stop_times():
                try:
                    trip_id = stop_time_data.get('trip_id')
                    stop_id = stop_time_data.get('stop_id')
                    
                    if not Trip.objects.filter(trip_id=trip_id).exists():
                        skipped += 1
                        continue
                    if not Stop.objects.filter(stop_id=stop_id).exists():
                        skipped += 1
                        continue
                    
                    trip = Trip.objects.get(trip_id=trip_id)
                    stop = Stop.objects.get(stop_id=stop_id)
                    
                    # Parse times
                    arrival_time = None
                    departure_time = None
                    
                    if stop_time_data.get('arrival_time'):
                        try:
                            from datetime import datetime
                            arrival_time = datetime.strptime(stop_time_data.get('arrival_time'), '%H:%M:%S').time()
                        except:
                            pass
                    
                    if stop_time_data.get('departure_time'):
                        try:
                            from datetime import datetime
                            departure_time = datetime.strptime(stop_time_data.get('departure_time'), '%H:%M:%S').time()
                        except:
                            pass
                    
                    stop_time, created = StopTime.objects.update_or_create(
                        trip=trip,
                        stop_sequence=stop_time_data.get('stop_sequence'),
                        defaults={
                            'stop': stop,
                            'arrival_time': arrival_time,
                            'departure_time': departure_time,
                            'stop_headsign': stop_time_data.get('stop_headsign', ''),
                            'pickup_type': int(stop_time_data.get('pickup_type', 0)),
                            'drop_off_type': int(stop_time_data.get('drop_off_type', 0)),
                        }
                    )
                    if created:
                        created_count += 1
                    else:
                        updated_count += 1
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'Error processing stop time: {str(e)}'))
                    continue
            
            self.stdout.write(self.style.SUCCESS(f'Stop Times: {created_count} created, {updated_count} updated, {skipped} skipped'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error reading GTFS stop times: {str(e)}'))

    def fetch_shapes_from_gtfs(self, parser):
        """Load shapes (route geometries) from GTFS."""
        self.stdout.write('Loading shapes from GTFS...')
        
        from transport_api.models import Shape
        from collections import defaultdict
        
        created_count = 0
        
        try:
            # Group shape points by shape_id
            shapes_by_id = defaultdict(list)
            
            for shape_data in parser.parse_shapes():
                shapes_by_id[shape_data.get('shape_id')].append(shape_data)
            
            # Create Shape objects with LineString geometry
            for shape_id, points in shapes_by_id.items():
                try:
                    if not points:
                        continue
                    
                    # Sort by sequence
                    points.sort(key=lambda x: x.get('shape_pt_sequence', 0))
                    
                    # Create LineString from coordinates
                    coords = [(p.get('shape_pt_lon'), p.get('shape_pt_lat')) for p in points]
                    from django.contrib.gis.geos import LineString
                    geometry = LineString(coords)
                    
                    shape, created = Shape.objects.update_or_create(
                        shape_id=shape_id,
                        sequence=0,
                        defaults={
                            'geometry': geometry,
                        }
                    )
                    if created:
                        created_count += 1
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'Error processing shape {shape_id}: {str(e)}'))
                    continue
            
            self.stdout.write(self.style.SUCCESS(f'Shapes: {created_count} created'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error reading GTFS shapes: {str(e)}'))

