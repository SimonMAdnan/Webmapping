// This file contains helper functions for performing various spatial queries on the map,
// Including radius and bounding box searches, and updating the map with the results.
// It also includes functions to handle user input for defining the search areas.
// It interacts with the API to fetch relevant data based on the spatial queries
// It also displays the results on the map with appropriate markers and popups.

// Updates temporary marker positions when bounds input values change
// Shows visual feedback as user enters coordinates
function updateBoundsMarkers() {
    const minLat = parseFloat(document.getElementById('bboxMinLat').value);
    const maxLat = parseFloat(document.getElementById('bboxMaxLat').value);
    const minLon = parseFloat(document.getElementById('bboxMinLon').value);
    const maxLon = parseFloat(document.getElementById('bboxMaxLon').value);
    
    // Create or update markers for the two corners of the bounding box
    if (!isNaN(minLat) && !isNaN(minLon)) {// Check if the input values are valid numbers
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

            // Create marker and bind popup
            window.boundsMarkers.point1 = L.marker([minLat, minLon], { icon: marker1Icon })
                .bindPopup(`<strong>Marker 1</strong><br>Lat: ${minLat.toFixed(4)}<br>Lon: ${minLon.toFixed(4)}`);
            if (window.queryLayer) {// Add to query layer if it exists
                window.queryLayer.addLayer(window.boundsMarkers.point1);
            }
        }
    }
    
    // Create or update point2 marker
    if (!isNaN(maxLat) && !isNaN(maxLon)) {
        if (!window.boundsMarkers) window.boundsMarkers = {};
        
        // Create or update point2 marker
        if (window.boundsMarkers.point2) {// Check if marker already exists
            window.boundsMarkers.point2.setLatLng([maxLat, maxLon]);
        } else {
            // Create a marker with a label
            const marker2Icon = L.divIcon({
                className: 'bounds-marker-label',
                html: '<div style="background: #9b59b6; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">2</div>',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });

            // Create marker and bind popup
            window.boundsMarkers.point2 = L.marker([maxLat, maxLon], { icon: marker2Icon })
                .bindPopup(`<strong>Marker 2</strong><br>Lat: ${maxLat.toFixed(4)}<br>Lon: ${maxLon.toFixed(4)}`);
            if (window.queryLayer) {// Add to query layer if it exists
                window.queryLayer.addLayer(window.boundsMarkers.point2);
            }
        }
    }
}

// Add event listeners to bounds input fields
document.addEventListener('DOMContentLoaded', function() { // Ensure DOM is loaded
    ['bboxMinLat', 'bboxMaxLat', 'bboxMinLon', 'bboxMaxLon'].forEach(id => { // Iterate over each input ID
        const element = document.getElementById(id); // Get each input element by ID
        if (element) { // Check if element exists
            element.addEventListener('change', updateBoundsMarkers); // Update markers on change
            element.addEventListener('input', updateBoundsMarkers); // Update markers on input
        }
    });
});

// Perform a radius search based on user input or marker position
async function performRadiusSearch() {
    let lat, lon; // Declare latitude and longitude variables
    
    // Use Marker 1 if it exists, otherwise use input values
    if (window.boundsMarkers && window.boundsMarkers.point1) { // Check if Marker 1 exists
        const markerLatLng = window.boundsMarkers.point1.getLatLng();
        lat = markerLatLng.lat;
        lon = markerLatLng.lng;
    } else { // Use input values
        lat = parseFloat(document.getElementById('radiusLat').value);
        lon = parseFloat(document.getElementById('radiusLon').value);
    }
    
    // Get radius and query type from user inputs
    const radius = parseInt(document.getElementById('radiusDistance').value);
    const queryType = document.getElementById('radiusType').value;

    // Validate inputs
    if (isNaN(lat) || isNaN(lon) || isNaN(radius)) {
        alert('Please enter valid coordinates and radius, or click on the map to create Marker 1');
        return;
    }

    try { // Try to perform the search and handle any errors
        const layer = window.queryLayer || queryLayer;
        layer.clearLayers();
        
        // Recreate markers if they exist
        if (window.boundsMarkers && window.boundsMarkers.point1) {
            layer.addLayer(window.boundsMarkers.point1);
        }
        if (window.boundsMarkers && window.boundsMarkers.point2) {
            layer.addLayer(window.boundsMarkers.point2);
        }
        
        // Draw circle representing the search radius
        const circle = L.circle([lat, lon], {
            radius: radius,
            color: 'blue',
            fill: false,
            weight: 2,
            dashArray: '5, 5',
            opacity: 0.7
        });
        layer.addLayer(circle); // Add circle to the query layer


        // For routes
        if (queryType === 'routes') { // Check if query type is routes
            // For routes, we need to search for shapes/routes near the point
            const distanceKm = radius / 1000; // Convert meters to kilometers
            const endpoint = `/api/shapes/nearby/?lat=${lat}&lon=${lon}&distance_km=${distanceKm}`; // Construct API endpoint
            console.log('Fetching routes from radius:', endpoint); 
            const response = await fetch(endpoint); // Fetch data from the API
            const data = await response.json(); // Parse response as JSON
            console.log('Radius routes response:', data); 
            
            // Add routes directly to layer this doesnt clear the layer when use updated
            const routesResults = data.results || []; // Get results array or empty array
            console.log('Routes count:', routesResults.length); 
            routesResults.forEach((route, idx) => { // Iterate over each route result by index
                const props = route.properties || route; // Get properties from route
                const coordinates = route.geometry?.coordinates; // Get coordinates from geometry
                //console.log(`Route ${idx}:`, {shape_id: props.shape_id, has_coords: !!coordinates, coords_length: coordinates ? coordinates.length : 0});
                
                // Create polyline if coordinates exist
                if (coordinates && Array.isArray(coordinates)) {// Check if coordinates exist and are an array
                    const latLngs = coordinates.map(coord => [coord[1], coord[0]]); // Convert to Leaflet latLng format
                    const polyline = L.polyline(latLngs, { // Create polyline with styling
                        color: '#9b59b6',
                        weight: 4,
                        opacity: 0.8,
                        lineCap: 'round',
                        lineJoin: 'round'
                    });
                    // Enhanced popup with all route data
                    const popupContent =  `
                        <div class="popup-content">
                            <strong>${props.route_short_name || 'Route'}</strong><br>
                            ${props.route_long_name ? `<small>${props.route_long_name}</small><br>` : ''}
                            Route ID: ${props.route_id || 'N/A'}<br>
                            ${props.route_type ? `Type: ${getRouteTypeName(props.route_type)}<br>` : ''}
                            ${props.route_color ? `<small>Color: #${props.route_color}</small>` : ''}
                        </div>
                    `;
                    polyline.bindPopup(popupContent);// Bind popup to polyline
                    layer.addLayer(polyline); // Add polyline to the query layer
                }
            });
            
            // Display results in the results panel
            displayResultsList(routesResults, `Radius Search: ${routesResults.length} routes found`);
        } else if (queryType === 'both') { // For BOTH stops and routes
            // For BOTH stops and routes - fetch stops first, add to layer, then routes
            const distanceKm = radius / 1000; // Convert meters to kilometers
            const stopsUrl = `/api/stops/nearby/?lat=${lat}&lon=${lon}&distance_km=${distanceKm}`; // Construct stops API endpoint
            const shapesUrl = `/api/shapes/nearby/?lat=${lat}&lon=${lon}&distance_km=${distanceKm}`; // Construct shapes API endpoint
            
            const stopsResp = await fetch(stopsUrl); // Fetch stops data first
            const stopsData = await stopsResp.json(); // Parse stops response as JSON
            
            // Add stops to map
            const stopsResults = stopsData.results || [];
            stopsResults.forEach(stop => {
                // Handle GeoJSON Feature format
                const props = stop.properties || stop;
                const coords = stop.geometry?.coordinates;
                
                if (coords) { // Check if coordinates exist
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
                    // Bind popup to marker
                    marker.bindPopup(popupContent);
                    layer.addLayer(marker);
                }
            });
            
            // Fetch routes data second
            const routesResp = await fetch(shapesUrl);
            const routesData = await routesResp.json();
            console.log('Radius both - Routes data:', routesData);
            
            // Add routes to map
            const routesResults = routesData.results || [];
            console.log('Radius both - Routes count:', routesResults.length);
            routesResults.forEach(route => { // Iterate over each route
                const props = route.properties || route;
                const coordinates = route.geometry?.coordinates;
                console.log('Radius both - Route:', props.route_short_name, 'has coords:', !!coordinates);
                if (coordinates && Array.isArray(coordinates)) { // Check if coordinates exist
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
                    polyline.bindPopup(popupContent); // Bind popup to polyline
                    layer.addLayer(polyline);
                    console.log('Radius both - Added route to layer');
                }
            });
            
            // Display results in the results panel
            console.log('Radius both - Display results. Stops:', stopsResults.length, 'Routes:', routesResults.length);
            displayBothResults(stopsResults, routesResults);// Display both stops and routes results
            return;
        } else { // For stops only
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

                if (coords) { // Check if coordinates exist
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
            
            // Display results in the results panel 
            displayResultsList(stopsResults, `Radius Search: ${stopsResults.length} stops found`);
        }
    } catch (error) { // Catch and log any errors
        console.error('Error performing radius search:', error);
        alert('Error performing search');
    }
}

// Perform a bounding box search based on user input or marker positions
async function performBoundsSearch() { // Declare bounding box variables
    let minLat, maxLat, minLon, maxLon; // Initialise bounding box variables    
    
    // Use markers if they exist, otherwise use input values
    if (window.boundsMarkers && window.boundsMarkers.point1 && window.boundsMarkers.point2) {
        const p1 = window.boundsMarkers.point1.getLatLng();// Get LatLng of Marker 1
        const p2 = window.boundsMarkers.point2.getLatLng(); // Get LatLng of Marker 2
        
        // Calculate min and max lat/lon from the two markers
        minLat = Math.min(p1.lat, p2.lat);
        maxLat = Math.max(p1.lat, p2.lat);
        minLon = Math.min(p1.lng, p2.lng);
        maxLon = Math.max(p1.lng, p2.lng);
        
        console.log(`Using markers bounds: minLat=${minLat}, maxLat=${maxLat}, minLon=${minLon}, maxLon=${maxLon}`);
    } else { // Use input values
        minLat = parseFloat(document.getElementById('bboxMinLat').value);
        maxLat = parseFloat(document.getElementById('bboxMaxLat').value);
        minLon = parseFloat(document.getElementById('bboxMinLon').value);
        maxLon = parseFloat(document.getElementById('bboxMaxLon').value);
    }
    
    // Get query type from user input
    const queryType = document.getElementById('boundsType').value;

    // Validate inputs
    if (isNaN(minLat) || isNaN(maxLat) || isNaN(minLon) || isNaN(maxLon)) {
        alert('Please enter valid bounding box coordinates or click on the map to create two markers');
        return;
    }

    try { // Try to perform the search and handle any errors
        const layer = window.queryLayer || queryLayer; // Get the query layer
        layer.clearLayers(); // Clear existing layers
        
        // Create a feature group for the rectangle and markers
        let rectangleLayer = L.featureGroup();
        
        // Draw rectangle with calculated bounds
        const boundsForRect = [[minLat, minLon], [maxLat, maxLon]]; // Define rectangle bounds
        const rectangle = L.rectangle(boundsForRect, { // Create rectangle with styling
            color: '#9b59b6',
            fill: true,
            fillColor: '#9b59b6',
            fillOpacity: 0.1,
            weight: 3,
            opacity: 0.8,
            dashArray: '5, 5'
        });
        rectangleLayer.addLayer(rectangle); // Add rectangle to the feature group
        
        // Add the markers on top of the rectangle if they exist
        if (window.boundsMarkers && window.boundsMarkers.point1) rectangleLayer.addLayer(window.boundsMarkers.point1);
        if (window.boundsMarkers && window.boundsMarkers.point2) rectangleLayer.addLayer(window.boundsMarkers.point2);
        
        console.log('Drawing rectangle with bounds:', boundsForRect);

        // Add rectangle layer with markers to the query layer
        layer.addLayer(rectangleLayer);

        if (queryType === 'routes') {
            // For routes, use shapes endpoint
            const endpoint = `/api/shapes/in_bounds/?min_lat=${minLat}&max_lat=${maxLat}&min_lon=${minLon}&max_lon=${maxLon}`; // Construct API endpoint
            console.log('Fetching routes from bounds:', endpoint); 
            const response = await fetch(endpoint); // Fetch data from the API
            const data = await response.json(); // Parse response as JSON
            console.log('Bounds routes response:', data);
            
            // Add routes directly to layer with out clearing the existing rectangle
            const routesResults = data.results || []; // Get results array or empty array
            console.log('Routes count:', routesResults.length); 
            routesResults.forEach((route, idx) => { // Iterate over each route result by index
                const props = route.properties || route; // Get properties from route
                const coordinates = route.geometry?.coordinates; // Get coordinates from geometry
                //console.log(`Route ${idx}:`, {shape_id: props.shape_id, has_coords: !!coordinates, coords_length: coordinates ? coordinates.length : 0});
               
                if (coordinates && Array.isArray(coordinates)) { // Check if coordinates exist and are an array
                    // Create polyline if coordinates exist
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
                    // Bind popup to polyline
                    polyline.bindPopup(popupContent);
                    layer.addLayer(polyline);
                }
            });
            
            // Display results in the results panel
            displayResultsList(routesResults, `Bounds Search: ${routesResults.length} routes found`);
        // For BOTH stops and routes fetch stops, add to layer, then routes
        } else if (queryType === 'both') {// For BOTH stops and routes

           // Construct API endpoints for stops and shapes
            const stopsUrl = `/api/stops/in_bounds/?min_lat=${minLat}&max_lat=${maxLat}&min_lon=${minLon}&max_lon=${maxLon}`;
            const shapesUrl = `/api/shapes/in_bounds/?min_lat=${minLat}&max_lat=${maxLat}&min_lon=${minLon}&max_lon=${maxLon}`;
            
            // Fetch stops data first
            console.log('Fetching stops from:', stopsUrl);
            const stopsResp = await fetch(stopsUrl);
            const stopsData = await stopsResp.json();
            console.log('Stops received:', stopsData.results ? stopsData.results.length : 0);
            
            // Add stops to map
            const stopsResults = stopsData.results || []; // Get stops results array
            stopsResults.forEach(stop => { // Iterate over each stop
                // Handle GeoJSON Feature format
                const props = stop.properties || stop;
                const coords = stop.geometry?.coordinates || stop.point;
                if (coords) { // Check if coordinates exist create marker
                    const marker = L.marker([coords[1], coords[0]], {
                        icon: L.divIcon({
                            className: 'query-marker stop-marker',
                            html: '<i class="fas fa-star" style="color: #9b59b6; font-size: 32px; text-shadow: -1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white;"></i>',
                            iconSize: [50, 50],
                            iconAnchor: [25, 25]
                        })
                    });
                    // Popup with all stop data
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
                    // Bind popup to marker
                    marker.bindPopup(popupContent);
                    layer.addLayer(marker);
                }
            });
            
            // Fetch routes data 
            const routesResp = await fetch(shapesUrl);
            const routesData = await routesResp.json();

            // Add routes to map same as stops
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

        } else {// For stops without clearing the rectangle
            
            //get stops within bounds, get endpoint, fetch data, parse json
            const endpoint = `/api/stops/in_bounds/?min_lat=${minLat}&max_lat=${maxLat}&min_lon=${minLon}&max_lon=${maxLon}`;
            const response = await fetch(endpoint);
            const data = await response.json();
            
            // Add stops directly to layer same as above for stops
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
    } catch (error) { // Catch and log any errors
        console.error('Error performing bounds search:', error);
        alert('Error performing search');
    }
}

// Perform advanced queries for "Stops on Route" and "K Nearest Stops"
async function performAdvancedQuery() {
    const queryType = document.getElementById('advancedQueryType').value; // Get selected query type
    const layer = window.queryLayer || queryLayer; // Get the query layer
    
    try {// Try to perform the selected advanced query
        if (queryType === 'stops-on-route') {
            await performStopsOnRouteQuery();
        } else if (queryType === 'k-nearest') {
            await performKNearestQuery();
        }
    } catch (error) { // Catch and log any errors
        console.error('Error performing advanced query:', error);
        alert('Error performing search: ' + error.message);
    }
}

// Perform "Stops on Route" query
// This function fetches and displays stops for a specific route
// It adds markers for each stop with sequence numbers and popups
// It also displays the results in a structured format on the results panel
async function performStopsOnRouteQuery() {
    const routeId = document.getElementById('routeSelect').value; // Get selected route ID
    
    // Validate input
    if (!routeId) {
        alert('Please select a route');
        return;
    }
    
    // Clear existing query layers
    const layer = window.queryLayer || queryLayer;
    layer.clearLayers();

    // Get endpoint for fetching stops for the selected route then json parse
    const endpoint = '/api/stops/on_route/?route_id=' + routeId;
    const response = await fetch(endpoint);
    const data = await response.json();
    
    // Handle 404 error for invalid route
    if (response.status === 404) {
        alert('Route not found');
        return;
    }
    
    // Extract stops from response data
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
        
        //popup with all stop data
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

// Perform "K Nearest Stops" query
// This function fetches and displays the K nearest stops to a given location
// It adds markers for each stop with rank numbers and popups
// It also displays the results in a structured format on the results panel
async function performKNearestQuery() {
    // Get user input for latitude, longitude, and K value
    const lat = parseFloat(document.getElementById('kNearestLat').value);
    const lon = parseFloat(document.getElementById('kNearestLon').value);
    const k = parseInt(document.getElementById('kNearestCount').value) || 5;
    
    // Validate inputs
    if (isNaN(lat) || isNaN(lon)) {
        alert('Please enter valid coordinates');
        return;
    }
    
    // Clear existing query layers
    const layer = window.queryLayer || queryLayer;
    layer.clearLayers();
    
    // Get endpoint for fetching K nearest stops then json parse
    const endpoint = '/api/stops/k_nearest/?lat=' + lat + '&lon=' + lon + '&k=' + k;
    const response = await fetch(endpoint);
    const data = await response.json();
    
    // Extract stops from response data
    const stops = data.results || [];
    
    // Add center point marker for query location
    const centerMarker = L.circleMarker([lat, lon], {
        radius: 8,
        fillColor: '#e74c3c',
        color: '#c0392b',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
    });
    //center marker popup
    centerMarker.bindPopup('<strong>Query Point</strong><br>(' + lat.toFixed(4) + ', ' + lon.toFixed(4) + ')');
    layer.addLayer(centerMarker); // Add center marker to the query layer
    
    // Add stops to map with rank numbers
    stops.forEach((stop, idx) => { // Iterate over each stop with index
        // Handle GeoJSON feature format
        const props = stop.properties || stop; // Get properties from stop
        const coords = stop.geometry?.coordinates || [stop.longitude, stop.latitude]; // Get coordinates from geometry or stop data
        
        // Create marker with rank number as icon
        const marker = L.marker([coords[1], coords[0]], {
            icon: L.divIcon({
                className: 'query-marker stop-marker',
                html: `<div style="background: #3498db; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${idx + 1}</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        });
        
        
        const distance = stop.distance !== undefined ? stop.distance : 'N/A'; // Get distance if available
        
        // Popup with all stop data
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

// Display query results on the map and in the results panel
function displayResults(results, title, centerLat, centerLon) { 
    const layer = window.queryLayer || queryLayer; // Get the query layer
    layer.clearLayers(); // Clear existing layers

    // Add markers for each result
    results.forEach((result, idx) => {// Iterate over each result
        
        // Handle GeoJSON feature format
        const geom = result.geometry;
        const props = result.properties || result;
        
        // Check if geometry and coordinates exist
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
                // Popup with all relevant data
                const popupContent = `
                    <div class="popup-content">
                        <strong>${props.stop_name || props.route_short_name}</strong><br>
                        ${props.stop_code ? 'Code: ' + props.stop_code + '<br>' : ''}
                        ${props.stop_type ? 'Type: ' + props.stop_type + '<br>' : ''}
                        ${props.speed ? 'Speed: ' + props.speed.toFixed(1) + ' km/h<br>' : ''}
                        ${props.status ? 'Status: ' + props.status + '<br>' : ''}
                    </div>
                `;
                // Bind popup to marker
                marker.bindPopup(popupContent);
                layer.addLayer(marker);
            }
        }
    });

    // Center map on provided coordinates if available
    if (centerLat && centerLon) {
        map.setView([centerLat, centerLon], 15);// Set map view to center coordinates with zoom level 15
    }

    displayResultsList(results, title); // Display results in the results panel
}

// Display both stops and routes results in the results panel
// This function formats and displays the results for both stops and routes
// It shows a summary of counts and lists the first few results with details
// Additional results can be viewed in a dropdown
// Each result is clickable to center the map on its location
function displayBothResults(stops, routes) {
    // Get the results panel elements
    const resultsDiv = document.getElementById('queryResults'); // Main results container
    const resultsList = document.getElementById('resultsList'); // Results list container

    // Clear previous results
    let html = `<div class="alert alert-info">Both Search: <strong>${stops.length} stops</strong> and <strong>${routes.length} routes</strong> found</div>`; // Info alert
    html += `<div class="results-count">Total: <strong>${stops.length + routes.length}</strong></div>`; // Total count

    // Display stops
    if (stops.length > 0) { // If there are stops to display
        html += `<div style="margin-top: 10px;"><strong style="color: #9b59b6;">Stops (${stops.length})</strong></div>`;
        
        // Show first 3 stops
        stops.slice(0, 3).forEach((stop, index) => { // Iterate over each stop
            const props = stop.properties || stop;// Get properties from the stop
            const name = props.stop_name || props.name || `Stop ${index + 1}`; // The first stop
            const coords = stop.geometry?.coordinates || []; // Get coordinates from geometry
            
            const details = []; // Prepare details array
            if (props.stop_code) details.push(`Code: ${props.stop_code}`); // Add stop code if available
            if (props.stop_type) details.push(`Type: ${props.stop_type}`);// Add stop type if available
            if (coords.length > 0) details.push(`(${coords[1].toFixed(4)}, ${coords[0].toFixed(4)})`); // Add coordinates
            
            // Create stop item HTML
            const stopId = `stop-${index}-${props.stop_id || 'unknown'}`;// Unique stop ID for HTML element
            html += `<div class="result-item" id="${stopId}" style="padding: 8px; border-left: 3px solid #9b59b6; margin-bottom: 5px; cursor: pointer;" onclick="window.centerMapOnResult(${coords[1]}, ${coords[0]}, 15); this.style.backgroundColor='#f0e6ff';">
                <strong>${name}</strong><br>
                <small>${details.join(' • ')}</small>
            </div>`;
        });
        
        // Show dropdown for additional stops if more than 3
        if (stops.length > 3) {// If there are more than 3 stops
            html += `<details style="margin: 10px 0; cursor: pointer;">
                <summary style="color: #9b59b6; font-weight: bold;">Show ${stops.length - 3} more stops...</summary>
                <div style="margin-top: 10px;">`;
            // Iterate over additional stops
            stops.slice(3).forEach((stop, index) => {// Iterate over each additional stop
                const props = stop.properties || stop;
                const name = props.stop_name || props.name || `Stop ${index + 4}`; // After the third stop
                const coords = stop.geometry?.coordinates || []; // Get coordinates from geometry
                
                const details = []; // Prepare details array
                if (props.stop_code) details.push(`Code: ${props.stop_code}`); // Add stop code if available
                if (props.stop_type) details.push(`Type: ${props.stop_type}`); // Add stop type if available
                if (coords.length > 0) details.push(`(${coords[1].toFixed(4)}, ${coords[0].toFixed(4)})`); // Add coordinates
                
                // Create stop item HTML
                const stopId = `stop-${index + 3}-${props.stop_id || 'unknown'}`; // Unique stop ID for HTML element
                html += `<div class="result-item" id="${stopId}" style="padding: 8px; border-left: 3px solid #9b59b6; margin-bottom: 5px; cursor: pointer;" onclick="window.centerMapOnResult(${coords[1]}, ${coords[0]}, 15); this.style.backgroundColor='#f0e6ff';">
                    <strong>${name}</strong><br>
                    <small>${details.join(' • ')}</small>
                </div>`;
            });
            
            html += `</div></details>`; // Close details tag
        }
    }

    // Display routes
    if (routes.length > 0) { // If there are routes to display
        html += `<div style="margin-top: 15px;"><strong style="color: #9b59b6;">Routes (${routes.length})</strong></div>`;
        
        // Show first 3 routes same as the stops above
        routes.slice(0, 3).forEach((route, index) => {
            const props = route.properties || route;
            const shortName = props.route_short_name || 'Route'; // Short name or default
            const longName = props.route_long_name || ''; // Long name if available
            const routeId = props.route_id || index + 1; // Unique route ID of the first route
            
            const details = []; // Prepare details array
            if (props.route_type) details.push(`Type: ${getRouteTypeName(props.route_type)}`); // Add route type if available
            
            // Get first coordinate of route for centering
            const coords = route.geometry?.coordinates?.[0] || [0, 0]; // Default to [0,0] if not available
            const routeItemId = `route-${index}-${routeId}`; // Unique route ID for HTML element
            html += `<div class="result-item" id="${routeItemId}" style="padding: 8px; border-left: 3px solid #9b59b6; margin-bottom: 5px; cursor: pointer;" onclick="window.centerMapOnResult(${coords[1]}, ${coords[0]}, 15); this.style.backgroundColor='#f0e6ff';">
                <strong>${shortName}</strong><br>
                ${longName ? `<small>${longName}</small><br>` : ''}
                <small>Route ID: ${routeId}${details.length > 0 ? ' • ' + details.join(' • ') : ''}</small>
            </div>`;
        });
        
        // Show dropdown for additional routes if more than 3 same as above
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

// Display a list of query results in the results panel
// This function formats and displays the results with relevant details
// It shows a summary of the total count and lists the first few results
// Additional results can be viewed in a dropdown
// Each result is clickable to center the map on its location
// This is the same as above but for a single type of result
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
                        name = `${props.route_short_name} - ${props.route_long_name}`; // First coordinate for display
                    }
                }
            }
            
            const details = []; // Prepare details array
            
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
    // Show the results list
    resultsList.innerHTML = html;
    resultsDiv.style.display = 'block'; // Show the results panel
}

// Display route results on the map and in the results panel
// This function adds polylines for each route shape to the map
// It also displays the results in a structured format on the results panel
function displayRouteResults(shapes) {
    
    // Clear existing query layers
    const layer = window.queryLayer || queryLayer;
    layer.clearLayers();

    // Group shapes by route for better display
    const shapesByRoute = {}; // Initialise an object to group shapes by route
    
    shapes.forEach(shape => { // Iterate over each shape
        const props = shape.properties; // Get properties of the shape
        const routeKey = `${props.route_short_name || 'Unknown'}-${props.route_type || 'N/A'}`; // Create a unique key for each route

        // Initialise array for this route if not already present
        if (!shapesByRoute[routeKey]) {// Check if route key exists
            shapesByRoute[routeKey] = []; // Create an array for this route
        }
        shapesByRoute[routeKey].push(shape);// Add shape to the corresponding route array
    });

    // Display each route as a polyline
    Object.entries(shapesByRoute).forEach(([routeKey, routeShapes]) => { // Iterate over each route group
        routeShapes.forEach(shape => { // Iterate over each shape in the route
            if (shape.geometry && shape.geometry.type === 'LineString') { // Check if geometry is LineString
                const coords = shape.geometry.coordinates.map(c => [c[1], c[0]]); // Convert to [lat, lon] format
                const props = shape.properties; // Get properties of the shape

                // Create polyline with styling
                const polyline = L.polyline(coords, {
                    color: '#9b59b6',
                    weight: 4,
                    opacity: 0.8,
                    lineCap: 'round',
                    lineJoin: 'round'
                });

                // Popup with all route data
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

    // Fit map bounds to show all routes
    if (layer.getLayers().length > 0) {
        map.fitBounds(layer.getBounds(), { padding: [50, 50] });
    }

    // Display results in the results panel
    displayResultsList(shapes, `Routes in Area: ${Object.keys(shapesByRoute).length} routes found`);
}

// Display stops on route results in the results panel
// This function formats and displays the stops for a specific route
// It shows a summary of the route and lists the first few stops with details
// Additional stops can be viewed in a dropdown
// Each stop is clickable to center the map on its location
function displayStopsOnRouteResults(stops, routeData) {
    // Get the results panel elements
    const resultsList = document.getElementById('resultsList');
    const resultsDiv = document.getElementById('queryResults');
    
    
    let html = `<div class="alert alert-info mb-2">
        <strong>${routeData.route_short_name}</strong> - ${routeData.route_long_name}<br>
        <small>Type: ${routeData.route_type}</small><br>
        <small>${routeData.stop_count} stops</small>
    </div>`; // Info alert
    html += `<div class="results-count">Total: <strong>${stops.length}</strong></div>`; // Total count
    
    // same as above for displaying results
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

// Display K-Nearest Stops results in the results panel
// This function formats and displays the K nearest stops to a given location
// It shows a summary of the query and lists the first few stops with details
// Additional stops can be viewed in a dropdown
// Each stop is clickable to center the map on its location 
// Same as above but for K-Nearest Stops
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

// Update UI based on selected search type not implemented yet
function updateRadiusOptions() {
    console.log('Radius search type changed');
}

// Update UI based on selected advanced query type
function updateAdvancedOptions() {
    // Show/hide options based on selected query type
    const queryType = document.getElementById('advancedQueryType').value;
    const stopsOnRouteDiv = document.getElementById('stopsOnRouteOptions');
    const kNearestDiv = document.getElementById('kNearestOptions');

    // Show/hide options based on selected query type
    stopsOnRouteDiv.style.display = queryType === 'stops-on-route' ? 'block' : 'none';
    kNearestDiv.style.display = queryType === 'k-nearest' ? 'block' : 'none';
}


//This function runs when the document is fully loaded
// It initialises default values for input fields
// It ensures the UI is ready for user interaction on load
// It uses a timeout to delay loading routes to ensure data is available on DOMContentLoaded event
// This improves user experience by pre-filling common values and populating dropdowns
// It also helps avoid race conditions with data loading 
document.addEventListener('DOMContentLoaded', function() {
    
    // Set default values for radius search inputs
    const radiusLatInput = document.getElementById('radiusLat');
    const radiusLonInput = document.getElementById('radiusLon');
    
    // Set default values for K nearest search inputs
    const kNearestLatInput = document.getElementById('kNearestLat');
    const kNearestLonInput = document.getElementById('kNearestLon');

    //If radius inputs exist Initialise with Dublin coordinates
    if (radiusLatInput && radiusLonInput) { 
        radiusLatInput.value = '53.3498';
        radiusLonInput.value = '-6.2603';
    }

    //If K nearest inputs exist Initialise with Dublin coordinates
    if (kNearestLatInput && kNearestLonInput) {
        kNearestLatInput.value = '53.3498';
        kNearestLonInput.value = '-6.2603';
    }

    //If K nearest inputs exist Initialise with Dublin coordinates
    if (kNearestLatInput && kNearestLonInput) {
        kNearestLatInput.value = '53.3498';
        kNearestLonInput.value = '-6.2603';
    }

    // Load routes into the route selector with a delay to allow data to load
    setTimeout(function() { // Delay to ensure data is available
        loadRoutesIntoSelector();
    }, 1000);
});

// Load routes from the API and populate the route selection dropdown
// This function fetches route data from the API endpoint
// It handles different response formats to ensure compatibility
// The routes are then added as options in the dropdown for user selection
// Error handling is included to manage API request failure
function loadRoutesIntoSelector() {
    const routeSelect = document.getElementById('routeSelect'); // Get the route selection dropdown
    if (!routeSelect) return; // Exit if dropdown not found
    
    // Fetch routes from the API
    fetch('/api/routes/') // Fetch routes endpoint
        .then(resp => resp.json()) // Parse response as JSON
        .then(data => { // Handle the parsed data
            //console.log('Routes API response:', data);
            //console.log('data.results:', data.results);
            //console.log('data.results.features:', data.results.features);
            //console.log('data.results.features length:', data.results.features ? data.results.features.length : 'undefined');
            
            let routes = []; // Initialise routes array
            
            // Handle different response formats
            if (Array.isArray(data)) { // Direct array format
                routes = data; //routes is the data array
            } else if (data.results && Array.isArray(data.results)) { // Standard results array format
                routes = data.results; //routes is the results array
            } else if (data.results && data.results.features && Array.isArray(data.results.features)) { // GeoJSON FeatureCollection format
                //console.log('Using GeoJSON features format');
                routes = data.results.features.map(feature => feature.properties || feature); // Extract properties from features
            } else if (data.data && Array.isArray(data.data)) { // New format with data field
                routes = data.data; //routes is the data array
            }
            
            //console.log('Parsed routes:', routes);
            console.log('Routes length:', routes.length);
            // Populate the route selection dropdown
            routeSelect.innerHTML = '<option value="">Select a route...</option>';
            
            // Handle case with no routes found
            if (routes.length === 0) {
                routeSelect.innerHTML += '<option disabled>No routes found</option>';
                console.warn('No routes found in database');
            } else { // Add each route as an option in the dropdown
                routes.forEach(route => { // Iterate over each route
                    const option = document.createElement('option'); // Create a new option element
                    option.value = route.route_id; // Set option value to route ID
                    option.textContent = `${route.route_short_name} - ${route.route_long_name}`; // Set option text to route name
                    routeSelect.appendChild(option); // Add option to the dropdown
                });
            }
        })
        .catch(err => { // Handle errors during fetch
            console.error('Error loading routes:', err);
            routeSelect.innerHTML = '<option value="">Error loading routes</option>';
        });
}

// Center the map on a specific result given its latitude and longitude
// This function is called when a result item is clicked in the results panel
// It sets the map view to the specified coordinates with an optional zoom level
// This improves user experience by allowing quick navigation to selected results
window.centerMapOnResult = function(lat, lon, zoom) {
    if (typeof map !== 'undefined' && map) {
        map.setView([lat, lon], zoom || 10);
    }
};
