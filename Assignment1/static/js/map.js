/**
 * Transport API - Map Initialization and Management
 */

let map;
let vehicleMarkers = L.featureGroup();
let stopMarkers = L.featureGroup();
let routeLayer = L.featureGroup();
let queryLayer = L.featureGroup();
let autoRefreshInterval = null;
let layerControl = null;

// Track loaded stops and vehicles to avoid clearing
let loadedStops = new Set();
let loadedVehicles = new Set();

// Cache settings
const CACHE_KEY_STOPS = 'transport_stops_cache';
const CACHE_EXPIRY_MINUTES = 60; // Cache for 1 hour

function getCachedStops() {
    try {
        const cached = localStorage.getItem(CACHE_KEY_STOPS);
        if (!cached) return null;
        
        const data = JSON.parse(cached);
        const now = Date.now();
        
        // Check if cache is expired
        if (now - data.timestamp > CACHE_EXPIRY_MINUTES * 60 * 1000) {
            localStorage.removeItem(CACHE_KEY_STOPS);
            console.log('Stops cache expired');
            return null;
        }
        
        console.log('Using cached stops, age:', Math.round((now - data.timestamp) / 1000), 'seconds');
        return data.stops;
    } catch (e) {
        console.error('Error reading stops cache:', e);
        return null;
    }
}

function cacheStops(stops) {
    try {
        const data = {
            timestamp: Date.now(),
            stops: stops
        };
        localStorage.setItem(CACHE_KEY_STOPS, JSON.stringify(data));
        console.log('Cached', stops.length, 'stops');
    } catch (e) {
        console.error('Error caching stops:', e);
    }
}

window.addEventListener('DOMContentLoaded', initMap);

function initMap() {
    console.log('initMap called');
    const dublinLat = 53.3498;
    const dublinLon = -6.2603;

    const mapElement = document.getElementById('map');
    console.log('Map element:', mapElement);
    console.log('Map element size:', mapElement.offsetWidth, 'x', mapElement.offsetHeight);

    map = L.map('map').setView([dublinLat, dublinLon], 13);
    console.log('Leaflet map created:', map);

    // Initialize map with multiple tile layers and layer controls
    const { baseLayers, overlayLayers } = initializeMapWithLayers(map);
    console.log('Layers initialized', { baseLayers, overlayLayers });
    
    // Store references to overlay layers for data updates
    window.stopMarkersLayer = overlayLayers['Stops'];
    window.vehicleMarkersLayer = overlayLayers['Vehicles'];
    window.queryLayer = overlayLayers['Query Results'];
    
    console.log('Overlay layers assigned:', {
        stopMarkersLayer: window.stopMarkersLayer,
        vehicleMarkersLayer: window.vehicleMarkersLayer,
        queryLayer: window.queryLayer
    });

    // Add map event listeners
    map.on('moveend', function() {
        console.log('Map moved');
        updateMapBounds();
        loadVehicles();
        loadStops();
    });

    // Initial data load
    console.log('Starting initial data load');
    loadVehicles();
    loadStops();
    updateStatistics();
    
    console.log('Map initialized with multiple tile layers');
}


async function loadVehicles() {
    try {
        console.log('loadVehicles called');
        const bounds = map.getBounds();
        console.log('Map bounds:', bounds);
        const url = `/api/vehicles/in_bounds/?min_lat=${bounds.getSouth()}&max_lat=${bounds.getNorth()}&min_lon=${bounds.getWest()}&max_lon=${bounds.getEast()}`;
        
        console.log('Loading vehicles from:', url);
        const response = await fetch(url);
        const data = await response.json();

        console.log('Vehicles response:', data);
        
        if (!data.results) {
            console.warn('No results in response');
            return;
        }

        // Handle both array and FeatureCollection formats
        let vehicles = data.results;
        if (data.results.features && Array.isArray(data.results.features)) {
            // GeoFeatureModelSerializer returns FeatureCollection with features array
            vehicles = data.results.features;
            console.log('Using features array from FeatureCollection');
        } else if (!Array.isArray(data.results)) {
            console.warn('Results is not an array and no features found', typeof data.results);
            return;
        }

        // Use the overlay layer or fallback to vehicleMarkers
        const vehiclesLayer = window.vehicleMarkersLayer || vehicleMarkers;
        console.log('Using vehiclesLayer:', vehiclesLayer);
        // Don't clear - only add new vehicles
        
        if (vehicles.length > 0) {
            console.log('Adding', vehicles.length, 'vehicles (without clearing existing)');
            vehicles.forEach((vehicle, idx) => {
                try {
                    const vehicleKey = vehicle.properties?.vehicle_id || vehicle.id;
                    if (!loadedVehicles.has(vehicleKey)) {
                        const marker = createVehicleMarker(vehicle);
                        vehiclesLayer.addLayer(marker);
                        loadedVehicles.add(vehicleKey);
                    }
                } catch (e) {
                    console.error('Error creating marker for vehicle', idx, ':', e);
                }
            });
            console.log('Vehicles loaded successfully. Total unique vehicles:', loadedVehicles.size);
        } else {
            console.log('No vehicles in response');
        }

        updateStatistics();
    } catch (error) {
        console.error('Error loading vehicles:', error);
    }
}

async function loadStops() {
    try {
        // Check cache first
        let stops = getCachedStops();
        let fromCache = false;
        
        if (stops && stops.length > 0) {
            // Use cached stops
            console.log('Using cached stops');
            fromCache = true;
        } else {
            // Fetch from API if not in cache
            console.log('Loading all stops from API (paginated)');
            stops = [];
            let page = 1;
            let hasMore = true;
            
            while (hasMore) {
                const offset = (page - 1) * 10000;
                const url = `/api/stops/?limit=10000&offset=${offset}`;
                console.log('Fetching page', page, ':', url);
                
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error('API response not ok:', response.status, response.statusText);
                    break;
                }
                
                const data = await response.json();
                
                console.log('Page', page, 'full response:', JSON.stringify(data).substring(0, 500));
                console.log('Page', page, 'response keys:', Object.keys(data));
                console.log('Page', page, 'data.results type:', typeof data.results);
                
                if (!data.results) {
                    console.warn('No results in response');
                    break;
                }

                // Handle both array and Feature formats
                let pageStops = [];
                if (Array.isArray(data.results)) {
                    // Standard array format (new simple serializer returns array of Features)
                    pageStops = data.results;
                    console.log('Using results as array of Features');
                } else if (data.results.features && Array.isArray(data.results.features)) {
                    // GeoFeatureModelSerializer returns FeatureCollection with features array inside results
                    pageStops = data.results.features;
                    console.log('Extracted features array from GeoFeatureModelSerializer FeatureCollection');
                } else {
                    console.warn('Results is not an array and has no features:', typeof data.results, data.results);
                    break;
                }
                
                stops = stops.concat(pageStops);
                console.log('Loaded', pageStops.length, 'stops from page', page, '. Total so far:', stops.length);
                
                // Check if there are more pages
                hasMore = data.next ? true : false;
                page++;
            }
            
            console.log('Finished loading all pages. Total stops:', stops.length);
            
            // Cache the stops
            if (stops.length > 0) {
                cacheStops(stops);
            }
        }

        // Use the overlay layer or fallback to stopMarkers
        const stopsLayer = window.stopMarkersLayer || stopMarkers;
        console.log('Using stopsLayer:', stopsLayer);
        
        console.log('Adding', stops.length, 'stops from', fromCache ? 'cache' : 'API');
        stops.forEach((stop, idx) => {
            try {
                const stopKey = stop.properties?.stop_id || stop.id;
                if (!loadedStops.has(stopKey)) {
                    const marker = createStopMarker(stop);
                    stopsLayer.addLayer(marker);
                    loadedStops.add(stopKey);
                }
            } catch (e) {
                console.error('Error creating marker for stop', idx, ':', e);
            }
        });
        console.log('Stops loaded successfully. Total unique stops:', loadedStops.size);
    } catch (error) {
        console.error('Error loading stops:', error);
    }
}

function createVehicleMarker(vehicle) {
    const coords = vehicle.geometry.coordinates;
    const props = vehicle.properties || vehicle;
    
    const marker = L.circleMarker([coords[1], coords[0]], {
        radius: 6,
        fillColor: '#f39c12',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
    });

    const popupContent = `
        <div class="popup-content">
            <strong>${props.vehicle_id}</strong><br>
            Route: ${props.route_short_name || 'N/A'}<br>
            Speed: ${props.speed ? parseFloat(props.speed).toFixed(1) : 'N/A'} km/h<br>
            Status: <span class="badge badge-${props.status}">${props.status}</span><br>
            <small class="text-muted">${new Date(props.timestamp).toLocaleTimeString()}</small>
        </div>
    `;
    marker.bindPopup(popupContent);
    return marker;
}

function createStopMarker(stop) {
    try {
        const coords = stop.geometry.coordinates;
        const props = stop.properties || stop;
        
        console.log('Creating stop marker:', { coords, stop_name: props.stop_name });
        
        const marker = L.circleMarker([coords[1], coords[0]], {
            radius: 10,
            fillColor: '#27ae60',
            color: '#fff',
            weight: 1.5,
            opacity: 1,
            fillOpacity: 0.75
        });

        const popupContent = `
            <div class="popup-content">
                <strong>${props.stop_name}</strong><br>
                Code: ${props.stop_code || 'N/A'}<br>
                Type: ${props.stop_type || 'Stop'}<br>
                Stop Name: <strong>${props.stop_name}</strong><br>
                Agency: ${props.agencies && props.agencies.length > 0 ? '<strong>Agencies:</strong> ' + props.agencies.join(', ') : 'No agencies'}<br>
                ♿ Wheelchair accessible: ${props.wheelchair_boarding }<br>
            </div>
        `;
        marker.bindPopup(popupContent);
        return marker;
    } catch (e) {
        console.error('Error creating stop marker:', e, stop);
        throw e;
    }
}

function updateMapBounds() {
    const bounds = map.getBounds();
    document.getElementById('bboxMinLat').value = bounds.getSouth().toFixed(4);
    document.getElementById('bboxMaxLat').value = bounds.getNorth().toFixed(4);
    document.getElementById('bboxMinLon').value = bounds.getWest().toFixed(4);
    document.getElementById('bboxMaxLon').value = bounds.getEast().toFixed(4);
}

async function updateStatistics() {
    try {
        const vehiclesResp = await fetch('/api/vehicles/?limit=1');
        const stopsResp = await fetch('/api/stops/?limit=1');
        const routesResp = await fetch('/api/routes/?limit=1');

        const vehiclesData = await vehiclesResp.json();
        const stopsData = await stopsResp.json();
        const routesData = await routesResp.json();

        document.getElementById('vehicleCount').textContent = vehiclesData.count || 0;
        document.getElementById('stopCount').textContent = stopsData.count || 0;
        document.getElementById('routeCount').textContent = routesData.count || 0;

        if (vehiclesData.results && vehiclesData.results.length > 0) {
            const speeds = vehiclesData.results
                .map(v => v.properties ? v.properties.speed : v.speed)
                .filter(s => s)
                .map(s => parseFloat(s));
            const avgSpeed = speeds.length > 0 ? (speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1) : '--';
            document.getElementById('avgSpeed').textContent = avgSpeed + ' km/h';
        }
    } catch (error) {
        console.error('Error updating statistics:', error);
    }
}

function toggleLayer(layerName) {
    switch(layerName) {
        case 'vehicles':
            if (document.getElementById('layerVehicles').checked) {
                vehicleMarkers.addTo(map);
            } else {
                map.removeLayer(vehicleMarkers);
            }
            break;
        case 'stops':
            if (document.getElementById('layerStops').checked) {
                stopMarkers.addTo(map);
            } else {
                map.removeLayer(stopMarkers);
            }
            break;
    }
}

function toggleAutoRefresh() {
    const interval = parseInt(document.getElementById('refreshInterval').value) * 1000;
    const button = event.target;

    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        button.textContent = '▶️ Start Auto-refresh';
        button.classList.remove('btn-danger');
        button.classList.add('btn-secondary');
    } else {
        autoRefreshInterval = setInterval(() => {
            loadVehicles();
            loadStops();
            updateStatistics();
        }, interval);
        button.textContent = '⏹️ Stop Auto-refresh';
        button.classList.remove('btn-secondary');
        button.classList.add('btn-danger');
    }
}

function focusOnFeature(coords) {
    map.setView(coords, 16);
}

function clearQuery() {
    queryLayer.clearLayers();
    document.getElementById('queryResults').style.display = 'none';
    document.getElementById('resultsList').innerHTML = '';
}
