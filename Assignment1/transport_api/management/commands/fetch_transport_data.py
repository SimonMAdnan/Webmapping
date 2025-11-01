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
        """Load stops from GTFS (optimized)."""
        self.stdout.write('Loading stops from GTFS...')
        
        from transport_api.models import Stop
        
        created_count = 0
        stops_to_create = []
        batch_size = 5000
        
        try:
            for stop_data in parser.parse_stops():
                try:
                    stops_to_create.append(
                        Stop(
                            stop_id=stop_data.get('stop_id'),
                            stop_code=stop_data.get('stop_code', ''),
                            stop_name=stop_data.get('stop_name', ''),
                            stop_desc=stop_data.get('stop_desc', ''),
                            stop_type=stop_data.get('stop_type', ''),
                            wheelchair_boarding=stop_data.get('wheelchair_boarding', False),
                        )
                    )
                    
                    if len(stops_to_create) >= batch_size:
                        Stop.objects.bulk_create(stops_to_create, ignore_conflicts=True)
                        created_count += len(stops_to_create)
                        stops_to_create = []
                        self.stdout.write(f'  Processed {created_count} stops...')
                        
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'Error: {str(e)}'))
                    continue
        
            if stops_to_create:
                Stop.objects.bulk_create(stops_to_create, ignore_conflicts=True)
                created_count += len(stops_to_create)
            
            self.stdout.write(self.style.SUCCESS(f'Stops: {created_count} created'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error: {str(e)}'))

    def fetch_routes_from_gtfs(self, parser):
        """Load routes from GTFS (optimized)."""
        self.stdout.write('Loading routes from GTFS...')
        
        from transport_api.models import Route
        
        created_count = 0
        routes_to_create = []
        batch_size = 100000
        
        try:
            for route_data in parser.parse_routes():
                try:
                    routes_to_create.append(
                        Route(
                            route_id=route_data.get('route_id'),
                            route_short_name=route_data.get('route_short_name', ''),
                            route_long_name=route_data.get('route_long_name', ''),
                            route_type=route_data.get('route_type', ''),
                            operator=route_data.get('operator', ''),
                        )
                    )
                    
                    if len(routes_to_create) >= batch_size:
                        Route.objects.bulk_create(routes_to_create, ignore_conflicts=True)
                        created_count += len(routes_to_create)
                        routes_to_create = []
                        self.stdout.write(f'  Processed {created_count} routes...')
                        
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'Error: {str(e)}'))
                    continue
        
            if routes_to_create:
                Route.objects.bulk_create(routes_to_create, ignore_conflicts=True)
                created_count += len(routes_to_create)
            
            self.stdout.write(self.style.SUCCESS(f'Routes: {created_count} created'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error: {str(e)}'))

    def fetch_agencies_from_gtfs(self, parser):
        """Load agencies from GTFS (optimized)."""
        self.stdout.write('Loading agencies from GTFS...')
        
        from transport_api.models import Agency
        
        created_count = 0
        agencies_to_create = []
        batch_size = 5000
        
        try:
            for agency_data in parser.parse_agencies():
                try:
                    agencies_to_create.append(
                        Agency(
                            agency_id=agency_data.get('agency_id'),
                            agency_name=agency_data.get('agency_name', ''),
                            agency_url=agency_data.get('agency_url', ''),
                            agency_timezone=agency_data.get('agency_timezone', ''),
                            agency_lang=agency_data.get('agency_lang', ''),
                            agency_phone=agency_data.get('agency_phone', ''),
                        )
                    )
                    
                    if len(agencies_to_create) >= batch_size:
                        Agency.objects.bulk_create(agencies_to_create, ignore_conflicts=True)
                        created_count += len(agencies_to_create)
                        agencies_to_create = []
                        self.stdout.write(f'  Processed {created_count} agencies...')
                        
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'Error: {str(e)}'))
                    continue
            
            if agencies_to_create:
                Agency.objects.bulk_create(agencies_to_create, ignore_conflicts=True)
                created_count += len(agencies_to_create)
            
            self.stdout.write(self.style.SUCCESS(f'Agencies: {created_count} created'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error: {str(e)}'))

    def fetch_calendars_from_gtfs(self, parser):
        """Load calendars from GTFS (optimized)."""
        self.stdout.write('Loading calendars from GTFS...')
        
        from transport_api.models import Calendar
        
        created_count = 0
        calendars_to_create = []
        batch_size = 10000
        
        try:
            for calendar_data in parser.parse_calendars():
                try:
                    # Parser already handles date conversion and defaults to today
                    start_date = calendar_data.get('start_date')
                    end_date = calendar_data.get('end_date')
                    
                    calendars_to_create.append(
                        Calendar(
                            service_id=calendar_data.get('service_id'),
                            monday=calendar_data.get('monday', False),
                            tuesday=calendar_data.get('tuesday', False),
                            wednesday=calendar_data.get('wednesday', False),
                            thursday=calendar_data.get('thursday', False),
                            friday=calendar_data.get('friday', False),
                            saturday=calendar_data.get('saturday', False),
                            sunday=calendar_data.get('sunday', False),
                            start_date=start_date,
                            end_date=end_date,
                        )
                    )
                    
                    if len(calendars_to_create) >= batch_size:
                        Calendar.objects.bulk_create(calendars_to_create, ignore_conflicts=True)
                        created_count += len(calendars_to_create)
                        calendars_to_create = []
                        self.stdout.write(f'  Processed {created_count} calendars...')
                        
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'Error: {str(e)}'))
                    continue
            
            if calendars_to_create:
                Calendar.objects.bulk_create(calendars_to_create, ignore_conflicts=True)
                created_count += len(calendars_to_create)
            
            self.stdout.write(self.style.SUCCESS(f'Calendars: {created_count} created'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error: {str(e)}'))

    def fetch_stops_from_gtfs(self, parser):
        """Load stops from GTFS (optimized)."""
        self.stdout.write('Loading stops from GTFS...')
        
        from transport_api.models import Stop
        from django.contrib.gis.geos import Point
        
        created_count = 0
        stops_to_create = []
        batch_size = 10000
        
        try:
            for stop_data in parser.parse_stops():
                try:
                    lat = float(stop_data.get('stop_lat', 0))
                    lon = float(stop_data.get('stop_lon', 0))
                    
                    stops_to_create.append(
                        Stop(
                            stop_id=stop_data.get('stop_id'),
                            stop_code=stop_data.get('stop_code', ''),
                            stop_name=stop_data.get('stop_name', ''),
                            stop_desc=stop_data.get('stop_desc', ''),
                            location=Point(lon, lat),
                            stop_type=stop_data.get('stop_type', 'stop'),
                            wheelchair_boarding=bool(int(stop_data.get('wheelchair_boarding', 0))),
                        )
                    )
                    
                    if len(stops_to_create) >= batch_size:
                        Stop.objects.bulk_create(stops_to_create, ignore_conflicts=True)
                        created_count += len(stops_to_create)
                        stops_to_create = []
                        self.stdout.write(f'  Processed {created_count} stops...')
                        
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'Error: {str(e)}'))
                    continue
            
            if stops_to_create:
                Stop.objects.bulk_create(stops_to_create, ignore_conflicts=True)
                created_count += len(stops_to_create)
            
            self.stdout.write(self.style.SUCCESS(f'Stops: {created_count} created'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error: {str(e)}'))

    def fetch_shapes_from_gtfs(self, parser):
        """Load shapes from GTFS (optimized)."""
        self.stdout.write('Loading shapes from GTFS...')
        
        from transport_api.models import Shape
        from django.contrib.gis.geos import LineString
        
        created_count = 0
        shapes_dict = {}  # {shape_id: [(lon, lat), ...]}
        batch_size = 100000
        shapes_to_create = []
        
        try:
            # First, collect all points for each shape
            for shape_data in parser.parse_shapes():
                try:
                    shape_id = shape_data.get('shape_id')
                    lat = float(shape_data.get('shape_pt_lat', 0))
                    lon = float(shape_data.get('shape_pt_lon', 0))
                    sequence = int(shape_data.get('shape_pt_sequence', 0))
                    
                    if shape_id not in shapes_dict:
                        shapes_dict[shape_id] = {}
                    shapes_dict[shape_id][sequence] = (lon, lat)
                    
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'Error parsing shape: {str(e)}'))
                    continue
            
            # Now create Shape objects with LineStrings
            for shape_id, points_dict in shapes_dict.items():
                try:
                    # Sort by sequence and extract coordinates
                    sorted_sequences = sorted(points_dict.keys())
                    coordinates = [points_dict[seq] for seq in sorted_sequences]
                    
                    if len(coordinates) >= 2:
                        line = LineString(coordinates)
                        shapes_to_create.append(
                            Shape(
                                shape_id=shape_id,
                                geometry=line,
                                sequence=1,
                            )
                        )
                        
                        if len(shapes_to_create) >= batch_size:
                            Shape.objects.bulk_create(shapes_to_create, ignore_conflicts=True)
                            created_count += len(shapes_to_create)
                            shapes_to_create = []
                            self.stdout.write(f'  Processed {created_count} shapes...')
                
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'Error creating shape {shape_id}: {str(e)}'))
                    continue
            
            if shapes_to_create:
                Shape.objects.bulk_create(shapes_to_create, ignore_conflicts=True)
                created_count += len(shapes_to_create)
            
            self.stdout.write(self.style.SUCCESS(f'Shapes: {created_count} created'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error: {str(e)}'))

    def fetch_trips_from_gtfs(self, parser):
        """Load trips from GTFS (optimized)."""
        self.stdout.write('Loading trips from GTFS...')
        
        from transport_api.models import Trip, Route
        
        created_count = 0
        skipped = 0
        
        try:
            # Pre-cache route IDs
            route_map = {r.route_id: r for r in Route.objects.all()}
            route_ids = set(route_map.keys())
            
            trips_to_create = []
            batch_size = 100000
            
            for trip_data in parser.parse_trips():
                try:
                    route_id = trip_data.get('route_id')
                    trip_id = trip_data.get('trip_id')
                    
                    if route_id not in route_ids:
                        skipped += 1
                        continue
                    
                    route = route_map[route_id]
                    
                    trips_to_create.append(
                        Trip(
                            trip_id=trip_id,
                            route=route,
                            service_id=trip_data.get('service_id'),
                            trip_headsign=trip_data.get('trip_headsign', ''),
                            direction_id=int(trip_data.get('direction_id', 0)),
                            shape_id=trip_data.get('shape_id', ''),
                            wheelchair_accessible=bool(int(trip_data.get('wheelchair_accessible', 0))),
                        )
                    )
                    
                    if len(trips_to_create) >= batch_size:
                        Trip.objects.bulk_create(trips_to_create, ignore_conflicts=True)
                        created_count += len(trips_to_create)
                        trips_to_create = []
                        self.stdout.write(f'  Processed {created_count} trips...')
                        
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'Error: {str(e)}'))
                    continue
            
            if trips_to_create:
                Trip.objects.bulk_create(trips_to_create, ignore_conflicts=True)
                created_count += len(trips_to_create)
            
            self.stdout.write(self.style.SUCCESS(f'Trips: {created_count} created, {skipped} skipped'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error: {str(e)}'))

    def fetch_stop_times_from_gtfs(self, parser):
        """Load stop times from GTFS (optimized)."""
        self.stdout.write('Loading stop times from GTFS...')
        
        from transport_api.models import StopTime, Trip, Stop
        
        created_count = 0
        skipped = 0
        
        try:
            # Pre-cache trip and stop IDs
            trip_map = {t.trip_id: t for t in Trip.objects.all()}
            stop_map = {s.stop_id: s for s in Stop.objects.all()}
            
            trip_ids = set(trip_map.keys())
            stop_ids = set(stop_map.keys())
            
            stop_times_to_create = []
            batch_size = 100000
            
            for stop_time_data in parser.parse_stop_times():
                try:
                    trip_id = stop_time_data.get('trip_id')
                    stop_id = stop_time_data.get('stop_id')
                    
                    if trip_id not in trip_ids or stop_id not in stop_ids:
                        skipped += 1
                        continue
                    
                    trip = trip_map[trip_id]
                    stop = stop_map[stop_id]
                    
                    # Parse times
                    arrival_time = None
                    departure_time = None
                    
                    if stop_time_data.get('arrival_time'):
                        try:
                            arrival_time = datetime.strptime(stop_time_data.get('arrival_time'), '%H:%M:%S').time()
                        except:
                            pass
                    
                    if stop_time_data.get('departure_time'):
                        try:
                            departure_time = datetime.strptime(stop_time_data.get('departure_time'), '%H:%M:%S').time()
                        except:
                            pass
                    
                    stop_times_to_create.append(
                        StopTime(
                            trip=trip,
                            stop=stop,
                            stop_sequence=int(stop_time_data.get('stop_sequence', 0)),
                            arrival_time=arrival_time,
                            departure_time=departure_time,
                            stop_headsign=stop_time_data.get('stop_headsign', ''),
                            pickup_type=int(stop_time_data.get('pickup_type', 0)),
                            drop_off_type=int(stop_time_data.get('drop_off_type', 0)),
                        )
                    )
                    
                    if len(stop_times_to_create) >= batch_size:
                        StopTime.objects.bulk_create(stop_times_to_create, ignore_conflicts=True)
                        created_count += len(stop_times_to_create)
                        stop_times_to_create = []
                        self.stdout.write(f'  Processed {created_count} stop times...')
                        
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'Error: {str(e)}'))
                    continue
            
            if stop_times_to_create:
                StopTime.objects.bulk_create(stop_times_to_create, ignore_conflicts=True)
                created_count += len(stop_times_to_create)
            
            self.stdout.write(self.style.SUCCESS(f'Stop Times: {created_count} created, {skipped} skipped'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error: {str(e)}'))

