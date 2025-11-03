"""
GTFS static file parser for loading transit data from local GTFS CSV files.
Reads stops.txt, routes.txt, trips.txt, and stop_times.txt.
"""

import csv
from pathlib import Path
from typing import List, Dict, Generator
from django.contrib.gis.geos import Point

# Define GTFSParser class
class GTFSParser:
    # Parser for GTFS static files.
    
    def __init__(self, gtfs_folder_path: str):
        # Initialise parser with path to GTFS folder.
        self.gtfs_path = Path(gtfs_folder_path)
    
    def parse_stops(self) -> Generator[Dict, None, None]: # Add stops to generator to create a dictionary
        """
        Parse stops.txt and yield stop dictionaries.
        
        Yields:
        Dict with keys: stop_id, stop_code, stop_name, stop_desc, stop_lat, stop_lon, location_type, parent_station
        """

        # Define file path to stops.txt
        stops_file = self.gtfs_path / 'stops.txt'
        
        # Check if file exists
        if not stops_file.exists():
            raise FileNotFoundError(f"stops.txt not found at {stops_file}")
        
      
        with open(stops_file, 'r', encoding='utf-8') as f: # With open stops.txt file
            reader = csv.DictReader(f) # Read CSV as dictionary
            for row in reader: # For each row in the CSV
                try: # Try to parse the row
                    # Skip rows with missing coordinates
                    lat = float(row.get('stop_lat', 0)) # Get latitude
                    lon = float(row.get('stop_lon', 0)) # Get longitude
                    
                    # Skip invalid coordinates
                    if lat == 0 or lon == 0:
                        continue
                    
                    # Yield stop dictionary
                    yield {
                        'stop_id': row.get('stop_id'),
                        'stop_code': row.get('stop_code', ''),
                        'stop_name': row.get('stop_name', ''),
                        'stop_desc': row.get('stop_desc', ''),
                        'stop_lat': lat,
                        'stop_lon': lon,
                        'location_type': row.get('location_type', 'stop'),
                        'parent_station': row.get('parent_station'),
                    }
                except (ValueError, KeyError) as e:
                    continue

    # Similar parsing functions for routes, trips, agencies, calendars, and shapes
    def parse_routes(self) -> Generator[Dict, None, None]:
        """
        Parse routes.txt and yield route dictionaries.
        
        Yields:
            Dict with keys: route_id, route_short_name, route_long_name, route_type, operator
        """
        routes_file = self.gtfs_path / 'routes.txt'
        
        if not routes_file.exists():
            raise FileNotFoundError(f"routes.txt not found at {routes_file}")
        
        with open(routes_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    yield {
                        'route_id': row.get('route_id'),
                        'route_short_name': row.get('route_short_name', ''),
                        'route_long_name': row.get('route_long_name', ''),
                        'route_type': row.get('route_type', '3'),
                        'operator': row.get('agency_id', ''),
                    }
                except KeyError:
                    continue
    
    def parse_trips(self) -> Generator[Dict, None, None]:
        """
        Parse trips.txt and yield trip dictionaries.
        
        Yields:
            Dict with keys: route_id, service_id, trip_id, trip_headsign,
                           direction_id, shape_id, wheelchair_accessible
        """
        trips_file = self.gtfs_path / 'trips.txt'
        
        if not trips_file.exists():
            raise FileNotFoundError(f"trips.txt not found at {trips_file}")
        
        with open(trips_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    yield {
                        'route_id': row.get('route_id'),
                        'service_id': row.get('service_id', ''),
                        'trip_id': row.get('trip_id'),
                        'trip_headsign': row.get('trip_headsign', ''),
                        'direction_id': row.get('direction_id', '0'),
                        'shape_id': row.get('shape_id', ''),
                        'wheelchair_accessible': row.get('wheelchair_accessible', '0'),
                    }
                except KeyError:
                    continue
    
    def parse_stop_times(self) -> Generator[Dict, None, None]:
        """
        Parse stop_times.txt and yield stop time dictionaries.
        
        Yields:
            Dict with keys: trip_id, stop_id, stop_sequence, arrival_time,
                           departure_time, stop_headsign, pickup_type, drop_off_type
        """
        stop_times_file = self.gtfs_path / 'stop_times.txt'
        
        if not stop_times_file.exists():
            raise FileNotFoundError(f"stop_times.txt not found at {stop_times_file}")
        
        with open(stop_times_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    yield {
                        'trip_id': row.get('trip_id'),
                        'stop_id': row.get('stop_id'),
                        'stop_sequence': int(row.get('stop_sequence', 0)),
                        'arrival_time': row.get('arrival_time', ''),
                        'departure_time': row.get('departure_time', ''),
                        'stop_headsign': row.get('stop_headsign', ''),
                        'pickup_type': row.get('pickup_type', '0'),
                        'drop_off_type': row.get('drop_off_type', '0'),
                    }
                except (ValueError, KeyError):
                    continue
    
    def parse_agencies(self) -> Generator[Dict, None, None]:
        """Parse agencies.txt file."""
        agencies_file = self.gtfs_path / 'agency.txt'
        
        if not agencies_file.exists():
            return
        
        with open(agencies_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    yield {
                        'agency_id': row.get('agency_id', ''),
                        'agency_name': row.get('agency_name', ''),
                        'agency_url': row.get('agency_url', ''),
                        'agency_timezone': row.get('agency_timezone', ''),
                        'agency_lang': row.get('agency_lang', ''),
                        'agency_phone': row.get('agency_phone', ''),
                        'agency_fare_url': row.get('agency_fare_url', ''),
                    }
                except KeyError:
                    continue
    
    def parse_calendars(self) -> Generator[Dict, None, None]:
        """Parse calendar.txt file."""
        from datetime import datetime, date
        
        calendar_file = self.gtfs_path / 'calendar.txt'
        
        if not calendar_file.exists():
            return
        
        with open(calendar_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    start_date = None
                    end_date = None
                    
                    try:
                        start_date = datetime.strptime(row.get('start_date'), '%Y%m%d').date()
                    except (ValueError, TypeError):
                        start_date = date.today()
                    
                    try:
                        end_date = datetime.strptime(row.get('end_date'), '%Y%m%d').date()
                    except (ValueError, TypeError):
                        end_date = date.today()
                    
                    yield {
                        'service_id': row.get('service_id'),
                        'monday': row.get('monday', '0') == '1',
                        'tuesday': row.get('tuesday', '0') == '1',
                        'wednesday': row.get('wednesday', '0') == '1',
                        'thursday': row.get('thursday', '0') == '1',
                        'friday': row.get('friday', '0') == '1',
                        'saturday': row.get('saturday', '0') == '1',
                        'sunday': row.get('sunday', '0') == '1',
                        'start_date': start_date,
                        'end_date': end_date,
                    }
                except (ValueError, KeyError):
                    continue
    
    def parse_shapes(self) -> Generator[Dict, None, None]:
        """Parse shapes.txt file - route geometry."""
        shapes_file = self.gtfs_path / 'shapes.txt'
        
        if not shapes_file.exists():
            return
        
        with open(shapes_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    yield {
                        'shape_id': row.get('shape_id'),
                        'shape_pt_lat': float(row.get('shape_pt_lat', 0)),
                        'shape_pt_lon': float(row.get('shape_pt_lon', 0)),
                        'shape_pt_sequence': int(row.get('shape_pt_sequence', 0)),
                    }
                except (ValueError, KeyError):
                    continue
