//Transport Map Application - map.js
//Handles map initialization, data loading, caching, and user interactions
// Depends on Leaflet.js and api.js for API interactions

//Global Variables//
// Leaflet map instance
let map;

// Layer for stop markers
let stopMarkers = L.featureGroup();

// Layer for route lines
let routeLayer = L.featureGroup();

// Layer for query result markers
let queryLayer = L.featureGroup();

// Layer control instance
let layerControl = null;


//Cache for tracking loaded data//
// Tracks loaded stops to avoid clearing on multiple loads
let loadedStops = new Set();

// Tracks if routes have been loaded into memory
let routesLoaded = false;

// Cache settings
// Local storage key for cached stops data
const CACHE_KEY_STOPS = 'transport_stops_cache';

// Local storage key for cached shapes data
const CACHE_KEY_SHAPES = 'transport_shapes_cache';

// Cache expiry time in minutes (1 hour)
const CACHE_EXPIRY_MINUTES = 60;

// Cache functions

// Retrieve cached stops data from browser local storage
// Checks cache validity before returning
// Returns an array of stop features or null if cache invalid/expired
function getCachedStops() {
    try {// It tries to read the cached stops from local storage using the defined key. 
        const cached = localStorage.getItem(CACHE_KEY_STOPS);
        if (!cached) return null;  // If no cached data is found, it returns null.
        
        
        const data = JSON.parse(cached); // It then parses the cached JSON string into an object.
        const now = Date.now();  // Get the current timestamp

        // If the cache is older than the defined expiry time
        // it removes the cached item from local storage and returns null.
        if (now - data.timestamp > CACHE_EXPIRY_MINUTES * 60 * 1000) {
            localStorage.removeItem(CACHE_KEY_STOPS);
            console.log('Stops cache expired');
            return null;
        }
        // If cache is valid, it logs the age of the cache and returns the cached stops array.
        console.log('Using cached stops, age:', Math.round((now - data.timestamp) / 1000), 'seconds');
        return data.stops;
    } catch (e) {// If any error occurs like JSON parsing errors, it logs the error and returns null.
        console.error('Error reading stops cache:', e);
        return null;
    }
}

// Cache stops data to browser local storage
// This is used to avoid repeated API calls for the same data
// The array of stop features is stored along with a timestamp
function cacheStops(stops) {
    try {// It tries to store the stops data in local storage.
        const data = {
            timestamp: Date.now(),
            stops: stops
        };
        // Store the stops data in local storage
        localStorage.setItem(CACHE_KEY_STOPS, JSON.stringify(data));
        console.log('Cached', stops.length, 'stops');
    } catch (e) {// If any error occurs during storage, it logs the error.
        console.error('Error caching stops:', e);
    }
}

// Route type mapping (GTFS standard)
// Maps route_type integers to human-readable names
const ROUTE_TYPES = {
    0: 'Tram',
    1: 'Subway',
    2: 'Rail',
    3: 'Bus',
    4: 'Ferry',
    5: 'Cable Car',
    6: 'Gondola',
    7: 'Funicular',
    11: 'Trolleybus',
    12: 'Monorail'
};

// Route type colors
// Maps route_type integers to specific colors for visualization
const ROUTE_TYPE_COLORS = {
    0: '#0099FF',  // Tram - Blue
    1: '#6B4C9A',  // Subway - Purple
    2: '#055305ff',  // Rail - Green
    3: '#FFDD00',  // Bus - Yellow
    4: '#FF6B6B',  // Ferry - Red
    5: '#FF9500',  // Cable Car - Orange
    6: '#FF69B4',  // Gondola - Pink
    7: '#8B4513',  // Funicular - Brown
    11: '#FF1493', // Trolleybus - Deep Pink
    12: '#00CED1'  // Monorail - Dark Turquoise
};

// Gets route type name from from the integer code
function getRouteTypeName(routeType) {
    return ROUTE_TYPES[routeType] || `Type ${routeType}`;
}

// Gets color for a given route type
function getRouteTypeColor(routeType) {
    return ROUTE_TYPE_COLORS[routeType] || '#3498db';
}
// Gets icon for a given route type
function getRouteTypeIcon(routeType) {
    const icons = {
        0: '🚊',    // Tram
        1: '🚇',    // Subway
        2: '🚂',    // Rail
        3: '🚌',    // Bus
        4: '⛴️',     // Ferry
        5: '🚡',    // Cable Car
        6: '🚡',    // Gondola
        7: '🚞',    // Funicular
        11: '🚌',   // Trolleybus
        12: '🚝'    // Monorail
    };
    return icons[String(routeType)] || '🚌';
}

// IndexedDB for large data caching
const DB_NAME = 'TransportDB';
const STORE_NAME = 'shapes';


// Initialise IndexedDB
function initIndexedDB() {
    // Create a promise to handle the asynchronous nature of IndexedDB
    // resolve and reject are functions to handle success and failure of the database initialisation.
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);// Open (or create) the database
        
        // Handle errors during the database opening process
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        // Create the object store if it doesn't exist
        request.onupgradeneeded = (event) => {// This event is triggered when the database is created or upgraded
            const db = event.target.result;// Get the database instance
            if (!db.objectStoreNames.contains(STORE_NAME)) {// If the object store doesn't exist, create it
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });// It stores it with 'id' as the key path
            }
        };
    });
}

// Retrieve cached shapes data from IndexedDB
async function getCachedShapesFromIndexedDB() {
    try {// It tries to read the cached shapes data from IndexedDB.
        const db = await initIndexedDB();// It initialises the IndexedDB.
        
        // It returns a promise that resolves with the cached shapes data or null if not found/expired
        return new Promise((resolve, reject) => {// It creates a new promise to handle the asynchronous read operation
            const transaction = db.transaction([STORE_NAME], 'readonly');// It starts a read-only transaction on the shapes object store
            const store = transaction.objectStore(STORE_NAME);// It gets the object store for shapes
            const request = store.get('shapes_data');// It attempts to get the shapes data using a predefined key
            
            // Error handling for the request
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {// On successful retrieval, it checks the validity of the cached data
                const result = request.result;// It gets the result of the request

                // Checks cache validity
                if (result && result.timestamp) {
                    const now = Date.now();
                    const age = now - result.timestamp;
                    
                    // Checks if cache is expired (1 hour)
                    if (age > CACHE_EXPIRY_MINUTES * 60 * 1000) {
                        console.log('Shapes cache expired');
                        resolve(null);
                    } else { // If cache is valid, it logs the age of the cache and returns the cached shapes array.

                        // The Math.round(age / 1000) converts the age from milliseconds to seconds for logging.
                        console.log('Using cached shapes from IndexedDB, age:', Math.round(age / 1000), 'seconds');
                        resolve(result.shapes);
                    }
                } else {// If no valid result, resolve with null
                    resolve(null);
                }
            };
        });
    } catch (e) {// If any error occurs during the process, it logs the error and returns null.
        console.warn('IndexedDB read error:', e);
        return null;
    }
}

// Cache shapes data to IndexedDB
async function cacheShapesInIndexedDB(shapes) {
    try {// It tries to store the shapes data in IndexedDB.
        const db = await initIndexedDB(); // This initialises the IndexedDB.
        const data = {// It prepares the data object to be stored, including a timestamp.
            id: 'shapes_data',
            timestamp: Date.now(),
            shapes: shapes
        };
        
        // The function returns a promise that resolves when the data is successfully stored.
        return new Promise((resolve, reject) => {
            // Start a read-write transaction
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(data);

            // Error handling for the request
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                console.log('Cached', shapes.length, 'shapes in IndexedDB');
                resolve();
            };
        });
    } catch (e) {// If any error occurs during the process, it logs the error.
        console.warn('IndexedDB write error:', e);
    }
}

// Map Initialization Functions //

//Trigger map initialization when DOM is fully loaded
//Event listener for DOMContentLoaded triggers initMap function
// DOMContentLoaded a browser event that fires when the initial HTML document has been completely loaded and parsed
window.addEventListener('DOMContentLoaded', initMap);




// These are the main steps to set up the map application.
// Creates the Leaflet map, initialises layers and controls
// Sets up event listeners for user interactions
// Loads initial data for the map
// Updates map statistics with total stops/routes

// Main map initialization function
function initMap() {
    console.log('initMap called');
    
    // Center map on Dublin City Center coordinates
    const dublinLat = 53.3498;
    const dublinLon = -6.2603;

    // Log map element details for debugging
    const mapElement = document.getElementById('map');
    console.log('Map element:', mapElement);
    console.log('Map element size:', mapElement.offsetWidth, 'x', mapElement.offsetHeight);

    // Create the Leaflet map instance centering on Dublin
    map = L.map('map').setView([dublinLat, dublinLon], 13);
    console.log('Leaflet map created:', map);

    // Initialises the map with the other tile layers and layer controls
    const { baseLayers, overlayLayers } = initializeMapWithLayers(map);
    console.log('Layers initialised', { baseLayers, overlayLayers });
    
    // Store references to overlay layers for data updates
    window.featureLayers = overlayLayers;  // Store all feature layers
    window.stopMarkersLayer = overlayLayers['Stops'];// Store stop markers layer
    window.shapesLayer = overlayLayers;  // Store all shape layers for reference
    window.queryLayer = overlayLayers['Query Results']; // Store query results layer
    
    // Log assigned overlay layers for debugging
    console.log('Overlay layers assigned:', {
        stopMarkersLayer: window.stopMarkersLayer,
        shapesLayer: window.shapesLayer,
        queryLayer: window.queryLayer,
        featureLayers: window.featureLayers
    });

    // Add map event listeners
    map.on('moveend', function() {// Map moveend event to update bounds inputs
        console.log('Map moved');
        updateMapBounds();// Update the map bounds in the input fields
    });

    // Add click handler for map - creates markers for bounds/radius search
    map.on('click', function(e) {
        const lat = e.latlng.lat;
        const lon = e.latlng.lng;

        // Initialise markers object if needed
        if (!window.boundsMarkers) {// Object to track bounds markers
            window.boundsMarkers = {}; // Initialises boundsMarkers object
        }
        
        // Determine which marker to create/update
        if (!window.boundsMarkers.point1) {
            // Create Marker 1
            const marker1Icon = L.divIcon({// Custom div icon for marker 1
                className: 'bounds-marker-label',
                html: '<div style="background: #9b59b6; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">1</div>',
                iconSize: [30, 30],// Size of the icon
                iconAnchor: [15, 15]// Center the icon
            });
            
            // Create and add Marker 1 to the map
            window.boundsMarkers.point1 = L.marker([lat, lon], { icon: marker1Icon })// Custom icon for marker 1
                .bindPopup(`<strong>Marker 1</strong><br>Lat: ${lat.toFixed(4)}<br>Lon: ${lon.toFixed(4)}`) // Popup with marker details
                .addTo(window.queryLayer); // Add to query results layer
            
            // Update bounds input fields
            document.getElementById('bboxMinLat').value = lat.toFixed(4);
            document.getElementById('bboxMinLon').value = lon.toFixed(4);
            
            // Update radius input fields
            document.getElementById('radiusLat').value = lat.toFixed(4);
            document.getElementById('radiusLon').value = lon.toFixed(4);
            
            // Update k-nearest input fields
            const kNearestLat = document.getElementById('kNearestLat');
            const kNearestLon = document.getElementById('kNearestLon');
            if (kNearestLat) kNearestLat.value = lat.toFixed(4);// Set k-nearest latitude input
            if (kNearestLon) kNearestLon.value = lon.toFixed(4);// Set k-nearest longitude input
            
            console.log(`Marker 1 created at: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
            
        } else if (!window.boundsMarkers.point2) {// If Marker 1 exists but Marker 2 does not
            // Create Marker 2
            const marker2Icon = L.divIcon({ // Custom div icon for marker 2
                className: 'bounds-marker-label',
                html: '<div style="background: #9b59b6; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">2</div>',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });
            
            // Create and add Marker 2 to the map
            window.boundsMarkers.point2 = L.marker([lat, lon], { icon: marker2Icon })
                .bindPopup(`<strong>Marker 2</strong><br>Lat: ${lat.toFixed(4)}<br>Lon: ${lon.toFixed(4)}`)
                .addTo(window.queryLayer);
            
            // Update bounds input fields
            document.getElementById('bboxMaxLat').value = lat.toFixed(4);
            document.getElementById('bboxMaxLon').value = lon.toFixed(4);
            
            console.log(`Marker 2 created at: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);

        } else {
            // Both markers exist reset and create new Marker 1
            window.queryLayer.removeLayer(window.boundsMarkers.point1);
            window.queryLayer.removeLayer(window.boundsMarkers.point2);
            
            // Set up new Marker 1
            const marker1Icon = L.divIcon({
                className: 'bounds-marker-label',
                html: '<div style="background: #9b59b6; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">1</div>',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });
            
            // Create and add new Marker 1 to the map
            window.boundsMarkers = {};
            window.boundsMarkers.point1 = L.marker([lat, lon], { icon: marker1Icon })// Custom icon for marker 1
                .bindPopup(`<strong>Marker 1</strong><br>Lat: ${lat.toFixed(4)}<br>Lon: ${lon.toFixed(4)}`)
                .addTo(window.queryLayer);
            
            // Update bounds input fields
            document.getElementById('bboxMinLat').value = lat.toFixed(4);
            document.getElementById('bboxMinLon').value = lon.toFixed(4);
            document.getElementById('bboxMaxLat').value = '';
            document.getElementById('bboxMaxLon').value = '';
            
            // Update radius input fields
            document.getElementById('radiusLat').value = lat.toFixed(4);
            document.getElementById('radiusLon').value = lon.toFixed(4);
            
            // Update k-nearest input fields
            const kNearestLat = document.getElementById('kNearestLat');
            const kNearestLon = document.getElementById('kNearestLon');
            if (kNearestLat) kNearestLat.value = lat.toFixed(4);
            if (kNearestLon) kNearestLon.value = lon.toFixed(4);
            
            console.log(`Markers reset. New Marker 1 created at: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
        }
    });

    // Simple event listener to update k-nearest coordinates on map click
    map.on('click', function(e) {// Map click event to update k-nearest inputs
        const kNearestLat = document.getElementById('kNearestLat');
        const kNearestLon = document.getElementById('kNearestLon');
        if (kNearestLat) kNearestLat.value = e.latlng.lat.toFixed(4);
        if (kNearestLon) kNearestLon.value = e.latlng.lng.toFixed(4);
    });

    // Initial data load - load routes in background but don't show them
    console.log('Starting initial data load');
    loadRoutesWithTripsAndServices();  // Load routes with trips and services (replaces loadShapesAndDisplay)
    
    // Load and display statistics
    updateStatistics();

    console.log('Map initialised with all layers unchecked');
}

// Load all stops from API with pagination and caching
async function loadStops() {// This function loads all stops from the API, handling pagination and caching
    try { // It tries to load the stops data
        // Check cache first
        let stops = getCachedStops(); // Attempt to retrieve cached stops
        let fromCache = false; // Flag to indicate if data is from cache

        if (stops && stops.length > 0) { // If cached stops are available
            // Use cached stops
            console.log('Using cached stops');
            fromCache = true;
        } else { // If no cached stops, fetch from API
            // Fetch from API if not in cache
            console.log('Loading all stops from API (paginated)');
            stops = []; // Initialise empty array to hold all stops
            let page = 1; // Start from the first page
            let hasMore = true; // Flag to track if more pages are available
            
            while (hasMore) { // Loop to fetch all pages
                const offset = (page - 1) * 10000; // Calculate offset for pagination
                const url = `/api/stops/?limit=10000&offset=${offset}`; // Sets up the API URL with limit and offset
                console.log('Fetching page', page, ':', url); // Log the URL being fetched
                
                // Fetching the data from the API
                const response = await fetch(url); // Await the fetch response
                 
                // Check for HTTP errors
                if (!response.ok) {// If response is not ok, log error and break the loop
                    console.error('API response not ok:', response.status, response.statusText);
                    break;
                }
                
                // Parse the JSON response
                const data = await response.json();
                
                // Debugging logs to inspect the response structure
                console.log('Page', page, 'full response:', JSON.stringify(data).substring(0, 500));
                console.log('Page', page, 'response keys:', Object.keys(data));
                console.log('Page', page, 'data.results type:', typeof data.results);
                
                // Ensure results exist in the response
                if (!data.results) {
                    console.warn('No results in response');
                    break;
                }

                // Handle both array and Feature formats
                let pageStops = [];
                if (Array.isArray(data.results)) {
                    // Standard array format from StopModelSerializer
                    pageStops = data.results; // Uses results directly
                    console.log('Using results as array of Features');
                } else if (data.results.features && Array.isArray(data.results.features)) { // If it's in the feature format from GeoFeatureModelSerializer
                    // GeoFeatureModelSerializer returns FeatureCollection with features array inside results
                    pageStops = data.results.features;
                    console.log('Extracted features array from GeoFeatureModelSerializer FeatureCollection');
                } else {// If results is neither an array nor has features, log a warning
                    console.warn('Results is not an array and has no features:', typeof data.results, data.results);
                    break;
                }
                
                // Append the stops from this page to the main stops array
                stops = stops.concat(pageStops);
                console.log('Loaded', pageStops.length, 'stops from page', page, '. Total so far:', stops.length);
                
                // Check if there are more pages then sets it to true or false
                hasMore = data.next ? true : false;
                page++;// Increment page number for next iteration
            }
            
            console.log('Finished loading all pages. Total stops:', stops.length);
            
            // Cache the stops
            if (stops.length > 0) {// Cache the stops if any were loaded
                cacheStops(stops);
            }
        }

        // Use the overlay layer or fallback to stopMarkers
        const stopsLayer = window.stopMarkersLayer || stopMarkers; // Get the stops layer from global reference
        console.log('Using stopsLayer:', stopsLayer); 
        
        // Add stops to the map, avoiding duplicates
        console.log('Adding', stops.length, 'stops from', fromCache ? 'cache' : 'API');
        stops.forEach((stop, idx) => { // Loop through each stop by index
            try { // Tries to create and add a marker for each stop
                const stopKey = stop.properties?.stop_id || stop.id; // Unique key for the stop
                
                // Only add if not already loaded
                if (!loadedStops.has(stopKey)) {
                    const marker = createStopMarker(stop); // Create marker for the stop
                    stopsLayer.addLayer(marker); // Add marker to the stops layer
                    loadedStops.add(stopKey); // Mark this stop as loaded
                }
            } catch (e) { // If any error occurs during marker creation, it logs the error
                console.error('Error creating marker for stop', idx, ':', e);
            }
        });
        console.log('Stops loaded successfully. Total unique stops:', loadedStops.size);
    } catch (error) { // If any error occurs during the loading process, it logs the error
        console.error('Error loading stops:', error);
    }
}

// Create a Leaflet circle marker for a stop with popup showing details and schedules
function createStopMarker(stop) {
    try { // It tries to create a Leaflet circle marker for the given stop
        const coords = stop.geometry.coordinates;
        const props = stop.properties || stop;
        const stopId = props.id || stop.id;
        
        //console.log('Creating stop marker:', { coords, stop_name: props.stop_name });
        
        // Create circle marker at stop coordinates
        const marker = L.circleMarker([coords[1], coords[0]], {
            radius: 10,
            fillColor: '#27ae60',
            color: '#fff',
            weight: 1.5,
            opacity: 1,
            fillOpacity: 0.75
        });

        // Create popup with placeholder for schedules
        const popupContent = `
            <div class="popup-content" style="min-width: 300px; max-height: 500px; overflow-y: auto;">
                <strong>${props.stop_name}</strong><br>
                Code: ${props.stop_code || 'N/A'}<br>
                Type: ${props.stop_type || 'Stop'}<br>
                ♿ Wheelchair accessible: ${props.wheelchair_boarding ? 'Yes' : 'No'}<br>
                <hr>
                <small style="color: #666;">Loading schedules...</small>
                <div id="schedules-${stopId}" style="margin-top: 10px; font-size: 12px;"></div>
            </div>
        `;
        marker.bindPopup(popupContent);// Bind the popup to the marker
        
        // Load schedules when popup opens
        marker.on('popupopen', async function() { // Event listener for popup open
            const schedulesContainer = document.getElementById(`schedules-${stopId}`); // Get the schedules container element
            if (schedulesContainer) { // If the container exists, load the schedules
                const schedules = await loadStopSchedules(stopId); // Load schedules for the stop
                
                if (schedules && schedules.length > 0) { // If schedules are available, format and display them
                    let schedulesHtml = '<strong>Upcoming Trips:</strong><br>'; // Header for schedules
                    schedules.slice(0, 10).forEach(schedule => { // Limit to first 10 schedules
                        schedulesHtml += `
                            <div style="padding: 5px; border-left: 3px solid #3498db;">
                                <strong>${schedule.route_short_name}</strong> 
                                <span style="font-size: 11px; color: #666;">${schedule.route_long_name}</span><br>
                                <small>
                                    Arr: <strong>${schedule.arrival_time || 'N/A'}</strong> 
                                    Dep: <strong>${schedule.departure_time || 'N/A'}</strong><br>
                                    ${schedule.trip_headsign ? 'To: ' + schedule.trip_headsign : ''}
                                </small>
                            </div>
                        `;
                    });
                    // If more than 10 schedules, indicate there are more
                    schedulesContainer.innerHTML = schedulesHtml;
                    if (schedules.length > 10) {
                        schedulesContainer.innerHTML += `<small style="color: #999;">... and ${schedules.length - 10} more trips</small>`;
                    }
                } else { // If no schedules are available, display a message
                    schedulesContainer.innerHTML = '<small style="color: #999;">No schedules available</small>';
                }
            }
        });
        // Return the created marker
        return marker;
    } catch (e) { // If any error occurs during marker creation, it logs the error and rethrows it
        console.error('Error creating stop marker:', e, stop);
        throw e;
    }
}

// Update map bounds input fields based on current map view
function updateMapBounds() {
    const bounds = map.getBounds();
    document.getElementById('bboxMinLat').value = bounds.getSouth().toFixed(4);
    document.getElementById('bboxMaxLat').value = bounds.getNorth().toFixed(4);
    document.getElementById('bboxMinLon').value = bounds.getWest().toFixed(4);
    document.getElementById('bboxMaxLon').value = bounds.getEast().toFixed(4);
}
// Update statistics for total stops and routes
async function updateStatistics() {
    try { // It tries to fetch and update the total counts of stops and routes
        const stopsResp = await fetch('/api/stops/?limit=1'); // Fetch stops with limit=1 to get total count
        const routesResp = await fetch('/api/routes/?limit=1'); // Fetch routes with limit=1 to get total count

        const stopsData = await stopsResp.json(); // Parse stops response as JSON
        const routesData = await routesResp.json();// Parse routes response as JSON
        
        // Update the HTML elements with the fetched counts
        document.getElementById('stopCount').textContent = stopsData.count || 0;
        document.getElementById('routeCount').textContent = routesData.count || 0;
    } catch (error) { // If any error occurs during the fetching process, it logs the error
        console.error('Error updating statistics:', error);
    }
}
// Load bus numbers for a given shape ID
async function loadShapeBusNumbers(shapeId) {
    try {// It tries to load the bus numbers associated with the given shape ID
        console.log('Loading bus numbers for shape:', shapeId);
        // Fetch trips that use this shape and get unique route short names
        const response = await fetch(`/api/shapes/trips/?shape_id=${shapeId}`);// Fetch trips for the shape ID
        
        if (!response.ok) { // If response is not ok, log error and return empty array
            console.error('Failed to load trips for shape:', response.status);
            return [];
        }
        
        // Parse the JSON response
        const data = await response.json(); // Await the JSON data
        const busNumbers = new Set(); // Use a Set to store unique bus numbers
        
        // Extract route short names from trips
        if (Array.isArray(data)) { // Check if data is an array
            data.forEach(trip => { // Loop through each trip
                if (trip.route_short_name) { // If route short name exists, add to the set
                    busNumbers.add(trip.route_short_name); // Add unique bus number from trips to the set
                }
            });
        }
        
        // Return sorted array of unique bus numbers
        return Array.from(busNumbers).sort((a, b) => { // Sort the bus numbers
            // Sort numerically if both are numbers, otherwise alphabetically
            const aNum = parseInt(a); // Try to parse as integer
            const bNum = parseInt(b); // Try to parse as integer
            if (!isNaN(aNum) && !isNaN(bNum)) { // If both are valid numbers
                return aNum - bNum; // Sort numerically
            }
            return a.localeCompare(b); // Otherwise sort alphabetically
        });
    } catch (error) { // If any error occurs during the loading process, it logs the error and returns an empty array
        console.error('Error loading shape bus numbers:', error);
        return []; // Return empty array on error
    }
}

// It tries to load all route shapes from the API 
// It handles pagination and caching, then displays them on the map
async function loadShapesAndDisplay() { 
    try { // It tries to load and display route shapes on the map
        console.log('Loading and displaying route shapes...');
        const shapeLayer = window.shapesLayer; // Reference to the shapes overlay layer
        
        // Create reference to service type layers
        const serviceTypeLayers = {
            '0': window.featureLayers['Shapes - Tram'],      // Tram
            '1': window.featureLayers['Shapes - Rail'],      // Subway
            '2': window.featureLayers['Shapes - Rail'],      // Rail
            '3': window.featureLayers['Shapes - Bus'],       // Bus
            '4': window.featureLayers['Shapes - Other'],     // Ferry
            '5': window.featureLayers['Shapes - Other'],     // Cable Car
            '6': window.featureLayers['Shapes - Other'],     // Gondola
            '7': window.featureLayers['Shapes - Other'],     // Funicular
            '11': window.featureLayers['Shapes - Other'],    // Trolleybus
            '12': window.featureLayers['Shapes - Other']     // Monorail
        };
        // Loading spinner elements
        const spinner = document.getElementById('loading-spinner');
        const spinnerText = document.getElementById('loading-text');
        
        // Ensure shapeLayer exists
        if (!shapeLayer) {
            console.error('Shape layer not found in window scope');
            return;
        }
        
        // Check IndexedDB cache first
        let shapes = await getCachedShapesFromIndexedDB();
        
        // If no cached shapes, load from API in batches
        if (!shapes || shapes.length === 0) {
            console.log('Loading shapes from API in batches');
            if (spinner) spinner.style.display = 'block'; // Show loading spinner
            // Batch loading variables
            shapes = [];
            let offset = 0;
            const batchSize = 5000;
            let totalCount = 0;
            let hasMore = true;
            
            // Load shapes in batches until all are loaded
            while (hasMore) {
                try {// Try to fetch each batch of shapes
                    // If spinner text element exists, update it with current count
                    if (spinnerText) spinnerText.textContent = `Loading shapes... (${shapes.length} loaded)`;
                
                    // Construct API URL for the current batch
                    const url = `/api/shapes/?limit=${batchSize}&offset=${offset}`; // API endpoint with pagination
                    console.log(`Fetching shapes batch at offset ${offset}`); 
                    
                    // Fetch the batch of shapes from the API
                    const response = await fetch(url);
                    
                    // Check for HTTP errors
                    if (!response.ok) {
                        console.error('Failed to load shapes:', response.status, response.statusText);
                        if (spinner) spinner.style.display = 'none'; // Hide spinner on error
                        return;
                    }
                    
                    // Parse the JSON response
                    const data = await response.json();
                    totalCount = data.count;
                    
                    // If no results, stop loading
                    if (!data.results || data.results.length === 0) {
                        hasMore = false;
                        break;
                    }
                    
                    // Append the fetched shapes to the main shapes array
                    shapes = shapes.concat(data.results);
                    offset += batchSize;
                    
                    console.log(`Loaded ${shapes.length} of ${totalCount} shapes`);
                    
                    // Check if all shapes have been loaded
                    if (shapes.length >= totalCount) {
                        hasMore = false;
                    }
                } catch (err) { //
                    console.error('Error fetching shapes batch:', err);
                    hasMore = false;
                }
            }
            
            // Cache the shapes in IndexedDB
            if (shapes.length > 0) {
                await cacheShapesInIndexedDB(shapes); // Cache the loaded shapes
            }
        } else { // Using cached shapes
            console.log('Using cached shapes from IndexedDB');
            if (spinner) spinner.style.display = 'block'; // Show loading spinner
        }
        
        console.log('Shapes loaded:', {
            count: shapes.length // Total number of shapes loaded
        });
        
        // Display shapes on the map
        if (shapes && Array.isArray(shapes)) { // Ensure shapes is a valid array
            // Counters for displayed and skipped shapes
            let count = 0;
            let skipCount = 0;

            // Process each shape feature
            shapes.forEach((feature, idx) => { // Loop through each shape feature by index
                try { // It tries to create and display a polyline for each shape feature
                    if (!feature.geometry) { // Skip if no geometry
                        skipCount++; // Increment skip counter
                        return;
                    }
                    
                    // Only process LineString geometries
                    if (feature.geometry.type !== 'LineString') {
                        skipCount++; // Increment skip counter
                        return;
                    }
                    
                    // Skip if no coordinates
                    if (!feature.geometry.coordinates || feature.geometry.coordinates.length === 0) {
                        skipCount++; // Increment skip counter
                        return;
                    }
                    
                    // Convert coordinates to Leaflet latlngs
                    const latlngs = feature.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                    
                    // Get route properties
                    const props = feature.properties;  // Properties of the shape feature
                    const routeColor = getRouteTypeColor(props.route_type); // Get color based on route type
                    
                    // Create polyline for the shape
                    const polyline = L.polyline(latlngs, {
                        color: routeColor,
                        weight: 3,
                        opacity: 0.7,
                        dashArray: '5, 5'
                    });
                    
                    // Add bus number as tooltip
                    polyline.bindTooltip(`Bus ${props.route_short_name}`, {
                        permanent: false, // Show on hover
                        direction: 'top', // Position above the line
                        offset: [0, -10] // Offset upwards
                    });
                    
                    // Create popup content with placeholder for bus numbers
                    const popupContent = `
                        <div class="popup-content" style="min-width: 300px; max-height: 500px; overflow-y: auto;">
                            <strong>Route ${props.route_short_name}</strong><br>
                            ${props.route_long_name || 'N/A'}<br>
                            Service: <strong>${getRouteTypeName(props.route_type)}</strong><br>
                            <hr>
                            <small style="color: #666;">Loading bus numbers...</small>
                            <div id="bus-numbers-${props.shape_id}" style="margin-top: 10px; font-size: 12px;"></div>
                        </div>
                    `;
                    polyline.bindPopup(popupContent); // Bind the popup to the polyline
                    
                    // Load bus numbers when popup opens
                    polyline.on('popupopen', async function() { // Event listener for popup open
                        const busNumbersContainer = document.getElementById(`bus-numbers-${props.shape_id}`); // Get the bus numbers container element
                        if (busNumbersContainer) { // If the container exists, load the bus numbers
                            const busNumbers = await loadShapeBusNumbers(props.shape_id); // Load bus numbers for the shape
                            
                            // Display bus numbers or a message if none found
                            if (busNumbers && busNumbers.length > 0) { // If bus numbers are available, format and display them
                                // Display bus numbers as styled spans
                                let html = '<strong>Bus Routes:</strong><br>';
                                busNumbers.forEach(busNum => {
                                    html += `<span style="display: inline-block; background: #e0e0e0; padding: 4px 8px; margin: 2px; border-radius: 3px; font-weight: bold;">${busNum}</span> `;
                                });
                                busNumbersContainer.innerHTML = html;
                            } else { // If no bus numbers are available, display a message
                                busNumbersContainer.innerHTML = '<small style="color: #999;">No bus numbers found</small>';
                            }
                        }
                    });
                    
                    // Add to appropriate service type layer
                    const routeTypeStr = String(props.route_type); // Convert route type to string for lookup
                    const targetLayer = serviceTypeLayers[routeTypeStr] || window.featureLayers['Shapes - Other']; // Default to 'Other' layer if type not found
                    targetLayer.addLayer(polyline); // Add polyline to the target layer
                    
                    // Increment displayed shapes counter
                    count++;
                } catch (err) { // If any error occurs during polyline creation, it logs the error and increments skip counter
                    console.error(`Error processing shape ${idx}:`, err);
                    skipCount++; // Increment skip counter
                }
            });
            
            console.log(`Loaded and displayed ${count} route shapes (skipped ${skipCount})`);
        } else { // If no shapes were loaded, log a warning
            console.warn('No shapes available');
        }
        
        // Hide spinner when done
        if (spinner) spinner.style.display = 'none';
    } catch (error) {
        console.error('Error loading shapes:', error);
        const spinner = document.getElementById('loading-spinner');
        if (spinner) spinner.style.display = 'none';
    }
}

// Load all route shapes from the API without displaying them
async function loadShapes() {
    try {// It tries to load all route shapes from the API
        console.log('Loading route shapes...');
        const response = await fetch('/api/shapes/?limit=10000'); // Fetch shapes from the API

        // Check for HTTP errors
        if (!response.ok) {
            console.error('Failed to load shapes:', response.status);
            return;
        }
        
        // Parse the JSON response
        const data = await response.json();
        const shapeLayer = L.featureGroup();
        
        // Process each shape feature
        if (data.results && Array.isArray(data.results)) { // Ensure results is a valid array
            data.results.forEach(feature => { // Loop through each shape feature
                if (feature.geometry && feature.geometry.type === 'LineString') { // Only process LineString geometries
                    const polyline = L.polyline( // Create polyline for the shape
                        feature.geometry.coordinates.map(coord => [coord[1], coord[0]]),
                        {
                            color: '#3498db',
                            weight: 3,
                            opacity: 0.6,
                            dashArray: '5, 5'
                        }
                    );
                    
                    // Add popup with route details
                    const props = feature.properties;
                    const popupContent = `
                        <div class="popup-content">
                            <strong>Route ${props.route_short_name}</strong><br>
                            ${props.route_long_name}<br>
                            Shape ID: ${props.shape_id}
                        </div>
                    `;
                    // Bind popup to polyline
                    polyline.bindPopup(popupContent);
                    shapeLayer.addLayer(polyline); // Add polyline to the shape layer
                }
            });
        }
        
        console.log('Loaded', shapeLayer.getLayers().length, 'route shapes');
        return shapeLayer; // Return the shape layer
    } catch (error) { // If any error occurs during the loading process, it logs the error
        console.error('Error loading shapes:', error);
    }
}

// Load schedules for a specific stop ID
async function loadStopSchedules(stopId) { // It tries to load schedules for the given stop ID
    try { // It tries to load schedules for the given stop ID
        console.log('Loading schedules for stop:', stopId);
        const response = await fetch(`/api/stops/${stopId}/schedules/`); // Fetch schedules for the stop ID
        
        // Check for HTTP errors
        if (!response.ok) {
            console.error('Failed to load schedules:', response.status);
            return null;
        }
        
        // Parse the JSON response
        const data = await response.json();
        return data.schedules || [];
    } catch (error) {
        console.error('Error loading schedules:', error);
        return []; // Return empty array on error
    }
}

// toggle visibility of map layers based on checkbox states
function toggleLayer(layerName) {
    switch(layerName) { // Switch based on the layer name
        case 'stops': // If layer is 'stops'
            if (document.getElementById('layerStops').checked) {
                loadStops().then(() => {
                    window.featureLayers['Stops'].addTo(map);
                    updateStatistics();
                });
            } else { // If unchecked, remove stops layer from map
                map.removeLayer(window.featureLayers['Stops']);
            }
            break;
        case 'shapes-bus': // If layer is 'shapes-bus'
            if (document.getElementById('layerShapesBus').checked) {
                if (!routesLoaded) {
                    loadRoutesWithTripsAndServices().then(() => {
                        window.featureLayers['Shapes - Bus'].addTo(map);
                    });
                } else { // If routes already loaded, just add the layer
                    window.featureLayers['Shapes - Bus'].addTo(map);
                }
            } else {// If unchecked, remove bus shapes layer from map
                map.removeLayer(window.featureLayers['Shapes - Bus']);
            }
            break;
        case 'shapes-rail': // If layer is 'shapes-rail'
            if (document.getElementById('layerShapesRail').checked) {
                if (!routesLoaded) {
                    loadRoutesWithTripsAndServices().then(() => {
                        window.featureLayers['Shapes - Rail'].addTo(map);
                    });
                } else { // If routes already loaded, just add the layer
                    window.featureLayers['Shapes - Rail'].addTo(map);
                }
            } else { // If unchecked, remove rail shapes layer from map
                map.removeLayer(window.featureLayers['Shapes - Rail']);
            }
            break;
        case 'shapes-tram': // If layer is 'shapes-tram'
            if (document.getElementById('layerShapesTram').checked) {
                if (!routesLoaded) {
                    loadRoutesWithTripsAndServices().then(() => {
                        window.featureLayers['Shapes - Tram'].addTo(map);
                    });
                } else { // If routes already loaded, just add the layer
                    window.featureLayers['Shapes - Tram'].addTo(map);
                }
            } else { // If unchecked, remove tram shapes layer from map
                map.removeLayer(window.featureLayers['Shapes - Tram']);
            }
            break;
        case 'shapes-other': // If layer is 'shapes-other'
            if (document.getElementById('layerShapesOther').checked) {
                if (!routesLoaded) {
                    loadRoutesWithTripsAndServices().then(() => {
                        window.featureLayers['Shapes - Other'].addTo(map);
                    });
                } else { // If routes already loaded, just add the layer
                    window.featureLayers['Shapes - Other'].addTo(map);
                }
            } else { // If unchecked, remove other shapes layer from map
                map.removeLayer(window.featureLayers['Shapes - Other']);
            }
            break;
        case 'query-results': // If layer is 'query-results'
            if (document.getElementById('layerQueryResults').checked) {
                window.featureLayers['Query Results'].addTo(map);
            } else {
                map.removeLayer(window.featureLayers['Query Results']);
            }
            break;
    }
}
// Focus map on specific coordinates with zoom level 10
function focusOnFeature(coords) {
    map.setView(coords, 10);
}

// Routes with trips and services //

// Cache for trips data to avoid redundant fetches
let tripsCache = {};

// Fetch trips for a given shape ID, with caching
async function fetchTripsForShape(shapeId) {
    // Check cache first
    if (tripsCache[shapeId]) { // If cached, return cached trips
        return tripsCache[shapeId];
    }
    
    try { // Try to fetch trip details for the shape ID
        
        // Use the trip_details endpoint that includes service_id
        const resp = await fetch(`/api/shapes/trip_details/?shape_id=${shapeId}`);
        if (resp.ok) { // If response is ok, parse and cache the trips
            const trips = await resp.json();
            tripsCache[shapeId] = Array.isArray(trips) ? trips : []; // Cache the trips
            return tripsCache[shapeId]; // Return the fetched trips
        }
    } catch (err) {// If any error occurs during the fetch, log debug message
        console.debug(`Could not fetch trip details for shape ${shapeId}:`, err.message);
    }
    
    return []; // Return empty array on error or no trips
}

// Load all route shapes with on-demand trip loading in popups
async function loadRoutesWithTripsAndServices() { // It tries to load all route shapes with on-demand trip loading
    console.log('Loading routes with on-demand trip loading...');
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.style.display = 'block'; // if the spinner exists show it
    
    try { // It tries to load all route shapes
        // Try to load from cache first
        console.log('Checking shape cache...');
        let shapes = await getCachedShapesFromIndexedDB(); // Get cached shapes from IndexedDB
        let fromCache = false;
        
        if (!shapes || shapes.length === 0) {// If no cached shapes, fetch from API
            console.log('Shape cache empty or expired, fetching from API...');
            const shapesResp = await fetch('/api/shapes/?limit=5000');
            const shapesData = await shapesResp.json();
            shapes = shapesData.results || [];
            
            // Cache the shapes for next time
            if (shapes && shapes.length > 0) { // If shapes were loaded, cache them
                try { // Try to cache the shapes
                    await cacheShapesInIndexedDB(shapes); // Cache the loaded shapes
                    console.log(`Successfully cached ${shapes.length} shapes to IndexedDB`);
                } catch (cacheErr) {
                    console.warn('Could not cache shapes:', cacheErr);
                }
            }
        } else { // Using cached shapes
            fromCache = true; // Mark that shapes are from cache
            console.log(`Successfully loaded ${shapes.length} shapes from cache`);
        }
        
        // Check if any shapes were loaded
        if (!shapes || shapes.length === 0) {
            console.warn('No shapes available');
            if (spinner) spinner.style.display = 'none';
            return; // Exit if no shapes
        }

        console.log(`Using ${shapes.length} shapes${fromCache ? ' from cache' : ' from API'}, rendering...`);
        
        // Render all shapes
        let renderedCount = 0;
        for (const shape of shapes) { // Loop through each shape
            try { // It tries to create and display a polyline for each shape

                // Display progress every 500 shapes
                const props = shape.properties;
                if (!props || !shape.geometry) continue; // Skip if no properties or geometry
                
                // Create polyline for this route
                //if shape is LineString
                if (shape.geometry.coordinates && shape.geometry.coordinates.length > 0) {
                    const coords = shape.geometry.coordinates.map(c => [c[1], c[0]]); // Convert to Leaflet latlngs
                    const routeColor = getRouteTypeColor(props.route_type); // Get color based on route type
                    
                    // Create polyline
                    const polyline = L.polyline(coords, {
                        color: routeColor,
                        weight: 3,
                        opacity: 0.7,
                        dashArray: '5, 5'
                    });
                    
                    // Create tooltip with route info
                    polyline.bindTooltip(// Bind tooltip to polyline
                        `${props.route_short_name} - ${props.route_long_name}`, 
                        {
                            permanent: false, // Show on hover
                            direction: 'top', // Position above the line
                            offset: [0, -10] // Offset upwards
                        }
                    );
                    
                    // Create popup that loads trips on-demand
                    const popupContent = `
                        <div class="popup-content" style="font-size: 12px; min-width: 350px; max-height: 500px; overflow-y: auto;">
                            <h6 style="margin: 0 0 10px 0; font-weight: bold;">
                                Route ${props.route_short_name}
                                <span style="background: ${routeColor}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-left: 5px;">
                                    ${getRouteTypeName(props.route_type)}
                                </span>
                            </h6>
                            
                            <div style="margin-bottom: 8px; color: #555;">
                                <strong>${props.route_long_name || 'No description'}</strong>
                            </div>
                            
                            <hr style="margin: 8px 0;">
                            
                            <div id="trips-${props.shape_id}" style="font-size: 11px;">
                                <div style="text-align: center; color: #999; padding: 20px 0;">
                                    <i class="fas fa-spinner fa-spin"></i> Loading trips...
                                </div>
                            </div>
                        </div>
                    `;
                    polyline.bindPopup(popupContent, { maxHeight: 500, maxWidth: 400 }); // Bind popup to polyline
                    
                    // Load trips when popup opens
                    polyline.on('popupopen', async function() { // Event listener for popup open
                        const tripsContainer = document.getElementById(`trips-${props.shape_id}`); // Get the trips container element
                        if (tripsContainer) { // If the container exists, load the trips
                            const trips = await fetchTripsForShape(props.shape_id); // Fetch trips for the shape ID
                            let html = ''; // Initialise HTML content
                            
                            // If no trips found, display message
                            if (!trips || trips.length === 0) { // If no trips found for the shape
                                html = '<small style="color: #999;">No trips found for this route</small>';
                            } else {
                                console.log(`Fetched ${trips.length} trips for shape ${props.shape_id}:`, trips);
                                
                                // Group trips by route number
                                const tripsByRouteNumber = {}; // Object to hold trips grouped by route number
                                trips.forEach(trip => { // Loop through each trip
                                    const routeNumber = trip.route_short_name || 'Unknown Route'; // Get route number
                                    
                                    // Initialise array for this route number if not already present
                                    if (!tripsByRouteNumber[routeNumber]) {
                                        tripsByRouteNumber[routeNumber] = []; // Initialise array for this route number
                                    }
                                    tripsByRouteNumber[routeNumber].push(trip); // Add trip to the appropriate route number group
                                });
                                
                                console.log(`Grouped into ${Object.keys(tripsByRouteNumber).length} unique route numbers:`, Object.keys(tripsByRouteNumber));
                                // Start building HTML content
                                html = '<div style="font-weight: bold; margin-bottom: 8px; color: #333;">Routes & Services:</div>';
                                
                                // Add each route number with its services
                                Object.entries(tripsByRouteNumber).forEach(([routeNumber, routeTrips]) => { // Loop through each route number group
                                    // Get the service type from first trip
                                    const firstTrip = routeTrips[0]; // Assume all trips have same route_type
                                    const serviceType = getRouteTypeName(firstTrip.route_type); // Get service type name
                                    const serviceTypeIcon = getRouteTypeIcon(firstTrip.route_type); // Get service type icon
                                    
                                    // Group this route's trips by service
                                    const servicesByRoute = {}; // Object to hold trips grouped by service
                                    routeTrips.forEach(trip => { // Loop through each trip for this route number
                                        const service = trip.service_id || 'Unknown'; // Get service ID
                                        
                                        // Initialise array for this service if not already present
                                        if (!servicesByRoute[service]) {
                                            servicesByRoute[service] = [];  // Initialise array for this service
                                        }
                                        servicesByRoute[service].push(trip); // Add trip to the appropriate service group
                                    });
                                    
                                    // Build HTML for this route number and its services
                                    html += `
                                        <div style="background: #f5f5f5; padding: 8px; margin-bottom: 8px; border-left: 3px solid ${routeColor}; border-radius: 2px;">
                                            <div style="font-weight: bold; color: #333; margin-bottom: 4px;">
                                                ${serviceTypeIcon} <span style="color: black; font-size: 14px;">${routeNumber}</span>
                                                <span style="background: ${getRouteTypeColor(firstTrip.route_type)}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px; margin-left: 8px;">
                                                    ${serviceType}
                                                </span>
                                            </div>
                                            <div style="font-size: 10px; color: #666; margin-left: 8px;">
                                                ${Object.entries(servicesByRoute).map(([service, trips]) => 
                                                    `Service ${service}: <strong>${trips.length}</strong> trip${trips.length !== 1 ? 's' : ''}`
                                                ).join('<br>')}
                                            </div>
                                        </div>
                                    `;
                                });
                            }
                            // Update the trips container with the generated HTML
                            tripsContainer.innerHTML = html;
                        }
                    });
                    
                    // Add to appropriate layer
                    const targetLayer = window.featureLayers[`Shapes - ${getRouteTypeLabel(props.route_type)}`] 
                        || window.featureLayers['Shapes - Other']; // Default to 'Other' layer if type not found
                    if (targetLayer) { // If target layer exists, add polyline to it
                        targetLayer.addLayer(polyline); // Add polyline to the target layer
                        renderedCount++; // Increment rendered routes counter
                    }
                }
            } catch (err) { // If any error occurs during polyline creation, it logs the error
                console.error('Error rendering shape:', err);
            }
        }

        console.log(`Successfully rendered ${renderedCount} routes (trips load on-demand when clicked)`);
        // Hide spinner when done
        if (spinner) spinner.style.display = 'none';
        
        // Mark routes as loaded
        routesLoaded = true;
    } catch (error) {
        console.error('Error loading routes:', error);
        if (spinner) spinner.style.display = 'none';
    }
}


//Get route type label for layer naming
function getRouteTypeLabel(routeType) {
    const labels = {
        '0': 'Tram',
        '1': 'Subway',
        '2': 'Rail',
        '3': 'Bus',
        '4': 'Ferry',
        '5': 'Cable Car',
        '6': 'Gondola',
        '7': 'Funicular',
        '11': 'Trolleybus',
        '12': 'Monorail'
    };
    return labels[String(routeType)] || 'Other';
}

// Clear query results from the map and UI
function clearQuery() {
    queryLayer.clearLayers();
    document.getElementById('queryResults').style.display = 'none';
    document.getElementById('resultsList').innerHTML = '';
}
