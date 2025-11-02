/**
 * Transport API - API Helper Functions
 */

const API_BASE = window.API_BASE_URL || '/api';

class StopAPI {
    static get(id) {
        return fetch(`${API_BASE}/stops/${id}/`).then(r => r.json());
    }

    static list(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return fetch(`${API_BASE}/stops/?${queryString}`).then(r => r.json());
    }

    static nearby(lat, lon, distance = 500) {
        return fetch(`${API_BASE}/stops/nearby/?lat=${lat}&lon=${lon}&distance=${distance}`).then(r => r.json());
    }

    static inBounds(minLat, maxLat, minLon, maxLon) {
        return fetch(`${API_BASE}/stops/in_bounds/?min_lat=${minLat}&max_lat=${maxLat}&min_lon=${minLon}&max_lon=${maxLon}`).then(r => r.json());
    }

    static search(query) {
        return fetch(`${API_BASE}/stops/?search=${encodeURIComponent(query)}`).then(r => r.json());
    }
}

class RouteAPI {
    static get(id) {
        return fetch(`${API_BASE}/routes/${id}/`).then(r => r.json());
    }

    static list(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return fetch(`${API_BASE}/routes/?${queryString}`).then(r => r.json());
    }

    static search(query) {
        return fetch(`${API_BASE}/routes/?search=${encodeURIComponent(query)}`).then(r => r.json());
    }

    static getByType(routeType) {
        return fetch(`${API_BASE}/routes/?route_type=${routeType}`).then(r => r.json());
    }
}

class SpatialQueryAPI {
    static get(id) {
        return fetch(`${API_BASE}/spatial-queries/${id}/`).then(r => r.json());
    }

    static list(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return fetch(`${API_BASE}/spatial-queries/?${queryString}`).then(r => r.json());
    }

    static create(name, geometry, queryType) {
        return fetch(`${API_BASE}/spatial-queries/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                name: name,
                geometry: geometry,
                query_type: queryType
            })
        }).then(r => r.json());
    }

    static delete(id) {
        return fetch(`${API_BASE}/spatial-queries/${id}/`, {
            method: 'DELETE',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            }
        }).then(r => r.ok);
    }
}

/**
 * Utility Functions
 */

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

function formatDistance(meters) {
    if (meters < 1000) {
        return Math.round(meters) + ' m';
    }
    return (meters / 1000).toFixed(2) + ' km';
}

function formatSpeed(kmh) {
    return Math.round(kmh) + ' km/h';
}

function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString();
}

/**
 * Error Handling
 */

function handleAPIError(error) {
    console.error('API Error:', error);
    alert('An error occurred while fetching data. Please try again.');
}

/**
 * Data Transformation
 */

function toGeoJSON(feature) {
    return {
        type: 'Feature',
        geometry: feature.geometry,
        properties: Object.keys(feature).reduce((props, key) => {
            if (key !== 'geometry') {
                props[key] = feature[key];
            }
            return props;
        }, {})
    };
}
