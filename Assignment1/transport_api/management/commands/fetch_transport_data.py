"""
Management command to fetch transport data from local GTFS static files.

Usage: 
  python manage.py fetch_transport_data                    # Load from GTFS files
  python manage.py fetch_transport_data --stops --routes   # Load only stops and routes from GTFS
"""
import os
import requests
from datetime import datetime
from pathlib import Path
from decouple import config
from django.core.management.base import BaseCommand
from django.contrib.gis.geos import Point ,LineString
from django.utils import timezone
from transport_api.models import Route, Stop, Agency, Calendar, Trip, StopTime, Shape
from transport_api.gtfs_parser import GTFSParser
from django.conf import settings

# Command to fetch transport data from GTFS files
class Command(BaseCommand):
    help = 'Fetch transport data from National Transport API'

    # Add command-line arguments
    def add_arguments(self, parser): 
        parser.add_argument('--api-key', type=str, help='(Deprecated - no longer used)')
        parser.add_argument('--stops', action='store_true', help='Fetch stops only')
        parser.add_argument('--routes', action='store_true', help='Fetch routes only')
    
    # Handle command execution
    def handle(self, *args, **options):
        # Get API key only works for live vehicles and trip updates not implemented yet
        api_key = options.get('api_key')
        
        # Use .env API key if not provided
        if not api_key:
            api_key = config('TRANSPORT_API_KEY', default=None)
        
        
        self.stdout.write(self.style.SUCCESS('Starting transport data fetch from GTFS static files...'))
        
      
        load_all = not options['stops'] and not options['routes'] # Load all if no specific flags
        
        # Load from GTFS static files
        try:
            # Find GTFS folder in project root
            project_root = Path(settings.BASE_DIR)
            gtfs_folder = project_root / 'GTFS_realtime'
            
            # Check if GTFS folder exists
            if not gtfs_folder.exists():
                self.stdout.write(self.style.ERROR(f'ERROR: GTFS_realtime folder not found at {gtfs_folder}'))
                return
            
            # Initialize GTFS parser on the folder
            parser = GTFSParser(str(gtfs_folder))
            
            # Load all GTFS data
            if load_all: # Load all data if no specific flags
                self.fetch_agencies_from_gtfs(parser)
                self.fetch_calendars_from_gtfs(parser)
                self.fetch_stops_from_gtfs(parser)
                self.fetch_routes_from_gtfs(parser)
                self.fetch_trips_from_gtfs(parser)
                self.fetch_stop_times_from_gtfs(parser)
                self.fetch_shapes_from_gtfs(parser)
            else: # Load only specified data
                if options['stops']:
                    self.fetch_stops_from_gtfs(parser)
                if options['routes']:
                    self.fetch_routes_from_gtfs(parser)
        
        except Exception as e: # Catch any errors during fetch
            self.stdout.write(self.style.ERROR(f'ERROR: {str(e)}'))
            return
        
        self.stdout.write(self.style.SUCCESS('Transport data fetch completed!'))

    # Fetch stops from GTFS static files
    def fetch_stops(self, api_key): #both live and static attempts
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

        # API key header
        headers = {'x-api-key': api_key}
        data = None
        
        # Try each endpoint until one succeeds  
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
        
        # If all endpoints failed,skip
        if data is None:
            self.stdout.write(self.style.WARNING('Could not fetch stops - all endpoints failed, skipping...'))
            return
        
        # Handle different response formats
        stops_data = ( # Extract relevant stop data
            data.get('stops', []) or # Live data
            data.get('entity', []) or # GTFS-realtime format
            data.get('data', []) or # GTFS static format
            [] # Default empty list
        )
        
        # If no stops found, check if data is a list itself
        if not stops_data and isinstance(data, list):
            stops_data = data
        
        # Process each stop
        created_count = 0
        updated_count = 0
        
        # Iterate over each stop in the data
        for stop_data in stops_data:
            try: # Create or update Stop object
                location = Point( # Create Point from lon/lat
                    float(stop_data.get('stop_lon', 0)),
                    float(stop_data.get('stop_lat', 0))
                )
                # Create or update Stop object
                stop, created = Stop.objects.update_or_create(
                    stop_id=stop_data.get('stop_id'), # Unique stop ID
                    defaults={ # Fields to update
                        'stop_code': stop_data.get('stop_code', ''),
                        'stop_name': stop_data.get('stop_name', ''),
                        'stop_desc': stop_data.get('stop_desc', ''),
                        'location': location,
                        'stop_type': stop_data.get('stop_type', 'stop'),
                        'wheelchair_boarding': stop_data.get('wheelchair_boarding', False) == 1,
                    }
                )
                
                # Count created vs updated
                if created:
                    created_count += 1
                else:
                    updated_count += 1
            # Handle any errors that occur during processing
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'Error processing stop: {str(e)}'))
                continue
        
        self.stdout.write(self.style.SUCCESS(f'Stops: {created_count} created, {updated_count} updated'))

    # Fetch routes from GTFS static files
    def fetch_routes(self, api_key): # Fetch routes from GTFS static files and attempt api
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
        
        # If no routes found, check if data is a list itself
        if not routes_data and isinstance(data, list):
            routes_data = data
        
        # Process each route
        created_count = 0
        updated_count = 0
        
        # Iterate over each route in the data
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
                # Count created vs updated
                if created:
                    created_count += 1
                else:
                    updated_count += 1
                    
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'Error processing route: {str(e)}'))
                continue
        
        self.stdout.write(self.style.SUCCESS(f'Routes: {created_count} created, {updated_count} updated'))
    
    # Fetch stops from GTFS static files
    def fetch_stops_from_gtfs(self, parser):
        self.stdout.write('Loading stops from GTFS...')
        
        created_count = 0 # Count of created stops
        stops_to_create = [] # List to batch create stops
        batch_size = 5000 # Batch size for bulk create
        
        try: # Iterate over parsed stops
            for stop_data in parser.parse_stops(): # Each stop data
                try: # Create Stop object
                    stops_to_create.append( # Create Stop object
                        Stop( 
                            stop_id=stop_data.get('stop_id'),
                            stop_code=stop_data.get('stop_code', ''),
                            stop_name=stop_data.get('stop_name', ''),
                            stop_desc=stop_data.get('stop_desc', ''),
                            stop_type=stop_data.get('stop_type', ''),
                            wheelchair_boarding=stop_data.get('wheelchair_boarding', False),
                        )
                    )
                    
                    # Bulk create in batches
                    if len(stops_to_create) >= batch_size:
                        Stop.objects.bulk_create(stops_to_create, ignore_conflicts=True) # Bulk create stops
                        created_count += len(stops_to_create) # Update created count
                        stops_to_create = [] # Reset list
                        self.stdout.write(f'  Processed {created_count} stops...') # Progress update
                        
                except Exception as e: # Handle individual stop errors
                    self.stdout.write(self.style.WARNING(f'Error: {str(e)}'))
                    continue
            
            # Final bulk create for remaining stops
            if stops_to_create:
                Stop.objects.bulk_create(stops_to_create, ignore_conflicts=True)
                created_count += len(stops_to_create) # Update created count
            self.stdout.write(self.style.SUCCESS(f'Stops: {created_count} created'))

        except Exception as e: # Handle overall errors
            self.stdout.write(self.style.ERROR(f'Error: {str(e)}'))

    # Fetch routes from GTFS static files
    def fetch_routes_from_gtfs(self, parser):
        self.stdout.write('Loading routes from GTFS...')
        
        created_count = 0 # Count of created routes
        routes_to_create = [] # List to batch create routes 
        batch_size = 100000 # Batch size for bulk create
        
        # Similar bulk create logic for routes
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

    # Fetch agencies from GTFS static files
    def fetch_agencies_from_gtfs(self, parser):
        self.stdout.write('Loading agencies from GTFS...')
        
        # Similar bulk create logic for agencies
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

        # Similar bulk create logic for calendars
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


    def fetch_shapes_from_gtfs(self, parser):
        """Load shapes from GTFS (optimized)."""
        self.stdout.write('Loading shapes from GTFS...')
        
        # Almost similar bulk create logic for shapes
        created_count = 0
        shapes_dict = {}  # {shape_id: [(lon, lat), ...]}
        batch_size = 100000
        shapes_to_create = []
        
        try:
            for shape_data in parser.parse_shapes(): # Each shape point
                try: # Collect points by shape_id
                    shape_id = shape_data.get('shape_id')
                    lat = float(shape_data.get('shape_pt_lat', 0))
                    lon = float(shape_data.get('shape_pt_lon', 0))
                    sequence = int(shape_data.get('shape_pt_sequence', 0))
                    
                    # Store points in dict
                    if shape_id not in shapes_dict: # If the shape_id is new 
                        shapes_dict[shape_id] = {} # Use dict to sort by sequence and add it to the shapes_dict
                    shapes_dict[shape_id][sequence] = (lon, lat) # Store point by sequence relating to shape_id
                    
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'Error parsing shape: {str(e)}'))
                    continue
            
            # Now create Shape objects with LineStrings
            for shape_id, points_dict in shapes_dict.items(): # Each shape_id and its points
                try:
                    # Sort by sequence and extract coordinates
                    sorted_sequences = sorted(points_dict.keys())
                    coordinates = [points_dict[seq] for seq in sorted_sequences] # List of (lon, lat)
                    
                    # Create LineString if enough points
                    if len(coordinates) >= 2: 
                        line = LineString(coordinates)
                        shapes_to_create.append(
                            Shape( # Create Shape object
                                shape_id=shape_id,
                                geometry=line,
                                sequence=1,
                            )
                        )

                        # Bulk create in batches to database
                        if len(shapes_to_create) >= batch_size:
                            Shape.objects.bulk_create(shapes_to_create, ignore_conflicts=True)
                            created_count += len(shapes_to_create)
                            shapes_to_create = []
                            self.stdout.write(f'  Processed {created_count} shapes...')
                
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'Error creating shape {shape_id}: {str(e)}'))
                    continue
            
            # Final bulk create for remaining shapes
            if shapes_to_create:
                Shape.objects.bulk_create(shapes_to_create, ignore_conflicts=True)
                created_count += len(shapes_to_create)
            
            self.stdout.write(self.style.SUCCESS(f'Shapes: {created_count} created'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error: {str(e)}'))

    def fetch_trips_from_gtfs(self, parser):
        self.stdout.write('Loading trips from GTFS...')
        
        #Almost similar bulk create logic for trips
        created_count = 0
        skipped = 0
        
        try:
            # Pre-cache route IDs used by trips
            route_map = {r.route_id: r for r in Route.objects.all()} # Map of route_id to Route object
            route_ids = set(route_map.keys()) # Set of valid route_ids keys
            
    
            trips_to_create = []
            batch_size = 100000
            
            for trip_data in parser.parse_trips():
                try:
                    route_id = trip_data.get('route_id')
                    trip_id = trip_data.get('trip_id')
                    
                    # Skip trips with unknown routes
                    if route_id not in route_ids:
                        skipped += 1
                        continue
                    
                    # Get Route object
                    route = route_map[route_id]

                    # Create Trip object
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
                    
                    # Bulk create in batches
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
        self.stdout.write('Loading stop times from GTFS...')

        # Almost similar bulk create logic for stop times
        created_count = 0
        skipped = 0
        
        try:
            # Pre-cache trip and stop IDs which are used by stop times
            trip_map = {t.trip_id: t for t in Trip.objects.all()} # Map of trip_id to Trip object
            stop_map = {s.stop_id: s for s in Stop.objects.all()} # Map of stop_id to Stop object

            trip_ids = set(trip_map.keys()) # Set of valid trip_ids keys
            stop_ids = set(stop_map.keys()) # Set of valid stop_ids keys

            stop_times_to_create = []
            batch_size = 100000 # Bigger batch size for stop times as there are 6million+ records
            
            # Iterate over parsed stop times
            for stop_time_data in parser.parse_stop_times():
                try:
                    # Get related trip and stop IDs
                    trip_id = stop_time_data.get('trip_id')
                    stop_id = stop_time_data.get('stop_id')
                    
                    # Skip stop times with unknown trips or stops
                    if trip_id not in trip_ids or stop_id not in stop_ids:
                        skipped += 1
                        continue
                    
                    # Get Trip and Stop objects
                    trip = trip_map[trip_id]
                    stop = stop_map[stop_id]
                    
                    # Parse times
                    arrival_time = None
                    departure_time = None

                    # Parse arrival time
                    if stop_time_data.get('arrival_time'):
                        try: 
                            arrival_time = datetime.strptime(stop_time_data.get('arrival_time'), '%H:%M:%S').time() # Parse time string
                        except:
                            pass
                    
                    if stop_time_data.get('departure_time'): # Parse departure time
                        try:
                            departure_time = datetime.strptime(stop_time_data.get('departure_time'), '%H:%M:%S').time() # Parse time string
                        except:
                            pass

                    # Create StopTime object
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
                    
                    # Bulk create in batches
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

