/**
 * Transport API - Map Initialization and Management
 */

let map;
let stopMarkers = L.featureGroup();
let routeLayer = L.featureGroup();
let queryLayer = L.featureGroup();
let layerControl = null;

// Track loaded stops to avoid clearing
let loadedStops = new Set();

// Track if routes have been loaded
let routesLoaded = false;

// Cache settings
const CACHE_KEY_STOPS = 'transport_stops_cache';
const CACHE_KEY_SHAPES = 'transport_shapes_cache';
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

// Route type mapping (GTFS standard)
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

function getRouteTypeName(routeType) {
    return ROUTE_TYPES[routeType] || `Type ${routeType}`;
}

function getRouteTypeColor(routeType) {
    return ROUTE_TYPE_COLORS[routeType] || '#3498db';
}

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

function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

async function getCachedShapesFromIndexedDB() {
    try {
        const db = await initIndexedDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get('shapes_data');
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const result = request.result;
                if (result && result.timestamp) {
                    const now = Date.now();
                    const age = now - result.timestamp;
                    
                    // Check if cache is expired (1 hour)
                    if (age > CACHE_EXPIRY_MINUTES * 60 * 1000) {
                        console.log('Shapes cache expired');
                        resolve(null);
                    } else {
                        console.log('Using cached shapes from IndexedDB, age:', Math.round(age / 1000), 'seconds');
                        resolve(result.shapes);
                    }
                } else {
                    resolve(null);
                }
            };
        });
    } catch (e) {
        console.warn('IndexedDB read error:', e);
        return null;
    }
}

async function cacheShapesInIndexedDB(shapes) {
    try {
        const db = await initIndexedDB();
        const data = {
            id: 'shapes_data',
            timestamp: Date.now(),
            shapes: shapes
        };
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(data);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                console.log('Cached', shapes.length, 'shapes in IndexedDB');
                resolve();
            };
        });
    } catch (e) {
        console.warn('IndexedDB write error:', e);
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
    window.featureLayers = overlayLayers;  // Store all feature layers
    window.stopMarkersLayer = overlayLayers['Stops'];
    window.shapesLayer = overlayLayers;  // Store all shape layers for reference
    window.queryLayer = overlayLayers['Query Results'];
    
    console.log('Overlay layers assigned:', {
        stopMarkersLayer: window.stopMarkersLayer,
        shapesLayer: window.shapesLayer,
        queryLayer: window.queryLayer,
        featureLayers: window.featureLayers
    });

    // Add map event listeners
    map.on('moveend', function() {
        console.log('Map moved');
        updateMapBounds();
    });

    // Add map click handler to update nearest stop coordinates
    map.on('click', function(e) {
        const lat = e.latlng.lat;
        const lon = e.latlng.lng;
        
        // Update radius search inputs
        const radiusLatInput = document.getElementById('radiusLat');
        const radiusLonInput = document.getElementById('radiusLon');
        if (radiusLatInput && radiusLonInput) {
            radiusLatInput.value = lat.toFixed(4);
            radiusLonInput.value = lon.toFixed(4);
            console.log(`Updated radius search coordinates to: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
        }
        
        // Update nearest stops inputs if they exist
        const nearestLatInput = document.getElementById('nearestLat');
        const nearestLonInput = document.getElementById('nearestLon');
        if (nearestLatInput && nearestLonInput) {
            nearestLatInput.value = lat.toFixed(4);
            nearestLonInput.value = lon.toFixed(4);
            console.log(`Updated nearest stops coordinates to: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
        }
        
        // Also update bounding box with a small area around the click point
        const delta = 0.02; // ~2km area
        const minLatInput = document.getElementById('bboxMinLat');
        const maxLatInput = document.getElementById('bboxMaxLat');
        const minLonInput = document.getElementById('bboxMinLon');
        const maxLonInput = document.getElementById('bboxMaxLon');
        
        if (minLatInput && maxLatInput && minLonInput && maxLonInput) {
            minLatInput.value = (lat - delta).toFixed(4);
            maxLatInput.value = (lat + delta).toFixed(4);
            minLonInput.value = (lon - delta).toFixed(4);
            maxLonInput.value = (lon + delta).toFixed(4);
            console.log(`Updated bounding box around: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
        }
    });

    // Initial data load - load routes in background but don't show them
    console.log('Starting initial data load');
    loadRoutesWithTripsAndServices();  // Load routes with trips and services (replaces loadShapesAndDisplay)
    
    console.log('Map initialized with all layers unchecked');
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
        
        // Update statistics with loaded stops
        updateStatistics();
    } catch (error) {
        console.error('Error loading stops:', error);
    }
}

function createStopMarker(stop) {
    try {
        const coords = stop.geometry.coordinates;
        const props = stop.properties || stop;
        const stopId = props.id || stop.id;
        
        console.log('Creating stop marker:', { coords, stop_name: props.stop_name });
        
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
        marker.bindPopup(popupContent);
        
        // Load schedules when popup opens
        marker.on('popupopen', async function() {
            const schedulesContainer = document.getElementById(`schedules-${stopId}`);
            if (schedulesContainer) {
                const schedules = await loadStopSchedules(stopId);
                
                if (schedules && schedules.length > 0) {
                    let schedulesHtml = '<strong>Upcoming Trips:</strong><br>';
                    schedules.slice(0, 10).forEach(schedule => {
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
                    schedulesContainer.innerHTML = schedulesHtml;
                    if (schedules.length > 10) {
                        schedulesContainer.innerHTML += `<small style="color: #999;">... and ${schedules.length - 10} more trips</small>`;
                    }
                } else {
                    schedulesContainer.innerHTML = '<small style="color: #999;">No schedules available</small>';
                }
            }
        });
        
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
        // Count loaded stops from the layer
        const stopsLayer = window.featureLayers['Stops'] || window.stopMarkersLayer;
        const stopCount = stopsLayer ? stopsLayer.getLayers().length : 0;
        
        // Count loaded routes from all shape layers
        let routeCount = 0;
        const shapeLayerNames = ['Shapes - Bus', 'Shapes - Rail', 'Shapes - Tram', 'Shapes - Ferry', 'Shapes - Other'];
        shapeLayerNames.forEach(layerName => {
            const layer = window.featureLayers[layerName];
            if (layer) {
                routeCount += layer.getLayers().length;
            }
        });
        
        document.getElementById('stopCount').textContent = stopCount;
        document.getElementById('routeCount').textContent = routeCount;
        
        console.log(`Updated statistics: ${stopCount} stops, ${routeCount} routes`);
    } catch (error) {
        console.error('Error updating statistics:', error);
    }
}

async function loadShapeBusNumbers(shapeId) {
    try {
        console.log('Loading bus numbers for shape:', shapeId);
        // Fetch trips that use this shape and get unique route short names
        const response = await fetch(`/api/shapes/trips/?shape_id=${shapeId}`);
        
        if (!response.ok) {
            console.error('Failed to load trips for shape:', response.status);
            return [];
        }
        
        const data = await response.json();
        const busNumbers = new Set();
        
        if (Array.isArray(data)) {
            data.forEach(trip => {
                if (trip.route_short_name) {
                    busNumbers.add(trip.route_short_name);
                }
            });
        }
        
        return Array.from(busNumbers).sort((a, b) => {
            // Sort numerically if both are numbers, otherwise alphabetically
            const aNum = parseInt(a);
            const bNum = parseInt(b);
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return aNum - bNum;
            }
            return a.localeCompare(b);
        });
    } catch (error) {
        console.error('Error loading shape bus numbers:', error);
        return [];
    }
}

async function loadShapesAndDisplay() {
    try {
        console.log('Loading and displaying route shapes...');
        const shapeLayer = window.shapesLayer;
        
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
        const spinner = document.getElementById('loading-spinner');
        const spinnerText = document.getElementById('loading-text');
        
        if (!shapeLayer) {
            console.error('Shape layer not found in window scope');
            return;
        }
        
        // Check IndexedDB cache first
        let shapes = await getCachedShapesFromIndexedDB();
        
        if (!shapes || shapes.length === 0) {
            console.log('Loading shapes from API in batches');
            if (spinner) spinner.style.display = 'block';
            
            shapes = [];
            let offset = 0;
            const batchSize = 1000;
            let totalCount = 0;
            let hasMore = true;
            
            while (hasMore) {
                try {
                    if (spinnerText) spinnerText.textContent = `Loading shapes... (${shapes.length} loaded)`;
                    
                    const url = `/api/shapes/?limit=${batchSize}&offset=${offset}`;
                    console.log(`Fetching shapes batch at offset ${offset}`);
                    
                    const response = await fetch(url);
                    
                    if (!response.ok) {
                        console.error('Failed to load shapes:', response.status, response.statusText);
                        if (spinner) spinner.style.display = 'none';
                        return;
                    }
                    
                    const data = await response.json();
                    totalCount = data.count;
                    
                    if (!data.results || data.results.length === 0) {
                        hasMore = false;
                        break;
                    }
                    
                    shapes = shapes.concat(data.results);
                    offset += batchSize;
                    
                    console.log(`Loaded ${shapes.length} of ${totalCount} shapes`);
                    
                    // Check if we got all shapes
                    if (shapes.length >= totalCount) {
                        hasMore = false;
                    }
                } catch (err) {
                    console.error('Error fetching shapes batch:', err);
                    hasMore = false;
                }
            }
            
            // Cache the shapes in IndexedDB
            if (shapes.length > 0) {
                await cacheShapesInIndexedDB(shapes);
            }
        } else {
            console.log('Using cached shapes from IndexedDB');
            if (spinner) spinner.style.display = 'block';
        }
        
        console.log('Shapes loaded:', {
            count: shapes.length
        });
        
        if (shapes && Array.isArray(shapes)) {
            let count = 0;
            let skipCount = 0;
            
            shapes.forEach((feature, idx) => {
                try {
                    if (!feature.geometry) {
                        skipCount++;
                        return;
                    }
                    
                    if (feature.geometry.type !== 'LineString') {
                        skipCount++;
                        return;
                    }
                    
                    if (!feature.geometry.coordinates || feature.geometry.coordinates.length === 0) {
                        skipCount++;
                        return;
                    }
                    
                    const latlngs = feature.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                    
                    const props = feature.properties;
                    const routeColor = getRouteTypeColor(props.route_type);
                    
                    const polyline = L.polyline(latlngs, {
                        color: routeColor,
                        weight: 3,
                        opacity: 0.7,
                        dashArray: '5, 5'
                    });
                    
                    // Add bus number as tooltip
                    polyline.bindTooltip(`Bus ${props.route_short_name}`, {
                        permanent: false,
                        direction: 'top',
                        offset: [0, -10]
                    });
                    
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
                    polyline.bindPopup(popupContent);
                    
                    // Load bus numbers when popup opens
                    polyline.on('popupopen', async function() {
                        const busNumbersContainer = document.getElementById(`bus-numbers-${props.shape_id}`);
                        if (busNumbersContainer) {
                            const busNumbers = await loadShapeBusNumbers(props.shape_id);
                            
                            if (busNumbers && busNumbers.length > 0) {
                                let html = '<strong>Bus Routes:</strong><br>';
                                busNumbers.forEach(busNum => {
                                    html += `<span style="display: inline-block; background: #e0e0e0; padding: 4px 8px; margin: 2px; border-radius: 3px; font-weight: bold;">${busNum}</span> `;
                                });
                                busNumbersContainer.innerHTML = html;
                            } else {
                                busNumbersContainer.innerHTML = '<small style="color: #999;">No bus numbers found</small>';
                            }
                        }
                    });
                    
                    // Add to appropriate service type layer
                    const routeTypeStr = String(props.route_type);
                    const targetLayer = serviceTypeLayers[routeTypeStr] || window.featureLayers['Shapes - Other'];
                    targetLayer.addLayer(polyline);
                    count++;
                } catch (err) {
                    console.error(`Error processing shape ${idx}:`, err);
                    skipCount++;
                }
            });
            
            console.log(`Loaded and displayed ${count} route shapes (skipped ${skipCount})`);
        } else {
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

async function loadShapes() {
    try {
        console.log('Loading route shapes...');
        const response = await fetch('/api/shapes/?limit=10000');
        
        if (!response.ok) {
            console.error('Failed to load shapes:', response.status);
            return;
        }
        
        const data = await response.json();
        const shapeLayer = L.featureGroup();
        
        if (data.results && Array.isArray(data.results)) {
            data.results.forEach(feature => {
                if (feature.geometry && feature.geometry.type === 'LineString') {
                    const polyline = L.polyline(
                        feature.geometry.coordinates.map(coord => [coord[1], coord[0]]),
                        {
                            color: '#3498db',
                            weight: 3,
                            opacity: 0.6,
                            dashArray: '5, 5'
                        }
                    );
                    
                    const props = feature.properties;
                    const popupContent = `
                        <div class="popup-content">
                            <strong>Route ${props.route_short_name}</strong><br>
                            ${props.route_long_name}<br>
                            Shape ID: ${props.shape_id}
                        </div>
                    `;
                    polyline.bindPopup(popupContent);
                    shapeLayer.addLayer(polyline);
                }
            });
        }
        
        console.log('Loaded', shapeLayer.getLayers().length, 'route shapes');
        return shapeLayer;
    } catch (error) {
        console.error('Error loading shapes:', error);
    }
}

async function loadStopSchedules(stopId) {
    try {
        console.log('Loading schedules for stop:', stopId);
        const response = await fetch(`/api/stops/${stopId}/schedules/`);
        
        if (!response.ok) {
            console.error('Failed to load schedules:', response.status);
            return null;
        }
        
        const data = await response.json();
        return data.schedules || [];
    } catch (error) {
        console.error('Error loading schedules:', error);
        return [];
    }
}

function toggleLayer(layerName) {
    switch(layerName) {
        case 'stops':
            if (document.getElementById('layerStops').checked) {
                loadStops().then(() => {
                    window.featureLayers['Stops'].addTo(map);
                    updateStatistics();
                });
            } else {
                map.removeLayer(window.featureLayers['Stops']);
            }
            break;
        case 'shapes-bus':
            if (document.getElementById('layerShapesBus').checked) {
                if (!routesLoaded) {
                    loadRoutesWithTripsAndServices().then(() => {
                        window.featureLayers['Shapes - Bus'].addTo(map);
                    });
                } else {
                    window.featureLayers['Shapes - Bus'].addTo(map);
                }
            } else {
                map.removeLayer(window.featureLayers['Shapes - Bus']);
            }
            break;
        case 'shapes-rail':
            if (document.getElementById('layerShapesRail').checked) {
                if (!routesLoaded) {
                    loadRoutesWithTripsAndServices().then(() => {
                        window.featureLayers['Shapes - Rail'].addTo(map);
                    });
                } else {
                    window.featureLayers['Shapes - Rail'].addTo(map);
                }
            } else {
                map.removeLayer(window.featureLayers['Shapes - Rail']);
            }
            break;
        case 'shapes-tram':
            if (document.getElementById('layerShapesTram').checked) {
                if (!routesLoaded) {
                    loadRoutesWithTripsAndServices().then(() => {
                        window.featureLayers['Shapes - Tram'].addTo(map);
                    });
                } else {
                    window.featureLayers['Shapes - Tram'].addTo(map);
                }
            } else {
                map.removeLayer(window.featureLayers['Shapes - Tram']);
            }
            break;
        case 'shapes-other':
            if (document.getElementById('layerShapesOther').checked) {
                if (!routesLoaded) {
                    loadRoutesWithTripsAndServices().then(() => {
                        window.featureLayers['Shapes - Other'].addTo(map);
                    });
                } else {
                    window.featureLayers['Shapes - Other'].addTo(map);
                }
            } else {
                map.removeLayer(window.featureLayers['Shapes - Other']);
            }
            break;
        case 'query-results':
            if (document.getElementById('layerQueryResults').checked) {
                window.featureLayers['Query Results'].addTo(map);
            } else {
                map.removeLayer(window.featureLayers['Query Results']);
            }
            break;
    }
}

function focusOnFeature(coords) {
    map.setView(coords, 16);
}

// ==================== ROUTES WITH TRIPS AND SERVICES ====================

// Cache for trips data to avoid redundant fetches
let tripsCache = {};

/**
 * Fetch and cache trips for a specific shape (on-demand)
 */
async function fetchTripsForShape(shapeId) {
    // Check cache first
    if (tripsCache[shapeId]) {
        return tripsCache[shapeId];
    }
    
    try {
        // Use the new trip_details endpoint that includes service_id
        const resp = await fetch(`/api/shapes/trip_details/?shape_id=${shapeId}`);
        if (resp.ok) {
            const trips = await resp.json();
            tripsCache[shapeId] = Array.isArray(trips) ? trips : [];
            return tripsCache[shapeId];
        }
    } catch (err) {
        console.debug(`Could not fetch trip details for shape ${shapeId}:`, err.message);
    }
    
    return [];
}

/**
 * Load routes with trips and services
 * Fetches shapes and loads trip data on-demand when popups are opened
 */
async function loadRoutesWithTripsAndServices() {
    console.log('Loading routes with on-demand trip loading...');
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.style.display = 'block';
    
    try {
        // Try to load from cache first
        console.log('Checking shape cache...');
        let shapes = await getCachedShapesFromIndexedDB();
        let fromCache = false;
        
        if (!shapes || shapes.length === 0) {
            // Fetch from API if not cached
            console.log('Shape cache empty or expired, fetching from API...');
            const shapesResp = await fetch('/api/shapes/?limit=5000');
            const shapesData = await shapesResp.json();
            shapes = shapesData.results || [];
            
            // Cache the shapes for next time
            if (shapes && shapes.length > 0) {
                try {
                    await cacheShapesInIndexedDB(shapes);
                    console.log(`✓ Cached ${shapes.length} shapes to IndexedDB`);
                } catch (cacheErr) {
                    console.warn('Could not cache shapes:', cacheErr);
                }
            }
        } else {
            fromCache = true;
            console.log(`✓ Loaded ${shapes.length} shapes from cache (fast!)`);
        }
        
        if (!shapes || shapes.length === 0) {
            console.warn('No shapes available');
            if (spinner) spinner.style.display = 'none';
            return;
        }

        console.log(`Using ${shapes.length} shapes${fromCache ? ' from cache' : ' from API'}, rendering...`);
        
        // Render all shapes
        let renderedCount = 0;
        for (const shape of shapes) {
            try {
                const props = shape.properties;
                if (!props || !shape.geometry) continue;
                
                // Create polyline for this route
                if (shape.geometry.coordinates && shape.geometry.coordinates.length > 0) {
                    const coords = shape.geometry.coordinates.map(c => [c[1], c[0]]);
                    const routeColor = getRouteTypeColor(props.route_type);
                    
                    const polyline = L.polyline(coords, {
                        color: routeColor,
                        weight: 3,
                        opacity: 0.7,
                        dashArray: '5, 5'
                    });
                    
                    // Create tooltip with route info
                    polyline.bindTooltip(
                        `${props.route_short_name} - ${props.route_long_name}`, 
                        {
                            permanent: false,
                            direction: 'top',
                            offset: [0, -10]
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
                    polyline.bindPopup(popupContent, { maxHeight: 500, maxWidth: 400 });
                    
                    // Load trips when popup opens
                    polyline.on('popupopen', async function() {
                        const tripsContainer = document.getElementById(`trips-${props.shape_id}`);
                        if (tripsContainer) {
                            const trips = await fetchTripsForShape(props.shape_id);
                            let html = '';
                            
                            if (!trips || trips.length === 0) {
                                html = '<small style="color: #999;">No trips found for this route</small>';
                            } else {
                                console.log(`Fetched ${trips.length} trips for shape ${props.shape_id}:`, trips);
                                
                                // Group trips by route_short_name (number)
                                const tripsByRouteNumber = {};
                                trips.forEach(trip => {
                                    const routeNumber = trip.route_short_name || 'Unknown Route';
                                    if (!tripsByRouteNumber[routeNumber]) {
                                        tripsByRouteNumber[routeNumber] = [];
                                    }
                                    tripsByRouteNumber[routeNumber].push(trip);
                                });
                                
                                console.log(`Grouped into ${Object.keys(tripsByRouteNumber).length} unique route numbers:`, Object.keys(tripsByRouteNumber));
                                
                                html = '<div style="font-weight: bold; margin-bottom: 8px; color: #333;">Routes & Services:</div>';
                                
                                // Add each route number with its services
                                Object.entries(tripsByRouteNumber).forEach(([routeNumber, routeTrips]) => {
                                    // Get the service type from first trip
                                    const firstTrip = routeTrips[0];
                                    const serviceType = getRouteTypeName(firstTrip.route_type);
                                    const serviceTypeIcon = getRouteTypeIcon(firstTrip.route_type);
                                    
                                    // Group this route's trips by service
                                    const servicesByRoute = {};
                                    routeTrips.forEach(trip => {
                                        const service = trip.service_id || 'Unknown';
                                        if (!servicesByRoute[service]) {
                                            servicesByRoute[service] = [];
                                        }
                                        servicesByRoute[service].push(trip);
                                    });
                                    
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
                            
                            tripsContainer.innerHTML = html;
                        }
                    });
                    
                    // Add to appropriate layer
                    const targetLayer = window.featureLayers[`Shapes - ${getRouteTypeLabel(props.route_type)}`] 
                        || window.featureLayers['Shapes - Other'];
                    if (targetLayer) {
                        targetLayer.addLayer(polyline);
                        renderedCount++;
                    }
                }
            } catch (err) {
                console.error('Error rendering shape:', err);
            }
        }
        
        console.log(`✓ Rendered ${renderedCount} routes (trips load on-demand when clicked)`);
        
        if (spinner) spinner.style.display = 'none';
        
        // Mark routes as loaded
        routesLoaded = true;
        
        // Update statistics with loaded routes
        updateStatistics();
    } catch (error) {
        console.error('Error loading routes:', error);
        if (spinner) spinner.style.display = 'none';
    }
}

/**
 * Create popup content for routes showing trips and services
 */
/**
 * Get route type label for layer naming
 */
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

// ==================== END ROUTES WITH TRIPS ====================

function clearQuery() {
    queryLayer.clearLayers();
    document.getElementById('queryResults').style.display = 'none';
    document.getElementById('resultsList').innerHTML = '';
}
