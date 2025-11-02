/**
 * Transport API - Spatial Query Execution
 * 
 * This module handles:
 * - Radius search queries (find stops within distance)
 * - Bounding box queries (find stops in rectangular area)
 * - Advanced queries (k-nearest, stops on route)
 * - Result display and pagination
 * - Map marker and route visualization
 * - API communication with backend
 */

// ===== BOUNDS QUERY HELPERS =====

/**
 * Update temporary marker positions when bounds input values change
 * Shows visual feedback as user enters coordinates
 */
function updateBoundsMarkers() {
    const minLat = parseFloat(document.getElementById('bboxMinLat').value);
    const maxLat = parseFloat(document.getElementById('bboxMaxLat').value);
    const minLon = parseFloat(document.getElementById('bboxMinLon').value);
    const maxLon = parseFloat(document.getElementById('bboxMaxLon').value);
    
    if (!isNaN(minLat) && !isNaN(minLon)) {
        if (!window.boundsMarkers) window.boundsMarkers = {};
        
        // Create or update point1 marker
        if (window.boundsMarkers.point1) {
            window.boundsMarkers.point1.setLatLng([minLat, minLon]);
        } else {
            // Create a marker with a label
            const marker1Icon = L.divIcon({
                className: 'bounds-marker-label',
                html: '<div style="background: #9b59b6; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">1</div>',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });
            
            window.boundsMarkers.point1 = L.marker([minLat, minLon], { icon: marker1Icon })
                .bindPopup(`<strong>Marker 1</strong><br>Lat: ${minLat.toFixed(4)}<br>Lon: ${minLon.toFixed(4)}`);
            if (window.queryLayer) {
                window.queryLayer.addLayer(window.boundsMarkers.point1);
            }
        }
    }
    
    if (!isNaN(maxLat) && !isNaN(maxLon)) {
        if (!window.boundsMarkers) window.boundsMarkers = {};
        
        // Create or update point2 marker
        if (window.boundsMarkers.point2) {
            window.boundsMarkers.point2.setLatLng([maxLat, maxLon]);
        } else {
            // Create a marker with a label
            const marker2Icon = L.divIcon({
                className: 'bounds-marker-label',
                html: '<div style="background: #9b59b6; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">2</div>',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });
            
            window.boundsMarkers.point2 = L.marker([maxLat, maxLon], { icon: marker2Icon })
                .bindPopup(`<strong>Marker 2</strong><br>Lat: ${maxLat.toFixed(4)}<br>Lon: ${maxLon.toFixed(4)}`);
            if (window.queryLayer) {
                window.queryLayer.addLayer(window.boundsMarkers.point2);
            }
        }
    }
}

// Add event listeners to bounds input fields
document.addEventListener('DOMContentLoaded', function() {
    ['bboxMinLat', 'bboxMaxLat', 'bboxMinLon', 'bboxMaxLon'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', updateBoundsMarkers);
            element.addEventListener('input', updateBoundsMarkers);
        }
    });
});

async function performRadiusSearch() {
    let lat, lon;
    
    // Use Marker 1 if it exists, otherwise use input values
    if (window.boundsMarkers && window.boundsMarkers.point1) {
        const markerLatLng = window.boundsMarkers.point1.getLatLng();
        lat = markerLatLng.lat;
        lon = markerLatLng.lng;
    } else {
        lat = parseFloat(document.getElementById('radiusLat').value);
        lon = parseFloat(document.getElementById('radiusLon').value);
    }
    
    const radius = parseInt(document.getElementById('radiusDistance').value);
    const queryType = document.getElementById('radiusType').value;

    if (isNaN(lat) || isNaN(lon) || isNaN(radius)) {
        alert('Please enter valid coordinates and radius, or click on the map to create Marker 1');
        return;
    }

    try {
        const layer = window.queryLayer || queryLayer;
        layer.clearLayers();
        
        // Recreate markers if they exist
        if (window.boundsMarkers && window.boundsMarkers.point1) {
            layer.addLayer(window.boundsMarkers.point1);
        }
        if (window.boundsMarkers && window.boundsMarkers.point2) {
            layer.addLayer(window.boundsMarkers.point2);
        }
        
        const circle = L.circle([lat, lon], {
            radius: radius,
            color: 'blue',
            fill: false,
            weight: 2,
            dashArray: '5, 5',
            opacity: 0.7
        });
        layer.addLayer(circle);

        if (queryType === 'routes') {
            // For routes, we need to search for shapes/routes near the point
            const distanceKm = radius / 1000;
            const endpoint = `/api/shapes/nearby/?lat=${lat}&lon=${lon}&distance_km=${distanceKm}`;
            console.log('Fetching routes from radius:', endpoint);
            const response = await fetch(endpoint);
            const data = await response.json();
            console.log('Radius routes response:', data);
            
            // Add routes directly to layer (don't use displayRouteResults which clears the layer)
            const routesResults = data.results || [];
            console.log('Routes count:', routesResults.length);
            routesResults.forEach((route, idx) => {
                const props = route.properties || route;
                const coordinates = route.geometry?.coordinates;
                //console.log(`Route ${idx}:`, {shape_id: props.shape_id, has_coords: !!coordinates, coords_length: coordinates ? coordinates.length : 0});
                if (coordinates && Array.isArray(coordinates)) {
                    const latLngs = coordinates.map(coord => [coord[1], coord[0]]);
                    const polyline = L.polyline(latLngs, {
                        color: '#9b59b6',
                        weight: 4,
                        opacity: 0.8,
                        lineCap: 'round',
                        lineJoin: 'round'
                    });
                    // Enhanced popup with all route data
                    const popupContent = `
                        <div class="popup-content">
                            <strong>${props.route_short_name || 'Route'}</strong><br>
                            ${props.route_long_name ? `<small>${props.route_long_name}</small><br>` : ''}
                            Route ID: ${props.route_id || 'N/A'}<br>
                            ${props.route_type ? `Type: ${getRouteTypeName(props.route_type)}<br>` : ''}
                            ${props.route_color ? `<small>Color: #${props.route_color}</small>` : ''}
                        </div>
                    `;
                    polyline.bindPopup(popupContent);
                    layer.addLayer(polyline);
                }
            });
            
            // Display results in the results panel
            displayResultsList(routesResults, `Radius Search: ${routesResults.length} routes found`);
        } else if (queryType === 'both') {
            // For BOTH stops and routes - fetch stops first, add to layer, then routes
            const distanceKm = radius / 1000;
            const stopsUrl = `/api/stops/nearby/?lat=${lat}&lon=${lon}&distance_km=${distanceKm}`;
            const shapesUrl = `/api/shapes/nearby/?lat=${lat}&lon=${lon}&distance_km=${distanceKm}`;
            
            const stopsResp = await fetch(stopsUrl);
            const stopsData = await stopsResp.json();
            
            // Add stops to map
            const stopsResults = stopsData.results || [];
            stopsResults.forEach(stop => {
                // Handle GeoJSON Feature format
                const props = stop.properties || stop;
                const coords = stop.geometry?.coordinates;
                
                if (coords) {
                    const marker = L.marker([coords[1], coords[0]], {
                        icon: L.divIcon({
                            className: 'query-marker stop-marker',
                            html: '<i class="fas fa-star" style="color: #9b59b6; font-size: 32px; text-shadow: -1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white;"></i>',
                            iconSize: [50, 50],
                            iconAnchor: [25, 25]
                        })
                    });
                    // Enhanced popup with all stop data
                    const popupContent = `
                        <div class="popup-content">
                            <strong>${props.stop_name || props.name}</strong><br>
                            <small>Stop ID: ${props.stop_id}</small><br>
                            ${props.stop_code ? `Code: ${props.stop_code}<br>` : ''}
                            ${props.stop_type ? `Type: ${props.stop_type}<br>` : ''}
                            ${props.stop_desc ? `Description: ${props.stop_desc}<br>` : ''}
                            <small>(${coords[1].toFixed(4)}, ${coords[0].toFixed(4)})</small>
                        </div>
                    `;
                    marker.bindPopup(popupContent);
                    layer.addLayer(marker);
                }
            });
            
            const routesResp = await fetch(shapesUrl);
            const routesData = await routesResp.json();
            console.log('Radius both - Routes data:', routesData);
            
            // Add routes to map
            const routesResults = routesData.results || [];
            console.log('Radius both - Routes count:', routesResults.length);
            routesResults.forEach(route => {
                const props = route.properties || route;
                const coordinates = route.geometry?.coordinates;
                console.log('Radius both - Route:', props.route_short_name, 'has coords:', !!coordinates);
                if (coordinates && Array.isArray(coordinates)) {
                    const latLngs = coordinates.map(coord => [coord[1], coord[0]]);
                    const polyline = L.polyline(latLngs, {
                        color: '#9b59b6',
                        weight: 4,
                        opacity: 0.8
                    });
                    // Enhanced popup with all route data
                    const popupContent = `
                        <div class="popup-content">
                            <strong>${props.route_short_name || 'Route'}</strong><br>
                            ${props.route_long_name ? `<small>${props.route_long_name}</small><br>` : ''}
                            Route ID: ${props.route_id || 'N/A'}<br>
                            ${props.route_type ? `Type: ${getRouteTypeName(props.route_type)}<br>` : ''}
                            ${props.route_color ? `<small>Color: #${props.route_color}</small>` : ''}
                        </div>
                    `;
                    polyline.bindPopup(popupContent);
                    layer.addLayer(polyline);
                    console.log('Radius both - Added route to layer');
                }
            });
            
            // Display results in the results panel
            console.log('Radius both - Display results. Stops:', stopsResults.length, 'Routes:', routesResults.length);
            displayBothResults(stopsResults, routesResults);
            return;
        } else {
            // For stops - convert meters to km, don't use displayResults as it clears layers
            const distanceKm = radius / 1000;
            const endpoint = `/api/stops/nearby/?lat=${lat}&lon=${lon}&distance_km=${distanceKm}`;
            const response = await fetch(endpoint);
            const data = await response.json();
            
            // Add stops directly to layer (don't clear - circle already exists)
            const stopsResults = data.results || [];
            stopsResults.forEach(stop => {
                const props = stop.properties || stop;
                const coords = stop.geometry?.coordinates;
                
                if (coords) {
                    const marker = L.marker([coords[1], coords[0]], {
                        icon: L.divIcon({
                            className: 'query-marker stop-marker',
                            html: '<i class="fas fa-star" style="color: #9b59b6; font-size: 32px; text-shadow: -1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white;"></i>',
                            iconSize: [50, 50],
                            iconAnchor: [25, 25]
                        })
                    });
                    // Enhanced popup with all stop data
                    const popupContent = `
                        <div class="popup-content">
                            <strong>${props.stop_name || props.name || 'Stop'}</strong><br>
                            <small>Stop ID: ${props.stop_id || 'N/A'}</small><br>
                            ${props.stop_code ? `Code: ${props.stop_code}<br>` : ''}
                            ${props.stop_type ? `Type: ${props.stop_type}<br>` : ''}
                            ${props.stop_desc ? `Description: ${props.stop_desc}<br>` : ''}
                            <small>(${coords[1].toFixed(4)}, ${coords[0].toFixed(4)})</small>
                        </div>
                    `;
                    marker.bindPopup(popupContent);
                    layer.addLayer(marker);
                }
            });
            
            // Display results in the results panel (without clearing layers)
            displayResultsList(stopsResults, `Radius Search: ${stopsResults.length} stops found`);
        }
    } catch (error) {
        console.error('Error performing radius search:', error);
        alert('Error performing search');
    }
}

async function performBoundsSearch() {
    let minLat, maxLat, minLon, maxLon;
    
    // Use markers if they exist, otherwise use input values
    if (window.boundsMarkers && window.boundsMarkers.point1 && window.boundsMarkers.point2) {
        const p1 = window.boundsMarkers.point1.getLatLng();
        const p2 = window.boundsMarkers.point2.getLatLng();
        
        minLat = Math.min(p1.lat, p2.lat);
        maxLat = Math.max(p1.lat, p2.lat);
        minLon = Math.min(p1.lng, p2.lng);
        maxLon = Math.max(p1.lng, p2.lng);
        
        console.log(`Using markers bounds: minLat=${minLat}, maxLat=${maxLat}, minLon=${minLon}, maxLon=${maxLon}`);
    } else {
        minLat = parseFloat(document.getElementById('bboxMinLat').value);
        maxLat = parseFloat(document.getElementById('bboxMaxLat').value);
        minLon = parseFloat(document.getElementById('bboxMinLon').value);
        maxLon = parseFloat(document.getElementById('bboxMaxLon').value);
    }
    
    const queryType = document.getElementById('boundsType').value;

    if (isNaN(minLat) || isNaN(maxLat) || isNaN(minLon) || isNaN(maxLon)) {
        alert('Please enter valid bounding box coordinates or click on the map to create two markers');
        return;
    }

    try {
        const layer = window.queryLayer || queryLayer;
        layer.clearLayers();
        
        // Create a feature group for the rectangle and markers
        let rectangleLayer = L.featureGroup();
        
        // Draw rectangle with calculated bounds
        const boundsForRect = [[minLat, minLon], [maxLat, maxLon]];
        const rectangle = L.rectangle(boundsForRect, {
            color: '#9b59b6',
            fill: true,
            fillColor: '#9b59b6',
            fillOpacity: 0.1,
            weight: 3,
            opacity: 0.8,
            dashArray: '5, 5'
        });
        rectangleLayer.addLayer(rectangle);
        
        // Add the markers on top of the rectangle if they exist
        if (window.boundsMarkers && window.boundsMarkers.point1) rectangleLayer.addLayer(window.boundsMarkers.point1);
        if (window.boundsMarkers && window.boundsMarkers.point2) rectangleLayer.addLayer(window.boundsMarkers.point2);
        
        console.log('Drawing rectangle with bounds:', boundsForRect);

        // Add rectangle layer with markers to the query layer
        layer.addLayer(rectangleLayer);

        if (queryType === 'routes') {
            // For routes, use shapes endpoint
            const endpoint = `/api/shapes/in_bounds/?min_lat=${minLat}&max_lat=${maxLat}&min_lon=${minLon}&max_lon=${maxLon}`;
            console.log('Fetching routes from bounds:', endpoint);
            const response = await fetch(endpoint);
            const data = await response.json();
            console.log('Bounds routes response:', data);
            
            // Add routes directly to layer (don't use displayRouteResults which clears the layer)
            const routesResults = data.results || [];
            console.log('Routes count:', routesResults.length);
            routesResults.forEach((route, idx) => {
                const props = route.properties || route;
                const coordinates = route.geometry?.coordinates;
                //console.log(`Route ${idx}:`, {shape_id: props.shape_id, has_coords: !!coordinates, coords_length: coordinates ? coordinates.length : 0});
                if (coordinates && Array.isArray(coordinates)) {
                    const latLngs = coordinates.map(coord => [coord[1], coord[0]]);
                    const polyline = L.polyline(latLngs, {
                        color: '#9b59b6',
                        weight: 4,
                        opacity: 0.8,
                        lineCap: 'round',
                        lineJoin: 'round'
                    });
                    // Enhanced popup with all route data
                    const popupContent = `
                        <div class="popup-content">
                            <strong>${props.route_short_name || 'Route'}</strong><br>
                            ${props.route_long_name ? `<small>${props.route_long_name}</small><br>` : ''}
                            Route ID: ${props.route_id || 'N/A'}<br>
                            ${props.route_type ? `Type: ${getRouteTypeName(props.route_type)}<br>` : ''}
                            ${props.route_color ? `<small>Color: #${props.route_color}</small>` : ''}
                        </div>
                    `;
                    polyline.bindPopup(popupContent);
                    layer.addLayer(polyline);
                }
            });
            
            // Display results in the results panel
            displayResultsList(routesResults, `Bounds Search: ${routesResults.length} routes found`);
        } else if (queryType === 'both') {
            // For BOTH stops and routes - fetch stops first, add to layer, then routes
            const stopsUrl = `/api/stops/in_bounds/?min_lat=${minLat}&max_lat=${maxLat}&min_lon=${minLon}&max_lon=${maxLon}`;
            const shapesUrl = `/api/shapes/in_bounds/?min_lat=${minLat}&max_lat=${maxLat}&min_lon=${minLon}&max_lon=${maxLon}`;
            
            console.log('Fetching stops from:', stopsUrl);
            const stopsResp = await fetch(stopsUrl);
            const stopsData = await stopsResp.json();
            console.log('Stops received:', stopsData.results ? stopsData.results.length : 0);
            
            // Add stops to map
            const stopsResults = stopsData.results || [];
            stopsResults.forEach(stop => {
                const props = stop.properties || stop;
                const coords = stop.geometry?.coordinates || stop.point;
                if (coords) {
                    const marker = L.marker([coords[1], coords[0]], {
                        icon: L.divIcon({
                            className: 'query-marker stop-marker',
                            html: '<i class="fas fa-star" style="color: #9b59b6; font-size: 32px; text-shadow: -1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white;"></i>',
                            iconSize: [50, 50],
                            iconAnchor: [25, 25]
                        })
                    });
                    // Enhanced popup with all stop data
                    const popupContent = `
                        <div class="popup-content">
                            <strong>${props.stop_name || props.name || 'Stop'}</strong><br>
                            <small>Stop ID: ${props.stop_id || 'N/A'}</small><br>
                            ${props.stop_code ? `Code: ${props.stop_code}<br>` : ''}
                            ${props.stop_type ? `Type: ${props.stop_type}<br>` : ''}
                            ${props.stop_desc ? `Description: ${props.stop_desc}<br>` : ''}
                            <small>(${coords[1].toFixed(4)}, ${coords[0].toFixed(4)})</small>
                        </div>
                    `;
                    marker.bindPopup(popupContent);
                    layer.addLayer(marker);
                }
            });
            
            const routesResp = await fetch(shapesUrl);
            const routesData = await routesResp.json();
            
            // Add routes to map
            const routesResults = routesData.results || [];
            routesResults.forEach(route => {
                const props = route.properties || route;
                const coordinates = route.geometry?.coordinates;
                if (coordinates && Array.isArray(coordinates)) {
                    const latLngs = coordinates.map(coord => [coord[1], coord[0]]);
                    const polyline = L.polyline(latLngs, {
                        color: '#9b59b6',
                        weight: 4,
                        opacity: 0.8,
                        lineCap: 'round',
                        lineJoin: 'round'
                    });
                    // Enhanced popup with all route data
                    const popupContent = `
                        <div class="popup-content">
                            <strong>${props.route_short_name || 'Route'}</strong><br>
                            ${props.route_long_name ? `<small>${props.route_long_name}</small><br>` : ''}
                            Route ID: ${props.route_id || 'N/A'}<br>
                            ${props.route_type ? `Type: ${getRouteTypeName(props.route_type)}<br>` : ''}
                            ${props.route_color ? `<small>Color: #${props.route_color}</small>` : ''}
                        </div>
                    `;
                    polyline.bindPopup(popupContent);
                    layer.addLayer(polyline);
                }
            });
            
            // Display results in the results panel
            displayBothResults(stopsResults, routesResults);
        } else {
            // For stops - don't use displayResults as it clears layers
            const endpoint = `/api/stops/in_bounds/?min_lat=${minLat}&max_lat=${maxLat}&min_lon=${minLon}&max_lon=${maxLon}`;
            const response = await fetch(endpoint);
            const data = await response.json();
            
            // Add stops directly to layer (don't clear - rectangle already exists)
            const stopsResults = data.results || [];
            stopsResults.forEach(stop => {
                const props = stop.properties || stop;
                const coords = stop.geometry?.coordinates || stop.point;
                if (coords) {
                    const marker = L.marker([coords[1], coords[0]], {
                        icon: L.divIcon({
                            className: 'query-marker stop-marker',
                            html: '<i class="fas fa-star" style="color: #9b59b6; font-size: 32px; text-shadow: -1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white;"></i>',
                            iconSize: [50, 50],
                            iconAnchor: [25, 25]
                        })
                    });
                    // Enhanced popup with all stop data
                    const popupContent = `
                        <div class="popup-content">
                            <strong>${props.stop_name || props.name || 'Stop'}</strong><br>
                            <small>Stop ID: ${props.stop_id || 'N/A'}</small><br>
                            ${props.stop_code ? `Code: ${props.stop_code}<br>` : ''}
                            ${props.stop_type ? `Type: ${props.stop_type}<br>` : ''}
                            ${props.stop_desc ? `Description: ${props.stop_desc}<br>` : ''}
                            <small>(${coords[1].toFixed(4)}, ${coords[0].toFixed(4)})</small>
                        </div>
                    `;
                    marker.bindPopup(popupContent);
                    layer.addLayer(marker);
                }
            });
            
            // Display results in the results panel (without clearing layers)
            displayResultsList(stopsResults, `Bounds Search: ${stopsResults.length} stops found`);
        }
    } catch (error) {
        console.error('Error performing bounds search:', error);
        alert('Error performing search');
    }
}

async function performAdvancedQuery() {
    const queryType = document.getElementById('advancedQueryType').value;
    const layer = window.queryLayer || queryLayer;
    
    try {
        if (queryType === 'stops-on-route') {
            await performStopsOnRouteQuery();
        } else if (queryType === 'k-nearest') {
            await performKNearestQuery();
        }
    } catch (error) {
        console.error('Error performing advanced query:', error);
        alert('Error performing search: ' + error.message);
    }
}

async function performStopsOnRouteQuery() {
    const routeId = document.getElementById('routeSelect').value;
    
    if (!routeId) {
        alert('Please select a route');
        return;
    }
    
    const layer = window.queryLayer || queryLayer;
    layer.clearLayers();
    
    const endpoint = '/api/stops/on_route/?route_id=' + routeId;
    const response = await fetch(endpoint);
    const data = await response.json();
    
    if (response.status === 404) {
        alert('Route not found');
        return;
    }
    
    const stops = data.stops || [];
    
    // Add stops to map with sequence numbers
    stops.forEach(stop => {
        const marker = L.marker([stop.latitude, stop.longitude], {
            icon: L.divIcon({
                className: 'query-marker stop-marker',
                html: `<div style="background: #e74c3c; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${stop.stop_sequence}</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        });
        
        const popupContent = `
            <div class="popup-content">
                <strong>${stop.stop_name}</strong><br>
                <small>Stop ID: ${stop.stop_id}</small><br>
                ${stop.stop_code ? `Code: ${stop.stop_code}<br>` : ''}
                <small>Sequence: ${stop.stop_sequence}</small><br>
                ${stop.arrival_time ? `Arrival: ${stop.arrival_time}<br>` : ''}
                ${stop.departure_time ? `Departure: ${stop.departure_time}` : ''}
            </div>
        `;
        marker.bindPopup(popupContent);
        layer.addLayer(marker);
    });
    
    // Display results
    const resultsList = stops.map((stop, idx) => ({
        id: stop.stop_id,
        name: stop.stop_name,
        sequence: stop.stop_sequence,
        code: stop.stop_code,
        type: stop.stop_type,
        arrival_time: stop.arrival_time,
        departure_time: stop.departure_time,
        latitude: stop.latitude,
        longitude: stop.longitude
    }));
    
    displayStopsOnRouteResults(resultsList, data);
}

async function performKNearestQuery() {
    const lat = parseFloat(document.getElementById('kNearestLat').value);
    const lon = parseFloat(document.getElementById('kNearestLon').value);
    const k = parseInt(document.getElementById('kNearestCount').value) || 5;
    
    if (isNaN(lat) || isNaN(lon)) {
        alert('Please enter valid coordinates');
        return;
    }
    
    const layer = window.queryLayer || queryLayer;
    layer.clearLayers();
    
    const endpoint = '/api/stops/k_nearest/?lat=' + lat + '&lon=' + lon + '&k=' + k;
    const response = await fetch(endpoint);
    const data = await response.json();
    
    const stops = data.results || [];
    
    // Add center point marker
    const centerMarker = L.circleMarker([lat, lon], {
        radius: 8,
        fillColor: '#e74c3c',
        color: '#c0392b',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
    });
    centerMarker.bindPopup('<strong>Query Point</strong><br>(' + lat.toFixed(4) + ', ' + lon.toFixed(4) + ')');
    layer.addLayer(centerMarker);
    
    // Add stops to map with rank numbers
    stops.forEach((stop, idx) => {
        const props = stop.properties || stop;
        const coords = stop.geometry?.coordinates || [stop.longitude, stop.latitude];
        
        const marker = L.marker([coords[1], coords[0]], {
            icon: L.divIcon({
                className: 'query-marker stop-marker',
                html: `<div style="background: #3498db; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${idx + 1}</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        });
        
        const distance = stop.distance !== undefined ? stop.distance : 'N/A';
        const popupContent = `
            <div class="popup-content">
                <strong>#${idx + 1}: ${props.stop_name}</strong><br>
                <small>Stop ID: ${props.stop_id}</small><br>
                ${props.stop_code ? `Code: ${props.stop_code}<br>` : ''}
                <small>Distance: ${distance} m</small><br>
                <small>(${coords[1].toFixed(4)}, ${coords[0].toFixed(4)})</small>
            </div>
        `;
        marker.bindPopup(popupContent);
        layer.addLayer(marker);
    });
    
    // Display results
    displayKNearestResults(stops, lat, lon, k);
}

function displayResults(results, title, centerLat, centerLon) {
    const layer = window.queryLayer || queryLayer;
    layer.clearLayers();
    
    results.forEach((result, idx) => {
        // Handle GeoJSON feature format
        const geom = result.geometry;
        const props = result.properties || result;
        
        if (geom && geom.coordinates) {
            const coords = geom.coordinates;
            
            // Only create markers for Point geometries
            if (geom.type === 'Point') {
                const marker = L.marker([coords[1], coords[0]], {
                    icon: L.divIcon({
                        className: 'query-result-icon',
                        html: '<i class="fas fa-star" style="color: #9b59b6; font-size: 28px;"></i>',
                        iconSize: [40, 40],
                        iconAnchor: [20, 20]
                    })
                });

                const popupContent = `
                    <div class="popup-content">
                        <strong>${props.stop_name || props.route_short_name}</strong><br>
                        ${props.stop_code ? 'Code: ' + props.stop_code + '<br>' : ''}
                        ${props.stop_type ? 'Type: ' + props.stop_type + '<br>' : ''}
                        ${props.speed ? 'Speed: ' + props.speed.toFixed(1) + ' km/h<br>' : ''}
                        ${props.status ? 'Status: ' + props.status + '<br>' : ''}
                    </div>
                `;
                marker.bindPopup(popupContent);
                layer.addLayer(marker);
            }
        }
    });

    if (centerLat && centerLon) {
        map.setView([centerLat, centerLon], 15);
    }

    displayResultsList(results, title);
}


function displayBothResults(stops, routes) {
    const resultsDiv = document.getElementById('queryResults');
    const resultsList = document.getElementById('resultsList');

    let html = `<div class="alert alert-info">Both Search: <strong>${stops.length} stops</strong> and <strong>${routes.length} routes</strong> found</div>`;
    html += `<div class="results-count">Total: <strong>${stops.length + routes.length}</strong></div>`;

    // Display stops
    if (stops.length > 0) {
        html += `<div style="margin-top: 10px;"><strong style="color: #9b59b6;">📍 Stops (${stops.length})</strong></div>`;
        
        // Show first 3 stops
        stops.slice(0, 3).forEach((stop, index) => {
            const props = stop.properties || stop;
            const name = props.stop_name || props.name || `Stop ${index + 1}`;
            const coords = stop.geometry?.coordinates || [];
            
            const details = [];
            if (props.stop_code) details.push(`Code: ${props.stop_code}`);
            if (props.stop_type) details.push(`Type: ${props.stop_type}`);
            if (coords.length > 0) details.push(`(${coords[1].toFixed(4)}, ${coords[0].toFixed(4)})`);
            
            const stopId = `stop-${index}-${props.stop_id || 'unknown'}`;
            html += `<div class="result-item" id="${stopId}" style="padding: 8px; border-left: 3px solid #9b59b6; margin-bottom: 5px; cursor: pointer;" onclick="window.centerMapOnResult(${coords[1]}, ${coords[0]}, 15); this.style.backgroundColor='#f0e6ff';">
                <strong>${name}</strong><br>
                <small>${details.join(' • ')}</small>
            </div>`;
        });
        
        // Show dropdown for additional stops if more than 3
        if (stops.length > 3) {
            html += `<details style="margin: 10px 0; cursor: pointer;">
                <summary style="color: #9b59b6; font-weight: bold;">Show ${stops.length - 3} more stops...</summary>
                <div style="margin-top: 10px;">`;
            
            stops.slice(3).forEach((stop, index) => {
                const props = stop.properties || stop;
                const name = props.stop_name || props.name || `Stop ${index + 4}`;
                const coords = stop.geometry?.coordinates || [];
                
                const details = [];
                if (props.stop_code) details.push(`Code: ${props.stop_code}`);
                if (props.stop_type) details.push(`Type: ${props.stop_type}`);
                if (coords.length > 0) details.push(`(${coords[1].toFixed(4)}, ${coords[0].toFixed(4)})`);
                
                const stopId = `stop-${index + 3}-${props.stop_id || 'unknown'}`;
                html += `<div class="result-item" id="${stopId}" style="padding: 8px; border-left: 3px solid #9b59b6; margin-bottom: 5px; cursor: pointer;" onclick="window.centerMapOnResult(${coords[1]}, ${coords[0]}, 15); this.style.backgroundColor='#f0e6ff';">
                    <strong>${name}</strong><br>
                    <small>${details.join(' • ')}</small>
                </div>`;
            });
            
            html += `</div></details>`;
        }
    }

    // Display routes
    if (routes.length > 0) {
        html += `<div style="margin-top: 15px;"><strong style="color: #9b59b6;">🛣️ Routes (${routes.length})</strong></div>`;
        
        // Show first 3 routes
        routes.slice(0, 3).forEach((route, index) => {
            const props = route.properties || route;
            const shortName = props.route_short_name || 'Route';
            const longName = props.route_long_name || '';
            const routeId = props.route_id || index + 1;
            
            const details = [];
            if (props.route_type) details.push(`Type: ${getRouteTypeName(props.route_type)}`);
            
            // Get first coordinate of route for centering
            const coords = route.geometry?.coordinates?.[0] || [0, 0];
            const routeItemId = `route-${index}-${routeId}`;
            html += `<div class="result-item" id="${routeItemId}" style="padding: 8px; border-left: 3px solid #9b59b6; margin-bottom: 5px; cursor: pointer;" onclick="window.centerMapOnResult(${coords[1]}, ${coords[0]}, 15); this.style.backgroundColor='#f0e6ff';">
                <strong>${shortName}</strong><br>
                ${longName ? `<small>${longName}</small><br>` : ''}
                <small>Route ID: ${routeId}${details.length > 0 ? ' • ' + details.join(' • ') : ''}</small>
            </div>`;
        });
        
        // Show dropdown for additional routes if more than 3
        if (routes.length > 3) {
            html += `<details style="margin: 10px 0; cursor: pointer;">
                <summary style="color: #9b59b6; font-weight: bold;">Show ${routes.length - 3} more routes...</summary>
                <div style="margin-top: 10px;">`;
            
            routes.slice(3).forEach((route, index) => {
                const props = route.properties || route;
                const shortName = props.route_short_name || 'Route';
                const longName = props.route_long_name || '';
                const routeId = props.route_id || index + 4;
                
                const details = [];
                if (props.route_type) details.push(`Type: ${getRouteTypeName(props.route_type)}`);
                
                // Get first coordinate of route for centering
                const coords = route.geometry?.coordinates?.[0] || [0, 0];
                const routeItemId = `route-${index + 3}-${routeId}`;
                html += `<div class="result-item" id="${routeItemId}" style="padding: 8px; border-left: 3px solid #9b59b6; margin-bottom: 5px; cursor: pointer;" onclick="window.centerMapOnResult(${coords[1]}, ${coords[0]}, 15); this.style.backgroundColor='#f0e6ff';">
                    <strong>${shortName}</strong><br>
                    ${longName ? `<small>${longName}</small><br>` : ''}
                    <small>Route ID: ${routeId}${details.length > 0 ? ' • ' + details.join(' • ') : ''}</small>
                </div>`;
            });
            
            html += `</div></details>`;
        }
    }

    resultsList.innerHTML = html;
    resultsDiv.style.display = 'block';
}

function displayResultsList(results, title) {
    const resultsDiv = document.getElementById('queryResults');
    const resultsList = document.getElementById('resultsList');

    let html = `<div class="alert alert-info">${title}</div>`;
    html += `<div class="results-count">Total: <strong>${results.length}</strong></div>`;

    // Show first 3 results
    results.slice(0, 3).forEach((result, index) => {
        // Handle GeoJSON feature format
        const props = result.properties || result;
        
        let name = props.stop_name || props.route_short_name || `Result ${index + 1}`;
        let lat = 0, lon = 0;
        
        // Handle different geometry types
        if (result.geometry) {
            const geomType = result.geometry.type;
            const coords = result.geometry.coordinates;
            
            if (geomType === 'Point') {
                // Point: [lon, lat]
                lat = coords[1];
                lon = coords[0];
                name = `${props.stop_name || props.route_short_name} (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
            } else if (geomType === 'LineString') {
                // LineString: [[lon, lat], [lon, lat], ...]
                // Get the first coordinate for display and centering
                if (coords.length > 0) {
                    lat = coords[0][1];
                    lon = coords[0][0];
                    name = `${props.route_short_name} - ${props.route_long_name}`;
                }
            }
        }
        
        const details = [];
        
        // Add relevant details based on result type
        if (props.stop_code) details.push(`Code: ${props.stop_code}`);
        if (props.stop_type) details.push(`Type: ${props.stop_type}`);
        if (props.route_short_name && !props.stop_name) details.push(`Route: ${props.route_short_name}`);
        if (props.route_long_name) details.push(`${props.route_long_name}`);
        if (props.route_type) details.push(`Type: ${getRouteTypeName(props.route_type)}`);
        if (props.speed) details.push(`Speed: ${props.speed.toFixed(1)} km/h`);
        if (props.status) details.push(`Status: ${props.status}`);
        if (props.avg_speed) details.push(`Avg Speed: ${props.avg_speed.toFixed(1)} km/h`);
        if (props.shape_id) details.push(`Shape ID: ${props.shape_id}`);

        const resultId = `result-${index}-${props.stop_id || props.route_id || 'unknown'}`;
        html += `
            <div class="result-item" id="${resultId}" style="cursor: pointer; padding: 8px; border-radius: 4px;" onclick="window.centerMapOnResult(${lat}, ${lon}, 15); this.style.backgroundColor='#f0e6ff';">
                <div class="result-title">${name}</div>
                <small class="text-muted">${details.join(' • ')}</small>
            </div>
        `;
    });

    // Show dropdown for additional results if more than 3
    if (results.length > 3) {
        html += `<details style="margin: 10px 0; cursor: pointer;">
            <summary style="color: #9b59b6; font-weight: bold;">Show ${results.length - 3} more results...</summary>
            <div style="margin-top: 10px;">`;
        
        results.slice(3).forEach((result, index) => {
            // Handle GeoJSON feature format
            const props = result.properties || result;
            
            let name = props.stop_name || props.route_short_name || `Result ${index + 4}`;
            let lat = 0, lon = 0;
            
            // Handle different geometry types
            if (result.geometry) {
                const geomType = result.geometry.type;
                const coords = result.geometry.coordinates;
                
                if (geomType === 'Point') {
                    // Point: [lon, lat]
                    lat = coords[1];
                    lon = coords[0];
                    name = `${props.stop_name || props.route_short_name} (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
                } else if (geomType === 'LineString') {
                    // LineString: [[lon, lat], [lon, lat], ...]
                    if (coords.length > 0) {
                        lat = coords[0][1];
                        lon = coords[0][0];
                        name = `${props.route_short_name} - ${props.route_long_name}`;
                    }
                }
            }
            
            const details = [];
            
            // Add relevant details based on result type
            if (props.stop_code) details.push(`Code: ${props.stop_code}`);
            if (props.stop_type) details.push(`Type: ${props.stop_type}`);
            if (props.route_short_name && !props.stop_name) details.push(`Route: ${props.route_short_name}`);
            if (props.route_long_name) details.push(`${props.route_long_name}`);
            if (props.route_type) details.push(`Type: ${getRouteTypeName(props.route_type)}`);
            if (props.speed) details.push(`Speed: ${props.speed.toFixed(1)} km/h`);
            if (props.status) details.push(`Status: ${props.status}`);
            if (props.avg_speed) details.push(`Avg Speed: ${props.avg_speed.toFixed(1)} km/h`);
            if (props.shape_id) details.push(`Shape ID: ${props.shape_id}`);

            const resultId = `result-${index + 3}-${props.stop_id || props.route_id || 'unknown'}`;
            html += `
                <div class="result-item" id="${resultId}" style="cursor: pointer; padding: 8px; border-radius: 4px;" onclick="window.centerMapOnResult(${lat}, ${lon}, 15); this.style.backgroundColor='#f0e6ff';">
                    <div class="result-title">${name}</div>
                    <small class="text-muted">${details.join(' • ')}</small>
                </div>
            `;
        });
        
        html += `</div></details>`;
    }

    resultsList.innerHTML = html;
    resultsDiv.style.display = 'block';
}

function displayRouteResults(shapes) {
    const layer = window.queryLayer || queryLayer;
    layer.clearLayers();

    // Group shapes by route for better display
    const shapesByRoute = {};
    
    shapes.forEach(shape => {
        const props = shape.properties;
        const routeKey = `${props.route_short_name || 'Unknown'}-${props.route_type || 'N/A'}`;
        
        if (!shapesByRoute[routeKey]) {
            shapesByRoute[routeKey] = [];
        }
        shapesByRoute[routeKey].push(shape);
    });

    // Display each route as a polyline
    Object.entries(shapesByRoute).forEach(([routeKey, routeShapes]) => {
        routeShapes.forEach(shape => {
            if (shape.geometry && shape.geometry.type === 'LineString') {
                const coords = shape.geometry.coordinates.map(c => [c[1], c[0]]);
                const props = shape.properties;

                const polyline = L.polyline(coords, {
                    color: '#9b59b6',
                    weight: 4,
                    opacity: 0.8,
                    lineCap: 'round',
                    lineJoin: 'round'
                });

                const popupContent = `
                    <div class="popup-content">
                        <strong>${props.route_short_name}</strong><br>
                        ${props.route_long_name}<br>
                        Type: ${getRouteTypeName(props.route_type)}<br>
                        Shape ID: ${props.shape_id}
                    </div>
                `;
                polyline.bindPopup(popupContent);
                layer.addLayer(polyline);
            }
        });
    });

    if (layer.getLayers().length > 0) {
        map.fitBounds(layer.getBounds(), { padding: [50, 50] });
    }

    displayResultsList(shapes, `Routes in Area: ${Object.keys(shapesByRoute).length} routes found`);
}

function displayStopsOnRouteResults(stops, routeData) {
    const resultsList = document.getElementById('resultsList');
    const resultsDiv = document.getElementById('queryResults');
    
    let html = `<div class="alert alert-info mb-2">
        <strong>${routeData.route_short_name}</strong> - ${routeData.route_long_name}<br>
        <small>Type: ${routeData.route_type}</small><br>
        <small>${routeData.stop_count} stops</small>
    </div>`;
    html += `<div class="results-count">Total: <strong>${stops.length}</strong></div>`;
    
    // Show first 3 stops
    stops.slice(0, 3).forEach((stop) => {
        html += `
            <div class="result-item" style="cursor: pointer; padding: 8px; border-radius: 4px;" onclick="window.centerMapOnResult(${stop.latitude}, ${stop.longitude}, 16); this.style.backgroundColor='#f0e6ff';">
                <strong class="badge badge-success" style="margin-right: 8px;">${stop.sequence}</strong>
                <strong>${stop.name}</strong><br>
                <small>Stop ID: ${stop.id}</small><br>
                ${stop.arrival_time ? `<small>Arrival: ${stop.arrival_time}</small>` : ''}
                ${stop.departure_time ? `<small style="margin-left: 10px;">Departure: ${stop.departure_time}</small>` : ''}
            </div>
        `;
    });
    
    // Show dropdown for additional stops if more than 3
    if (stops.length > 3) {
        html += `<details style="margin: 10px 0; cursor: pointer;">
            <summary style="color: #9b59b6; font-weight: bold;">Show ${stops.length - 3} more stops...</summary>
            <div style="margin-top: 10px;">`;
        
        stops.slice(3).forEach((stop) => {
            html += `
                <div class="result-item" style="cursor: pointer; padding: 8px; border-radius: 4px;" onclick="window.centerMapOnResult(${stop.latitude}, ${stop.longitude}, 16); this.style.backgroundColor='#f0e6ff';">
                    <strong class="badge badge-success" style="margin-right: 8px;">${stop.sequence}</strong>
                    <strong>${stop.name}</strong><br>
                    <small>Stop ID: ${stop.id}</small><br>
                    ${stop.arrival_time ? `<small>Arrival: ${stop.arrival_time}</small>` : ''}
                    ${stop.departure_time ? `<small style="margin-left: 10px;">Departure: ${stop.departure_time}</small>` : ''}
                </div>
            `;
        });
        
        html += `</div></details>`;
    }
    
    resultsList.innerHTML = html;
    resultsDiv.style.display = 'block';
}

function displayKNearestResults(stops, lat, lon, k) {
    const resultsList = document.getElementById('resultsList');
    const resultsDiv = document.getElementById('queryResults');
    
    let html = `<div class="alert alert-info mb-2">
        <strong>K-Nearest Stops (K=${k})</strong><br>
        <small>Center: ${lat.toFixed(4)}, ${lon.toFixed(4)}</small><br>
        <small>${stops.length} stops found</small>
    </div>`;
    html += `<div class="results-count">Total: <strong>${stops.length}</strong></div>`;
    
    // Show first 3 stops
    stops.slice(0, 3).forEach((stop, idx) => {
        const props = stop.properties || stop;
        const distance = stop.distance !== undefined ? (stop.distance / 1000).toFixed(3) : 'N/A';
        const coords = stop.geometry?.coordinates || [stop.longitude, stop.latitude];
        
        html += `
            <div class="result-item" style="cursor: pointer; padding: 8px; border-radius: 4px;" onclick="window.centerMapOnResult(${coords[1]}, ${coords[0]}, 17); this.style.backgroundColor='#f0e6ff';">
                <strong class="badge badge-primary" style="margin-right: 8px;">#${idx + 1}</strong>
                <strong>${props.stop_name}</strong><br>
                <small>Stop ID: ${props.stop_id}</small><br>
                <small>Distance: ${distance} km</small>
            </div>
        `;
    });
    
    // Show dropdown for additional stops if more than 3
    if (stops.length > 3) {
        html += `<details style="margin: 10px 0; cursor: pointer;">
            <summary style="color: #9b59b6; font-weight: bold;">Show ${stops.length - 3} more stops...</summary>
            <div style="margin-top: 10px;">`;
        
        stops.slice(3).forEach((stop, idx) => {
            const props = stop.properties || stop;
            const distance = stop.distance !== undefined ? (stop.distance / 1000).toFixed(3) : 'N/A';
            const coords = stop.geometry?.coordinates || [stop.longitude, stop.latitude];
            
            html += `
                <div class="result-item" style="cursor: pointer; padding: 8px; border-radius: 4px;" onclick="window.centerMapOnResult(${coords[1]}, ${coords[0]}, 17); this.style.backgroundColor='#f0e6ff';">
                    <strong class="badge badge-primary" style="margin-right: 8px;">#${idx + 4}</strong>
                    <strong>${props.stop_name}</strong><br>
                    <small>Stop ID: ${props.stop_id}</small><br>
                    <small>Distance: ${distance} km</small>
                </div>
            `;
        });
        
        html += `</div></details>`;
    }
    
    resultsList.innerHTML = html;
    resultsDiv.style.display = 'block';
}

function updateRadiusOptions() {
    // This function can be extended in the future for radius-specific options
    console.log('Radius search type changed');
}

function updateAdvancedOptions() {
    const queryType = document.getElementById('advancedQueryType').value;
    const stopsOnRouteDiv = document.getElementById('stopsOnRouteOptions');
    const kNearestDiv = document.getElementById('kNearestOptions');

    stopsOnRouteDiv.style.display = queryType === 'stops-on-route' ? 'block' : 'none';
    kNearestDiv.style.display = queryType === 'k-nearest' ? 'block' : 'none';
}

// Initialize coordinate inputs with current map bounds
document.addEventListener('DOMContentLoaded', function() {
    const radiusLatInput = document.getElementById('radiusLat');
    const radiusLonInput = document.getElementById('radiusLon');
    const kNearestLatInput = document.getElementById('kNearestLat');
    const kNearestLonInput = document.getElementById('kNearestLon');

    if (radiusLatInput && radiusLonInput) {
        radiusLatInput.value = '53.3498';
        radiusLonInput.value = '-6.2603';
    }

    if (kNearestLatInput && kNearestLonInput) {
        kNearestLatInput.value = '53.3498';
        kNearestLonInput.value = '-6.2603';
    }
    
    // Load routes into the route selector with a delay to allow data to load
    setTimeout(function() {
        loadRoutesIntoSelector();
    }, 1000);
});

function loadRoutesIntoSelector() {
    const routeSelect = document.getElementById('routeSelect');
    if (!routeSelect) return;
    
    fetch('/api/routes/')
        .then(resp => resp.json())
        .then(data => {
            //console.log('Routes API response:', data);
            //console.log('data.results:', data.results);
            //console.log('data.results.features:', data.results.features);
            //console.log('data.results.features length:', data.results.features ? data.results.features.length : 'undefined');
            
            let routes = [];
            
            // Handle different response formats
            if (Array.isArray(data)) {
                routes = data;
            } else if (data.results && Array.isArray(data.results)) {
                routes = data.results;
            } else if (data.results && data.results.features && Array.isArray(data.results.features)) {
                // GeoJSON FeatureCollection format
                //console.log('Using GeoJSON features format');
                routes = data.results.features.map(feature => feature.properties || feature);
            } else if (data.data && Array.isArray(data.data)) {
                routes = data.data;
            }
            
            //console.log('Parsed routes:', routes);
            console.log('Routes length:', routes.length);
            routeSelect.innerHTML = '<option value="">Select a route...</option>';
            
            if (routes.length === 0) {
                routeSelect.innerHTML += '<option disabled>No routes found</option>';
                console.warn('No routes found in database');
            } else {
                routes.forEach(route => {
                    const option = document.createElement('option');
                    option.value = route.route_id;
                    option.textContent = `${route.route_short_name} - ${route.route_long_name}`;
                    routeSelect.appendChild(option);
                });
            }
        })
        .catch(err => {
            console.error('Error loading routes:', err);
            routeSelect.innerHTML = '<option value="">Error loading routes</option>';
        });
}

/**
 * Center map on a result point when clicked in the results panel
 */
window.centerMapOnResult = function(lat, lon, zoom) {
    if (typeof map !== 'undefined' && map) {
        map.setView([lat, lon], zoom || 15);
    }
};
