//Transport API - API Helper Functions
/// This module provides functions to interact with the Transport API backend
// It includes methods for fetching stops, routes, and spatial queries,
// As well as utility functions for data formatting and error handling.

// The base URL for the API
const API_BASE = window.API_BASE_URL || '/api';

//The Stop API query functions
class StopAPI {
    
    //Get a single stop by ID
    static get(id) {
        return fetch(`${API_BASE}/stops/${id}/`).then(r => r.json());
    }
   
    //List stops with optional filtering parameters
    static list(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        //gets the query string from the params object then fetches the stops from the API then returns the response as JSON
        return fetch(`${API_BASE}/stops/?${queryString}`).then(r => r.json());
    }

    //Find stops nearby a given latitude and longitude within a specified distance (in meters)
    static nearby(lat, lon, distance = 500) {
        return fetch(`${API_BASE}/stops/nearby/?lat=${lat}&lon=${lon}&distance=${distance}`).then(r => r.json());
    }

    //Find stops within a bounding box defined by min/max latitude and longitude
    static inBounds(minLat, maxLat, minLon, maxLon) {
        return fetch(`${API_BASE}/stops/in_bounds/?min_lat=${minLat}&max_lat=${maxLat}&min_lon=${minLon}&max_lon=${maxLon}`).then(r => r.json());
    }

    //Search stops by name or other attributes from the query string inputted by the user
    static search(query) {
        //encodedURIComponent to handle special characters in the query
        return fetch(`${API_BASE}/stops/?search=${encodeURIComponent(query)}`).then(r => r.json());
    }
}

//The Route API query functions
class RouteAPI {
    //Get a single route by ID
    static get(id) {
        //Fetch the route data from the API
        return fetch(`${API_BASE}/routes/${id}/`).then(r => r.json());
    }
    //List routes with optional filtering parameters from the user
    static list(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return fetch(`${API_BASE}/routes/?${queryString}`).then(r => r.json());
    }

    //Search routes by name or other attributes from the query string inputted by the user
    static search(query) {
        return fetch(`${API_BASE}/routes/?search=${encodeURIComponent(query)}`).then(r => r.json());
    }

    //Get routes filtered by specific route type (e.g., bus, tram, subway)
    static getByType(routeType) {
        return fetch(`${API_BASE}/routes/?route_type=${routeType}`).then(r => r.json());
    }
}

//The Spatial Query API functions
class SpatialQueryAPI {
    //Get a single spatial query by ID
    static get(id) {
        return fetch(`${API_BASE}/spatial-queries/${id}/`).then(r => r.json());
    }

    //List all spatial queries with optional filtering parameters
    static list(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return fetch(`${API_BASE}/spatial-queries/?${queryString}`).then(r => r.json());
    }
    //Create a new spatial query with given name, geometry, and query type
    //The geometry parameter should be a GeoJSON object
    //The queryType parameter specifies the type of spatial query (e.g., 'within', 'intersects')
    //Returns the created spatial query as JSON
    static create(name, geometry, queryType) {

        return fetch(`${API_BASE}/spatial-queries/`, {
            //Create a new spatial query
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                //CSRF token for security
                'X-CSRFToken': getCookie('csrftoken')
            },
            //Request body containing the query details
            body: JSON.stringify({
                name: name,
                geometry: geometry,
                query_type: queryType
            })
        }).then(r => r.json());
    }
    //Delete a spatial query by ID
    static delete(id) {
        return fetch(`${API_BASE}/spatial-queries/${id}/`, {
            //Delete the specified spatial query
            method: 'DELETE',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            }
        }).then(r => r.ok);
    }
}

// Utility Functions 
// General helper functions for formatting and calculations

// Get CSRF token from cookies for secure POST/DELETE requests
function getCookie(name) {
    let cookieValue = null;//Initialize cookieValue to null
    if (document.cookie && document.cookie !== '') {//Check if there are any cookies
        const cookies = document.cookie.split(';');//Split cookies into an array
        for (let i = 0; i < cookies.length; i++) {//Iterate through cookies
            const cookie = cookies[i].trim();//Trim whitespace
            if (cookie.substring(0, name.length + 1) === (name + '=')) {//Check if this cookie matches the desired name
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));//Decode and assign the cookie value
                break;
            }
        }
    }
    return cookieValue;
}

// Calculate distance between two geographic coordinates using Haversine formula
// lat1, lon1: Latitude and Longitude of point 1
// lat2, lon2: Latitude and Longitude of point 2
// Returns distance in kilometers
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180; // Convert degrees to radians
    const dLon = (lon2 - lon1) * Math.PI / 180; 
    // Haversine formula
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + 
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

// Formatting Functions for displaying data

// Format distance in meters or kilometers
function formatDistance(meters) {
    if (meters < 1000) {
        return Math.round(meters) + ' m';
    }
    return (meters / 1000).toFixed(2) + ' km';
}

// Format speed in kilometers per hour for vichle speeds not implemented yet
function formatSpeed(kmh) {
    return Math.round(kmh) + ' km/h';
}

// Format timestamp into human-readable time
function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString();
}

// Error Handling Function  
function handleAPIError(error) {
    console.error('API Error:', error);
    alert('An error occurred while fetching data. Please try again.');
}

// Convert a feature object to GeoJSON format
function toGeoJSON(feature) {
    return {
        //Construct a GeoJSON Feature object
        type: 'Feature',
        geometry: feature.geometry,
        properties: Object.keys(feature).reduce((props, key) => { // Iterate over all keys in the feature object
            // Include all properties except geometry
            if (key !== 'geometry') {//
                props[key] = feature[key];//Assign property to props object
            }
            return props;
        }, {})
    };
}
